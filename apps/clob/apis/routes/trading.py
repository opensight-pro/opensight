from fastapi import APIRouter, Depends
from exchange import (
    exchange,
    NewOrderRequest,
    CancelOrderRequest,
    CancelReplaceRequest,
    OrderQuery,
)
from starlette.responses import JSONResponse
from apis.api_key import get_api_key

router = APIRouter(
    prefix="/order",
    tags=["trading"],
    responses={404: {"description": "Not found"}},
)


@router.post("")
async def new_order(request: NewOrderRequest, client_id: str = Depends(get_api_key)):
    try:
        print("Post payload: ")
        print(request.model_dump_json(indent=2))
        return exchange.new_order(client_id, request)
    except Exception as e:
        print(f"POST Error {str(e)}")
        return JSONResponse(status_code=400, content=str(e))


@router.get("")
async def get_order(query_params: OrderQuery = Depends()):
    try:
        return exchange.get_order(query_params)
    except Exception as e:
        return JSONResponse(status_code=400, content=str(e))


@router.delete("")
async def cancel(query_params: CancelOrderRequest = Depends()):
    try:
        print("Cancel payload: ")
        print(query_params.model_dump_json(indent=2))
        return exchange.cancel_order(query_params)
    except Exception as e:
        print(f"Del Error {str(e)}")
        return JSONResponse(status_code=400, content=str(e))


@router.post("/cancelReplace")
async def cancel_replace(
    request: CancelReplaceRequest, client_id: str = Depends(get_api_key)
):
    try:
        print("Cancel request payload:")
        print(request.model_dump_json(indent=2))
        return exchange.cancel_replace(client_id, request)
    except Exception as e:
        print(f"CR Error {str(e)}")
        return JSONResponse(status_code=400, content=str(e))
