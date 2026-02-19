from fastapi import APIRouter, Depends
from exchange import (
    exchange,
    DepthQuery,
    CurrentOpenOrdersQuery,
    TradesQuery,
    CancelAllRequest,
    AllOrdersQuery,
    KlineQuery,
)
from typing import Optional
from pydantic import BaseModel
import time
from fastapi import Query
from starlette.responses import JSONResponse
from apis.api_key import get_api_key

router = APIRouter(
    prefix="",
    tags=["market-data"],
    responses={404: {"description": "Not found"}},
)


class NewBookRequest(BaseModel):
    symbol: str


@router.post("/new_book")
async def create_new_spot(request: NewBookRequest):
    try:
        exchange.new_book(request.symbol)
        return True
    except Exception as e:
        return JSONResponse(status_code=400, content=str(e))


@router.get("/ping")
async def ping():
    try:
        return {}
    except Exception as e:
        return JSONResponse(status_code=400, content=str(e))


@router.get("/time")
async def get_time():
    try:
        return {"serverTime": int(time.time() * 1000)}
    except Exception as e:
        return JSONResponse(status_code=400, content=str(e))


class ExchangeInfoQuery(BaseModel):
    symbol: Optional[str] = Query(None, description="Single symbol to query")
    symbols: Optional[str] = Query(None, description="List of symbols to query")


@router.get("/exchangeInfo")
async def get_exchange_info(query_params: ExchangeInfoQuery = Depends()):
    try:
        if query_params.symbols:
            # parse this: ["BTCUSDT"] to list
            symbols = (
                query_params.symbols.replace("[", "")
                .replace("]", "")
                .replace('"', "")
                .split(",")
            )
        elif query_params.symbol:
            symbols = [query_params.symbol]
        else:
            symbols = list(exchange._books.keys())

        server_time = int(time.time() * 1000)
        return {
            "timezone": "UTC",
            "serverTime": server_time,
            "rateLimits": [],
            "exchangeFilters": [],
            "symbols": [
                {
                    "symbol": symbol,
                    "status": "TRADING",
                    "baseAsset": symbol.replace("USDT", ""),
                    "baseAssetPrecision": 8,
                    "quoteAsset": "USDT",
                    "quotePrecision": 8,
                    "quoteAssetPrecision": 8,
                    "baseCommissionPrecision": 8,
                    "quoteCommissionPrecision": 8,
                    "orderTypes": [
                        "LIMIT",
                        "LIMIT_MAKER",
                        "MARKET",
                        "STOP_LOSS",
                        "STOP_LOSS_LIMIT",
                        "TAKE_PROFIT",
                        "TAKE_PROFIT_LIMIT",
                    ],
                    "filters": [
                        {
                            "filterType": "PRICE_FILTER",
                            "minPrice": "0.00000100",
                            "maxPrice": "100000.00000000",
                            "tickSize": "0.00000100",
                        },
                        {
                            "filterType": "LOT_SIZE",
                            "minQty": "0.00100000",
                            "maxQty": "100000.00000000",
                            "stepSize": "0.00100000",
                        },
                        {"filterType": "MIN_NOTIONAL", "minNotional": "0.00100000"},
                    ],
                    "icebergAllowed": True,
                    "ocoAllowed": True,
                    "otoAllowed": True,
                    "opoAllowed": True,
                    "quoteOrderQtyMarketAllowed": True,
                    "allowTrailingStop": False,
                    "cancelReplaceAllowed": False,
                    "amendAllowed": False,
                    "pegInstructionsAllowed": True,
                    "isSpotTradingAllowed": True,
                    "isMarginTradingAllowed": True,
                    "permissions": [],
                    "permissionSets": [["SPOT", "MARGIN"]],
                    "defaultSelfTradePreventionMode": "NONE",
                    "allowedSelfTradePreventionModes": ["NONE"],
                }
                for symbol in symbols
            ],
            "sors": [{"baseAsset": symbol, "symbols": [symbol]} for symbol in symbols],
        }
    except Exception as e:
        return JSONResponse(status_code=400, content=str(e))


@router.get("/depth")
async def get_depth(query_params: DepthQuery = Depends()):
    try:
        return exchange.get_depth(query_params)
    except Exception as e:
        return JSONResponse(status_code=400, content=str(e))


@router.get("/klines")
async def get_klines(query_params: KlineQuery = Depends()):
    try:
        return exchange.klines(query_params)
    except Exception as e:
        return JSONResponse(status_code=400, content=str(e))


@router.get("/openOrders")
async def get_open_orders(
    query_params: CurrentOpenOrdersQuery = Depends(),
    client_id: str = Depends(get_api_key),
):
    try:
        return exchange.all_open_orders(client_id, query_params)
    except Exception as e:
        return JSONResponse(status_code=400, content=str(e))


@router.get("/myTrades")
async def get_trades(
    query_params: TradesQuery = Depends(),
    client_id: str = Depends(get_api_key),
):
    try:
        return exchange.get_trades(client_id, query_params)
    except Exception as e:
        return JSONResponse(status_code=400, content=str(e))


@router.delete("/openOrders")
async def cancel_all(request: CancelAllRequest, client_id: str = Depends(get_api_key)):
    try:
        return exchange.cancel_all(client_id, request)
    except Exception as e:
        return JSONResponse(status_code=400, content=str(e))


@router.get("/allOrders")
async def get_all_orders(
    query_params: AllOrdersQuery = Depends(), client_id: str = Depends(get_api_key)
):
    try:
        return exchange.all_orders(client_id, query_params)
    except Exception as e:
        return JSONResponse(status_code=400, content=str(e))


@router.delete("/reset")
async def reset():
    try:
        exchange.reset()
        return True
    except Exception as e:
        return JSONResponse(status_code=400, content=str(e))
