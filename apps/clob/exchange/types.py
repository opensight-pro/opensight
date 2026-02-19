from enum import Enum
from typing import Optional
from decimal import Decimal
from fastlob.order import Order
from fastlob import OrderSide as LobOrderSide
from fastlob.result import ExecutionResult
from pydantic import BaseModel
from fastlob.trade import Trade
from account import SpotAccount
import time


class OrderSide(Enum):
    BUY = "BUY"
    SELL = "SELL"


class OrderType(Enum):
    LIMIT_MAKER = "LIMIT_MAKER"
    MARKET = "MARKET"


class NewOrderRequest(BaseModel):
    newClientOrderId: Optional[str] = None
    symbol: str
    side: OrderSide
    type: OrderType
    quantity: Decimal
    price: Optional[Decimal] = None


class CancelOrderRequest(BaseModel):
    symbol: str
    orderId: Optional[int] = None
    origClientOrderId: Optional[str] = None


class CancelAllRequest(BaseModel):
    symbol: str


class CancelReplaceRequest(BaseModel):
    symbol: str
    side: OrderSide
    type: OrderType
    quantity: Optional[Decimal] = None
    price: Optional[Decimal] = None
    cancelOrderId: Optional[int] = None
    newClientOrderId: Optional[str] = None
    cancelOrigClientOrderId: Optional[str] = None


class OrderResponseAck(BaseModel):
    symbol: str
    orderId: int
    orderListId: int
    clientOrderId: str
    transactTime: int


class FillResponse(BaseModel):
    price: str
    qty: str
    commission: str
    commissionAsset: str
    tradeId: int


class OrderResponseResult(OrderResponseAck):
    clientId: str
    origClientOrderId: str
    price: str
    origQty: str
    executedQty: str
    origQuoteOrderQty: str
    cummulativeQuoteQty: str
    status: str
    timeInForce: str
    type: str
    side: str
    selfTradePreventionMode: str


class OrderResponseFull(OrderResponseResult):
    fills: list[FillResponse] = []


class CancelReplaceResponse(BaseModel):
    cancelResult: str
    newOrderResult: str
    cancelResponse: OrderResponseAck
    newOrderResponse: OrderResponseAck


def get_fastlob_order_response(
    symbol: str,
    order: Order,
    result: Optional[ExecutionResult] = None,
    type: Optional[OrderType] = None,
):
    fills: list[FillResponse] = []
    if result:
        exec_prices = result._execprices
        if exec_prices:
            for price, qty in exec_prices.items():
                fills.append(
                    FillResponse(
                        price=str(price),
                        qty=str(qty),
                        commission="0",
                        commissionAsset="USDT",
                        tradeId=0,
                    )
                )
    return OrderResponseResult(
        clientId=order.client_id(),
        symbol=symbol,
        orderId=order.id(),
        orderListId=-1,
        clientOrderId=order.client_order_id(),
        transactTime=order._time,
        origClientOrderId=order.client_order_id(),
        price=str(order.price()),
        origQty=str(order._org_quantity),
        executedQty=str(order._org_quantity - order._quantity),
        origQuoteOrderQty=str(order._orig_quote_qty),
        cummulativeQuoteQty=str(order._cummulative_quote_qty),
        timeInForce="GTC",
        side="BUY" if order.side() == LobOrderSide.BID else "SELL",
        selfTradePreventionMode="NONE",
        fills=fills,
        status=order.status().value,
        type=type if type else OrderType.LIMIT_MAKER,
    )


class OrderQuery(BaseModel):
    symbol: str
    orderId: Optional[int] = None
    origClientOrderId: Optional[str] = None


class CurrentOpenOrdersQuery(BaseModel):
    symbol: str


class AllOrdersQuery(BaseModel):
    symbol: str


class DepthQuery(BaseModel):
    symbol: str
    limit: int = 10


class TradesQuery(BaseModel):
    symbol: str
    orderId: Optional[int] = None
    startTime: Optional[int] = None
    endTime: Optional[int] = None


class KlineQuery(BaseModel):
    symbol: str
    interval: str
    startTime: Optional[int] = None
    endTime: Optional[int] = None
    limit: int = 10


class DepthResponse(BaseModel):
    lastUpdateId: int
    bids: list[tuple[str, str]]
    asks: list[tuple[str, str]]


class TradeResponse(BaseModel):
    symbol: str
    id: int
    orderId: int
    orderListId: int
    price: str
    qty: str
    quoteQty: str
    comission: str
    comissionAsset: str
    time: int
    isBuyer: bool
    isMaker: bool
    isBestMatch: bool


def to_trade_response(symbol: str, trade: Trade) -> TradeResponse:
    return TradeResponse(
        symbol=symbol,
        id=trade.id(),
        orderId=trade.order_id(),
        orderListId=-1,
        price=str(trade.price()),
        qty=str(trade.quantity()),
        quoteQty=str(trade.quote_qty()),
        comission="0",
        comissionAsset=symbol.split("USDT")[0],
        time=trade._time,
        isBuyer=trade.is_buyer(),
        isMaker=trade.is_maker(),
        isBestMatch=True,
    )


def to_execution_report_ws(order: OrderResponseResult):
    """
    Convert OrderResponseResult (REST) to Binance-style executionReport WS event.
    """

    return {
        "e": "executionReport",
        "E": order.transactTime,  # event time
        "s": order.symbol,  # symbol
        "c": order.clientOrderId,  # client order id
        "S": order.side,  # BUY / SELL
        "o": order.type,  # LIMIT / MARKET ...
        "f": order.timeInForce,  # GTC / IOC ...
        "q": order.origQty,  # order quantity
        "p": order.price,  # order price
        # --- fields not in REST response → default to 0 / null ---
        "P": "0.00000000",  # stop price
        "F": "0.00000000",  # iceberg qty
        "g": order.orderListId,  # orderListId
        "C": order.origClientOrderId,  # original client order ID
        "x": (
            "TRADE" if order.status in ["FILLED", "PARTIAL_FILLED"] else order.status
        ),  # execution type (REST cannot tell → default NEW)
        "X": order.status,  # status: NEW, FILLED, PARTIALLY_FILLED ...
        "r": "NONE",  # reject reason
        "i": order.orderId,  # order ID
        "l": "0.00000000",  # last executed qty (REST doesn’t give → default 0)
        "z": order.executedQty,  # cumulative filled qty
        "L": "0.00000000",  # last executed price (REST doesn’t give → 0)
        "n": "0",  # commission amount
        "N": None,  # commission asset
        "T": order.transactTime,  # transaction time
        "t": -1,  # trade ID
        "v": 0,  # prevented match ID
        "I": order.orderId,  # execution id (use orderId)
        "w": True,  # order on book?
        "m": False,  # maker?
        "M": False,  # ignore
        "O": order.transactTime,  # order creation time
        "Z": order.cummulativeQuoteQty,  # cumulative quote executed qty
        "Y": "0.00000000",  # last quote executed qty
        "Q": order.origQuoteOrderQty,  # quote order quantity
        "W": order.transactTime,  # working time
        "V": order.selfTradePreventionMode,  # STP Mode
    }


def to_outbound_account_position_ws(account: SpotAccount, assets: list[str]):
    now = int(time.time() * 1000)
    B = []
    for a in assets:
        balance = account.get_balance(a)
        f = balance.available
        l = balance.reserved
        B.append({"a": a, "f": f, "l": l})
    return {"e": "outboundAccountPosition", "E": now, "u": now, "B": B}


def interval_to_milliseconds(interval: str) -> int:
    if interval == "1m":
        return 60 * 1000
    elif interval == "3m":
        return 3 * 60 * 1000
    elif interval == "5m":
        return 5 * 60 * 1000
    elif interval == "15m":
        return 15 * 60 * 1000
    elif interval == "1h":
        return 60 * 60 * 1000
    elif interval == "1d":
        return 24 * 60 * 60 * 1000
    else:
        raise ValueError(f"Invalid interval: {interval}")
