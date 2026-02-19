# ws_user.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Optional, Any, Tuple
from decimal import Decimal
import asyncio
import json
import time
import logging

# import exchange (must implement register_user_listener / unregister_user_listener)
from exchange import exchange

router = APIRouter(prefix="", tags=["user-data-ws"])

logger = logging.getLogger("app.ws_user")
logger.addHandler(logging.NullHandler())


class DecimalEncoder(json.JSONEncoder):
    """Custom JSON encoder that converts Decimal to string."""

    def default(self, obj):
        if isinstance(obj, Decimal):
            return str(obj)
        return super().default(obj)


async def _send_json_safe(ws: WebSocket, obj: Any) -> None:
    """Send JSON to websocket; raise to trigger cleanup if connection gone."""
    await ws.send_text(json.dumps(obj, cls=DecimalEncoder))


@router.websocket("/ws-user")
async def user_ws(ws: WebSocket):
    """
    WebSocket endpoint for user data stream subscribe/unsubscribe.

    Subscribe messages (required):
      {
        "id": "<uuid>",
        "method": "userDataStream.subscribe.signature",
        "params": { "apiKey": "..." }
      }

    Unsubscribe:
      { "id": "<same-uuid>", "method": "userDataStream.unsubscribe" }

    Exchange integration (you implement):
      exchange.register_user_listener(api_key: str, queue: asyncio.Queue) -> None
      exchange.unregister_user_listener(api_key: str, queue: asyncio.Queue) -> None

    Forwarded message format to client:
      {
        "subscriptionId": <int>,
        "event": { ... executionReport ... }
      }
    """
    await ws.accept()
    client = getattr(ws, "client", None)
    logger.info("User WS connected: %s", client)

    # subs: client_sub_key (msg['id']) -> (queue, task, subscription_int_id, api_key)
    subs: Dict[str, Tuple[asyncio.Queue, asyncio.Task, int, str]] = {}
    next_sub_id = 0

    # event to notify forwarders to exit
    connection_closed = asyncio.Event()

    async def forwarder_loop(client_sub_key: str, sub_id: int, q: asyncio.Queue):
        """Forward events from exchange queue to the websocket."""
        try:
            while not connection_closed.is_set():
                try:
                    event = await asyncio.wait_for(q.get(), timeout=1)
                except asyncio.TimeoutError:
                    continue
                payload = {"subscriptionId": sub_id, "event": event}
                try:
                    await _send_json_safe(ws, payload)
                    logger.debug(
                        "Sent user event to client_sub_key=%s sub_id=%s type=%s",
                        client_sub_key,
                        sub_id,
                        (event.get("e") if isinstance(event, dict) else None),
                    )
                except Exception:
                    logger.exception(
                        "Failed to send user event to client_sub_key=%s sub_id=%s",
                        client_sub_key,
                        sub_id,
                    )
                    break
        except asyncio.CancelledError:
            logger.debug(
                "Forwarder cancelled for client_sub_key=%s sub_id=%s",
                client_sub_key,
                sub_id,
            )
        finally:
            logger.info(
                "Forwarder exiting for client_sub_key=%s sub_id=%s",
                client_sub_key,
                sub_id,
            )

    try:
        while True:
            # receive_json raises if not JSON; let it bubble to outer except to clean up
            msg = await ws.receive_json()

            method: Optional[str] = msg.get("method")
            client_sub_key: Optional[str] = msg.get(
                "id"
            )  # used as clients' subscription key / for unsubscribe
            params: dict = msg.get("params", {})

            # validate id present
            if not client_sub_key:
                await _send_json_safe(ws, {"error": "missing id"})
                continue

            # ---------------------------
            # SUBSCRIBE (signature form)
            # ---------------------------
            if method == "userDataStream.subscribe.signature":
                api_key = None
                # params must be an object containing apiKey
                if isinstance(params, dict):
                    api_key = params.get("apiKey")

                if not api_key:
                    await _send_json_safe(
                        ws,
                        {"id": client_sub_key, "error": "apiKey is required in params"},
                    )
                    continue

                # ack subscribe
                await _send_json_safe(ws, {"result": None, "id": client_sub_key})

                # if already subscribed with same client_sub_key, ignore
                if client_sub_key in subs:
                    logger.info(
                        "Already subscribed (client_sub_key=%s)", client_sub_key
                    )
                    continue

                # create queue and register with exchange (you must implement register_user_listener)
                q: asyncio.Queue = asyncio.Queue(maxsize=512)
                try:
                    exchange.register_user_listener(api_key, q)
                    print("Registered user listener for api_key=", api_key)
                except Exception as e:
                    logger.exception(
                        "register_user_listener failed for api_key=%s: %s", api_key, e
                    )
                    await _send_json_safe(
                        ws, {"id": client_sub_key, "error": f"register_error: {str(e)}"}
                    )
                    continue

                # assign numeric subscription id per-connection
                sub_id = next_sub_id
                next_sub_id += 1

                # start forwarder
                task = asyncio.create_task(forwarder_loop(client_sub_key, sub_id, q))
                subs[client_sub_key] = (q, task, sub_id, api_key)
                logger.info(
                    "Subscribed user stream client_sub_key=%s sub_id=%s api_key=%s",
                    client_sub_key,
                    sub_id,
                    api_key,
                )
                continue

            # ---------------------------
            # UNSUBSCRIBE
            # ---------------------------
            if method == "userDataStream.unsubscribe":
                # ack
                await _send_json_safe(ws, {"result": None, "id": client_sub_key})
                pair = subs.pop(client_sub_key, None)
                if pair:
                    q, task, sub_id, api_key = pair
                    try:
                        exchange.unregister_user_listener(api_key, q)
                    except Exception:
                        logger.exception(
                            "Failed to unregister_user_listener for api_key=%s", api_key
                        )
                    task.cancel()
                    logger.info(
                        "Unsubscribed client_sub_key=%s sub_id=%s api_key=%s",
                        client_sub_key,
                        sub_id,
                        api_key,
                    )
                else:
                    logger.debug(
                        "Unsubscribe for unknown client_sub_key=%s", client_sub_key
                    )
                continue

            # ---------------------------
            # ping/pong variants
            # ---------------------------
            if (isinstance(method, str) and method.upper() == "PING") or (
                "ping" in msg
            ):
                pong_val = (
                    int(time.time() * 1000)
                    if (isinstance(method, str) and method.upper() == "PING")
                    else msg.get("ping")
                )
                await _send_json_safe(ws, {"pong": pong_val})
                continue

            # unknown method
            await _send_json_safe(ws, {"error": "unknown_method", "msg": msg})

    except WebSocketDisconnect:
        logger.info("User WS disconnected: %s", client)
        connection_closed.set()
        # cleanup all subscriptions
        for client_sub_key, (q, task, sub_id, api_key) in list(subs.items()):
            try:
                exchange.unregister_user_listener(api_key, q)
            except Exception:
                logger.exception(
                    "Error unregistering user listener for api_key=%s", api_key
                )
            task.cancel()
        subs.clear()
    except Exception:
        logger.exception("Unexpected error in user_ws; cleaning up")
        connection_closed.set()
        for client_sub_key, (q, task, sub_id, api_key) in list(subs.items()):
            try:
                exchange.unregister_user_listener(api_key, q)
            except Exception:
                logger.exception(
                    "Error unregistering user listener for api_key=%s", api_key
                )
            task.cancel()
        subs.clear()
        try:
            await ws.close()
        except Exception:
            pass
