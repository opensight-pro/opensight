# ws_depth.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Tuple, Optional, Any
import asyncio
import json
import re
import time
import logging
from exchange import (exchange, DepthQuery)


logger = logging.getLogger("app.ws_depth")

router = APIRouter(prefix="", tags=["market-data-ws"])

# parse "SYMBOL@depth" or "SYMBOL@depthN"
DEPTH_RE = re.compile(r"^([A-Za-z0-9]{1,20})@depth(?:([0-9]+))?$")


class Subscription:
    def __init__(self, symbol: str, levels: Optional[int]):
        self.symbol = symbol.upper()
        self.levels = levels

    def key(self) -> Tuple[str, Optional[int]]:
        return (self.symbol, self.levels)

    def __hash__(self):
        return hash(self.key())

    def __eq__(self, other):
        return isinstance(other, Subscription) and self.key() == other.key()

    def __repr__(self):
        return f"Subscription(symbol={self.symbol}, levels={self.levels})"


async def _send_json_safe(ws: WebSocket, obj: Any):
    """Send JSON to websocket; raise to trigger cleanup if connection gone."""
    await ws.send_text(json.dumps(obj))


@router.websocket("/ws")
async def depth_ws_pubsub(ws: WebSocket):
    """
    WebSocket endpoint implementing Binance-like SUBSCRIBE/UNSUBSCRIBE,
    using either snapshot polling (when levels specified) or diff queue (when no levels).
    """
    await ws.accept()

    # Active subscriptions: Subscription -> (queue_or_none, task)
    # - For diff subscriptions: queue is asyncio.Queue, task forwards queue -> ws
    # - For snapshot subscriptions: queue is None, task polls exchange.get_depth every 1s and sends
    subs_tasks: Dict[Subscription, Tuple[Optional[asyncio.Queue], asyncio.Task]] = {}
    # Helper event to cancel all forwarders on disconnect
    connection_closed = asyncio.Event()

    async def forward_from_queue_loop(sub: Subscription, q: asyncio.Queue):
        """Forward incoming diffs from queue to websocket until unsubscribed or connection_closed."""
        try:
            while not connection_closed.is_set():
                try:
                    diff = await asyncio.wait_for(q.get(), timeout=1.0)
                    print(diff)
                except asyncio.TimeoutError:
                    continue
                try:
                    await _send_json_safe(ws, diff)
                except Exception:
                    break
        except asyncio.CancelledError:
            pass

    async def snapshot_poller_loop(sub: Subscription, poll_interval: float = 1.0, req_id: Optional[int] = None):
        """
        Poll exchange.get_depth every poll_interval seconds and forward snapshots.
        Sends an initial snapshot immediately (if available) before polling.
        """
        symbol = sub.symbol
        levels = sub.levels
        try:
            # send initial snapshot
            try:
                snapshot = exchange.get_depth(DepthQuery(symbol=symbol, limit=levels))
                if snapshot is not None:
                    await _send_json_safe(ws, snapshot.model_dump())
            except Exception as e:
                # don't abort: notify and continue polling
                await _send_json_safe(ws, {"error": f"snapshot_error_initial: {str(e)}", "id": req_id})

            # polling loop
            while not connection_closed.is_set():
                await asyncio.sleep(poll_interval)
                try:
                    snapshot = exchange.get_depth(DepthQuery(symbol=symbol, limit=levels))
                    if snapshot is not None:
                        await _send_json_safe(ws, snapshot.model_dump())
                except Exception as e:
                    # send error but keep polling — transient internal errors should not kill the loop
                    try:
                        await _send_json_safe(ws, {"error": f"snapshot_error_poll: {str(e)}", "id": req_id})
                    except Exception:
                        break
        except asyncio.CancelledError:
            pass

    async def do_subscribe(sub: Subscription, req_id: Optional[int]):
        print(f"Subscription... {sub}")
        # Binance-like immediate ack
        if req_id is not None:
            await _send_json_safe(ws, {"result": None, "id": req_id})

        # If subscription has levels -> snapshot polling mode
        if sub.levels is not None:
            # start snapshot poller task
            task = asyncio.create_task(snapshot_poller_loop(sub, poll_interval=1.0, req_id=req_id))
            subs_tasks[sub] = (None, task)
            return

        # Otherwise -> diff mode: create queue and register with exchange
        q: asyncio.Queue = asyncio.Queue()
        try:
            exchange.register_diff_listener(sub.symbol, q)
        except Exception as e:
            await _send_json_safe(ws, {"error": f"register_error: {str(e)}", "id": req_id})
            return

        task = asyncio.create_task(forward_from_queue_loop(sub, q))
        subs_tasks[sub] = (q, task)

    async def do_unsubscribe(sub: Subscription, req_id: Optional[int]):
        pair = subs_tasks.pop(sub, None)
        if pair:
            q, task = pair
            # If diff listener, unregister the queue
            if q is not None:
                try:
                    exchange.unregister_diff_listener(sub.symbol, q)
                except Exception:
                    pass
            # cancel forwarder / poller
            task.cancel()
        # ack the unsubscribe
        if req_id is not None:
            await _send_json_safe(ws, {"result": None, "id": req_id})

    try:
        while True:
            text = await ws.receive_text()
            try:
                msg = json.loads(text)
            except json.JSONDecodeError:
                await _send_json_safe(ws, {"error": "invalid_json"})
                continue

            # handle ping/pong variants
            if isinstance(msg, dict) and msg.get("method", "").upper() == "PING":
                await _send_json_safe(ws, {"pong": int(time.time() * 1000)})
                continue
            if "ping" in msg:
                await _send_json_safe(ws, {"pong": msg["ping"]})
                continue

            method = msg.get("method", "").upper()
            params = msg.get("params", [])
            req_id = msg.get("id", None)

            if method == "SUBSCRIBE":
                for p in params:
                    if not isinstance(p, str):
                        continue
                    m = DEPTH_RE.match(p)
                    if not m:
                        continue
                    symbol = m.group(1)
                    levels_raw = m.group(2)
                    levels = int(levels_raw) if levels_raw else None
                    sub = Subscription(symbol, levels)
                    if sub in subs_tasks:
                        # already subscribed
                        continue
                    # start subscription flow in background
                    asyncio.create_task(do_subscribe(sub, req_id))
                continue

            if method == "UNSUBSCRIBE":
                for p in params:
                    if not isinstance(p, str):
                        continue
                    m = DEPTH_RE.match(p)
                    if not m:
                        continue
                    symbol = m.group(1)
                    levels_raw = m.group(2)
                    levels = int(levels_raw) if levels_raw else None
                    sub = Subscription(symbol, levels)
                    await do_unsubscribe(sub, req_id)
                continue

            # unknown method -> reply error
            await _send_json_safe(ws, {"error": "unknown_method", "msg": msg})
    except WebSocketDisconnect:
        # client disconnected -> cleanup
        connection_closed.set()
        for sub, (q, task) in list(subs_tasks.items()):
            try:
                if q is not None:
                    exchange.unregister_diff_listener(sub.symbol, q)
            except Exception:
                pass
            task.cancel()
        subs_tasks.clear()
    except Exception:
        # on unexpected errors ensure cleanup
        connection_closed.set()
        for sub, (q, task) in list(subs_tasks.items()):
            try:
                if q is not None:
                    exchange.unregister_diff_listener(sub.symbol, q)
            except Exception:
                pass
            task.cancel()
        subs_tasks.clear()
        try:
            await ws.close()
        except Exception:
            pass
