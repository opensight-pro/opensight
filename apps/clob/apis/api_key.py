from fastapi import Security, HTTPException
from fastapi.security import APIKeyHeader

API_KEY_NAME = "X-API-Key"

api_key_header = APIKeyHeader(name=API_KEY_NAME)


async def get_api_key(api_key_header_value: str = Security(api_key_header)):
    if not api_key_header_value:
        raise HTTPException(status_code=403, detail="API key missing")
    return api_key_header_value
