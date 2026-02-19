from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.types import ASGIApp
from starlette.responses import JSONResponse
from urllib.parse import parse_qs
import json
import logging

logger = logging.getLogger("BodyAutoDetectMiddleware")
logger.setLevel(logging.INFO)


class BodyAutoDetectMiddleware(BaseHTTPMiddleware):

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):

        # Only process requests that are expected to have a body
        if request.method not in ["POST", "PUT", "DELETE"]:
            return await call_next(request)

        # 1. Read the raw body bytes (consumes the stream temporarily)
        original_body_bytes = await request.body()

        if not original_body_bytes:
            # No body, nothing to do. Proceed.
            return await call_next(request)

        body_str = original_body_bytes.decode("utf-8")

        # Determine if the body needs transformation
        needs_transform = True

        # --- Attempt 1: Check if the body is already valid JSON ---
        try:
            # If this succeeds, the body is already JSON.
            # We don't need to parse it, just ensure the header is right.
            json.loads(body_str)
            needs_transform = False
            logger.info("Auto-Detect: Body is already valid JSON. Bypassing transform.")

        except json.JSONDecodeError:
            # If decoding fails, it's not JSON. We assume it's URL-encoded data.
            logger.info(
                "Auto-Detect: Body is NOT JSON. Attempting URL-encoded transform."
            )
            pass  # Keep needs_transform = True

        # --- Attempt 2: Transform URL-encoded data if needed ---
        if needs_transform:
            try:
                # Parse the key=value&key2=value2 string
                parsed_dict_lists = parse_qs(body_str)

                # Flatten the dictionary: {'key': ['value']} -> {'key': 'value'}
                payload_dict = {k: v[0] for k, v in parsed_dict_lists.items()}

                # Convert the dictionary back to JSON bytes
                json_bytes = json.dumps(payload_dict).encode("utf-8")

                # OVERWRITE the request scope's body and content-type
                request._body = json_bytes

                # Update headers to officially mark it as application/json
                request.scope["headers"] = [
                    (k.lower().encode(), v.encode())
                    for k, v in dict(request.headers).items()
                    if k.lower() != "content-type"
                ] + [(b"content-type", b"application/json")]

                logger.info(
                    "Auto-Detect: Successfully transformed URL-encoded body to application/json."
                )

            except Exception as e:
                # If parsing/transforming fails, reset the body to the original
                # and let the request proceed to fail gracefully at the Pydantic level.
                logger.error(
                    f"Auto-Detect Error during URL-encoded transform: {e}. Resetting body."
                )
                request._body = original_body_bytes

        else:
            # If it was already JSON, we just need to reset the body
            # so the stream is available for the route handler.
            request._body = original_body_bytes

        try:
            # Process the request with the (potentially modified) body
            response = await call_next(request)
            return response
        except Exception as e:
            logger.error(f"Middleware caught exception: {e}")
            return JSONResponse(status_code=400, content={"detail": str(e)})
