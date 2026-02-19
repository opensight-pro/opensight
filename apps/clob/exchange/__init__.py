from fastlob import Orderbook, OrderParams, OrderSide as LobOrderSide, OrderStatus
from decimal import Decimal
from .types import (
    OrderSide,
    NewOrderRequest,
    CancelOrderRequest,
    CancelReplaceRequest,
    OrderType,
    CancelReplaceResponse,
    CurrentOpenOrdersQuery,
    OrderQuery,
    AllOrdersQuery,
    DepthQuery,
    DepthResponse,
    CancelAllRequest,
    OrderResponseResult,
    get_fastlob_order_response,
    to_execution_report_ws,
    to_outbound_account_position_ws,
    to_trade_response,
    TradesQuery,
    TradeResponse,
    KlineQuery,
    interval_to_milliseconds,
)
from account import get_account, reset_accounts
from typing import Dict, Set
import asyncio
import time


def get_market_price(side: LobOrderSide):
    return Decimal("100000000") if side == LobOrderSide.BID else Decimal("0.001")


class _Exchange:
    _books: dict[str, Orderbook]

    def __init__(self):
        self._books = {}
        # listeners: mapping (symbol, levels) -> set of asyncio.Queue
        # levels is Optional[int] where None represents "symbol@depth" (no level limit)
        self._depth_listeners: Dict[str, Set[asyncio.Queue]] = {}
        self._user_listeners: Dict[str, asyncio.Queue] = {}
        # per-symbol monotonically increasing update id for depth updates
        self._update_id: Dict[str, int] = {}

    def new_book(self, symbol: str):
        if not self._books.get(symbol):
            self._books[symbol] = Orderbook(symbol, True)
            self._update_id[symbol] = int(time.time() * 1000)

    def deposit(self, client_id: str, asset: str, amount: Decimal):
        get_account(client_id).get_balance(asset).on_deposit(amount)
        self._emit_balance_update(client_id=client_id, symbol=asset + "USDT")

    def withdraw(self, client_id: str, asset: str, amount: Decimal):
        get_account(client_id).get_balance(asset).on_withdraw(amount)
        self._emit_balance_update(client_id=client_id, symbol=asset + "USDT")

    # -------------------------
    # Pub/Sub listener methods
    # -------------------------
    def register_user_listener(self, client_id: str, queue: asyncio.Queue) -> None:
        key = client_id
        if key not in self._user_listeners:
            self._user_listeners[key] = queue

    def unregister_user_listener(self, client_id: str) -> None:
        key = client_id
        q = self._user_listeners.get(key)
        if not q:
            return
        self._user_listeners.pop(key, None)

    def register_diff_listener(self, symbol: str, queue: asyncio.Queue) -> None:
        """
        Register an asyncio.Queue to receive depth diffs for (symbol, levels).
        The queue should be consumer-owned; the exchange will put dicts into it.
        """
        key = symbol.upper()
        if key not in self._depth_listeners:
            self._depth_listeners[key] = set()
        self._depth_listeners[key].add(queue)

    def unregister_diff_listener(self, symbol: str, queue: asyncio.Queue) -> None:
        """
        Unregister previously-registered queue. Safe to call even if not present.
        """
        key = symbol.upper()
        qs = self._depth_listeners.get(key)
        if not qs:
            return
        qs.discard(queue)
        if not qs:
            # remove empty set
            self._depth_listeners.pop(key, None)

    def _emit_depth_update_for_symbol(
        self, symbol: str, bids: list[tuple[str, str]], asks: list[tuple[str, str]]
    ):
        try:

            # increment update id
            prev_id = self._update_id.get(symbol, int(time.time() * 1000))
            new_id = prev_id + 1
            self._update_id[symbol] = new_id

            # For each listener, prepare its tailored payload and push to its queues
            queues = self._depth_listeners.get(symbol, set())
            if not queues:
                return

                # Build depthUpdate event matching Binance-like shape
            diff_event = {
                "e": "depthUpdate",
                "E": int(time.time() * 1000),  # event time in ms
                "s": symbol,
                "U": prev_id + 1,  # first update id in this event
                "u": new_id,  # final update id in this event
                "b": bids,
                "a": asks,
            }

            # put on each queue (non-blocking)
            for q in list(queues):
                try:
                    q.put_nowait(diff_event)
                except asyncio.QueueFull:
                    # drop the update for this consumer to avoid blocking engine
                    # optionally: log or count dropped updates
                    pass
                except Exception:
                    # if the queue is invalid or closed, remove it
                    queues.discard(q)

            # clean empty sets
            if not queues:
                self._depth_listeners.pop(symbol, None)
        except Exception as e:
            print(f"Failed to push book diff event: {str(e)}")

    def _emit_balance_update(self, client_id: str, symbol: str):
        base = symbol.split("USDT")[0]
        quote = "USDT"
        event = to_outbound_account_position_ws(get_account(client_id), [base, quote])
        queue = self._user_listeners.get(client_id)
        if not queue:
            return
        print(f"Emitting balance update {event} to client_id={client_id}")
        try:
            queue.put_nowait(event)
        except asyncio.QueueFull:
            print(f"Queue full for client_id={client_id}, clearing queue")
            while not queue.empty():
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    break
            queue.put_nowait(event)

    def _emit_order_update(self, orders: list[OrderResponseResult]):
        try:
            # --- Deduplicate by order.orderid ---
            unique_orders: dict[int, OrderResponseResult] = {}
            for o in orders:
                unique_orders[o.orderId] = o  # Keeps last occurrence

            for order in unique_orders.values():
                queue = self._user_listeners.get(order.clientId)
                if not queue:
                    continue

                # Build executionReport message
                event = to_execution_report_ws(order)
                print(f"Emitting order update {event} to client_id={order.clientId}")
                try:
                    queue.put_nowait(event)
                except asyncio.QueueFull:
                    print(f"Queue full for client_id={order.clientId}, clearing queue")
                    while not queue.empty():
                        try:
                            queue.get_nowait()
                        except asyncio.QueueEmpty:
                            break
                    queue.put_nowait(event)

        except Exception as e:
            print(f"Failed to push order event: {str(e)}")

    def _collect_bids_asks(self, prices: set[Decimal], book: Orderbook):
        bids: list[tuple[str, str]] = []
        asks: list[tuple[str, str]] = []
        for price in prices:
            bid = book.get_bid(price)
            if bid:
                bids.append([str(bid.price()), str(bid.volume())])
            ask = book.get_ask(price)
            if ask:
                asks.append([str(ask.price()), str(ask.volume())])

        return bids, asks

    def _collect_orders(
        self, symbol: str, prices: set[Decimal], book: Orderbook
    ) -> list[OrderResponseResult]:
        return [
            get_fastlob_order_response(symbol, order)
            for order in book._orders.values()
            if order.price() in prices
        ]

    def new_order(self, client_id: str, request: NewOrderRequest):
        side = LobOrderSide.BID if request.side == OrderSide.BUY else LobOrderSide.ASK
        order_params = OrderParams(
            client_id=client_id,
            client_order_id=request.newClientOrderId,
            side=side,
            price=(
                request.price
                if request.type == OrderType.LIMIT_MAKER
                else get_market_price(side)
            ),
            quantity=request.quantity,
            is_market=request.type == OrderType.MARKET,
        )

        book = self._books[request.symbol]
        res = book.process(orderparams=order_params)
        if not res.success():
            raise Exception(res.messages()[0])

        order_id = res.orderid()
        order = book.get_order_by_id(orderid=order_id)

        prices: set[Decimal] = set([])
        if request.price:
            prices.add(request.price)

        exec_prices = res._execprices

        if exec_prices:
            for price in exec_prices.keys():
                prices.add(price)

        bids, asks = self._collect_bids_asks(prices, book)

        self._emit_depth_update_for_symbol(
            symbol=request.symbol,
            bids=bids,
            asks=asks,
        )

        orders = self._collect_orders(request.symbol, prices, book)
        orders.append(
            get_fastlob_order_response(
                symbol=request.symbol, order=order, type=request.type
            )
        )
        self._emit_order_update(orders=orders)
        self._emit_balance_update(client_id=client_id, symbol=request.symbol)

        return get_fastlob_order_response(request.symbol, order, res, type=request.type)

    def cancel_order(self, request: CancelOrderRequest):
        book = self._books[request.symbol]
        orderid = request.orderId
        if orderid:
            order = book.get_order_by_id(orderid)
        else:
            order = book.get_order_by_client_order_id(request.origClientOrderId)

        if not order:
            return

        orderid = order.id()
        client_id = order.client_id()
        book.cancel(orderid=orderid)

        bids, asks = self._collect_bids_asks(set([order.price()]), book)

        self._emit_depth_update_for_symbol(
            symbol=request.symbol,
            bids=bids,
            asks=asks,
        )
        order._status = OrderStatus.CANCELED
        self._emit_order_update(
            orders=[get_fastlob_order_response(request.symbol, order)]
        )
        self._emit_balance_update(client_id=client_id, symbol=request.symbol)

        return get_fastlob_order_response(request.symbol, order)

    def cancel_replace(self, client_id: str, request: CancelReplaceRequest):
        book = self._books[request.symbol]
        orderid = request.cancelOrderId

        if orderid:
            print(book._orders.get(orderid))
            order = book.get_order_by_id(orderid)
        else:
            order = book.get_order_by_client_order_id(request.cancelOrigClientOrderId)

        if not order:
            return

        orderid = order.id()
        book.cancel(orderid=orderid)

        cancel_res = get_fastlob_order_response(symbol=request.symbol, order=order)

        order_params = OrderParams(
            client_id=client_id,
            client_order_id=request.newClientOrderId,
            side=(
                LobOrderSide.BID if request.side == OrderSide.BUY else LobOrderSide.ASK
            ),
            price=(
                request.price
                if request.type == OrderType.LIMIT_MAKER
                else Decimal("100000000")
            ),
            quantity=request.quantity,
            is_market=request.type == OrderType.MARKET,
        )

        res = book.process(orderparams=order_params)
        new_order_id = res.orderid()
        new_order = book.get_order_by_id(orderid=new_order_id)

        new_res = get_fastlob_order_response(
            request.symbol, new_order, res, request.type
        )

        prices: set[Decimal] = set([request.price, order.price()])
        exec_prices = res._execprices

        if exec_prices:
            for price in exec_prices.keys():
                prices.add(price)

        bids, asks = self._collect_bids_asks(prices, book)

        self._emit_depth_update_for_symbol(
            symbol=request.symbol,
            bids=bids,
            asks=asks,
        )

        order._status = OrderStatus.CANCELED
        orders = self._collect_orders(request.symbol, prices, book)
        orders.append(
            get_fastlob_order_response(
                symbol=request.symbol, order=new_order, type=request.type
            )
        )
        self._emit_order_update(orders=orders)
        self._emit_balance_update(client_id=client_id, symbol=request.symbol)

        return CancelReplaceResponse(
            cancelResult="SUCCESS",
            newOrderResult="SUCCESS",
            cancelResponse=cancel_res,
            newOrderResponse=new_res,
        )

    def cancel_all(self, client_id: str, request: CancelAllRequest):
        book = self._books[request.symbol]
        orders = book.get_open_orders_by_client_id(client_id)
        for order in orders:
            book.cancel(order.id())

        prices: set[Decimal] = set([order.price() for order in orders])

        bids, asks = self._collect_bids_asks(prices, book)

        self._emit_depth_update_for_symbol(
            symbol=request.symbol,
            bids=bids,
            asks=asks,
        )
        self._emit_order_update(
            orders=[
                get_fastlob_order_response(request.symbol, order) for order in orders
            ]
        )
        self._emit_balance_update(client_id=client_id, symbol=request.symbol)

        return [get_fastlob_order_response(request.symbol, order) for order in orders]

    def get_order(self, request: OrderQuery):

        book = self._books[request.symbol]
        orderid = request.orderId
        if orderid:
            order = book.get_order_by_id(orderid)
        else:
            order = book.get_order_by_client_order_id(request.origClientOrderId)

        if not order:
            return

        return get_fastlob_order_response(request.symbol, order)

    def all_orders(self, client_id: str, query: AllOrdersQuery):
        orders = self._books[query.symbol].get_orders_by_client_id(client_id)
        return [get_fastlob_order_response(query.symbol, order) for order in orders]

    def all_open_orders(self, client_id: str, query: CurrentOpenOrdersQuery):
        orders = self._books[query.symbol].get_open_orders_by_client_id(client_id)
        return [get_fastlob_order_response(query.symbol, order) for order in orders]

    def get_trades(self, client_id: str, query: TradesQuery) -> list[TradeResponse]:
        book = self._books[query.symbol]
        all_trades = []
        if query.orderId and not book.has_order_id(query.orderId):
            return []

        if query.orderId:
            order = book.get_order_by_id(query.orderId)
            if order:
                all_trades = order.trades()
        else:
            orders = book.get_orders_by_client_id(client_id)
            for order in orders:
                all_trades.extend(order.trades())

        # Optionally filter by time range
        if query.startTime or query.endTime:
            filtered_trades = []
            for trade in all_trades:
                if query.startTime and trade._time < query.startTime:
                    continue
                if query.endTime and trade._time > query.endTime:
                    continue
                filtered_trades.append(trade)
            return filtered_trades

        return [to_trade_response(query.symbol, trade) for trade in all_trades]

    def get_depth(self, query: DepthQuery):
        book = self._books[query.symbol]
        best_bids = book._bidside.best_limits(query.limit)
        best_asks = book._askside.best_limits(query.limit)

        bids: list[tuple[str, str]] = [
            [str(price), str(qty)] for price, qty, _ in best_bids
        ]

        asks: list[tuple[str, str]] = [
            [str(price), str(qty)] for price, qty, _ in best_asks
        ]

        return DepthResponse(
            lastUpdateId=self._update_id.get(query.symbol, int(time.time() * 1000)),
            bids=bids,
            asks=asks,
        )

    def account(self, client_id: str):
        account = get_account(client_id)
        balances = [
            {
                "asset": balance.asset,
                "free": str(balance.available),
                "locked": str(balance.reserved),
            }
            for balance in account.balances.values()
        ]

        return {
            "makerCommission": 15,
            "takerCommission": 15,
            "buyerCommission": 0,
            "sellerCommission": 0,
            "commissionRates": {
                "maker": "0.00150000",
                "taker": "0.00150000",
                "buyer": "0.00000000",
                "seller": "0.00000000",
            },
            "canTrade": True,
            "canWithdraw": True,
            "canDeposit": True,
            "brokered": True,
            "requireSelfTradePrevention": False,
            "preventSor": False,
            "updateTime": int(time.time()),
            "accountType": "SPOT",
            "balances": balances,
            "permissions": ["SPOT"],
            "uid": int(time.time()),
        }

    def reset(self):
        self._books = {}
        self._depth_listeners = {}
        self._user_listeners = {}
        self._update_id = {}
        reset_accounts()

    def klines(self, query: KlineQuery):
        # we only return real volume, ohlc left to 0
        book = self._books[query.symbol]
        all_trades = []

        for order in book._orders.values():
            all_trades.extend(order.trades())

        filtered_trades = []
        for trade in all_trades:
            if query.startTime and trade._time < query.startTime:
                continue
            if query.endTime and trade._time > query.endTime:
                continue
            filtered_trades.append(trade)

        if not filtered_trades or not len(filtered_trades):
            return []

        # sort filtered_trade by time
        filtered_trades.sort(key=lambda x: x._time)

        interval_milliseconds = interval_to_milliseconds(query.interval)

        # aggregate trades to list[{volume, quote_volume, open_time, close_time}] by query.interval
        # we should take query.startTime as the first open_time if it is not None, if it is none, we take the first trade time
        if query.startTime:
            open_time = query.startTime
        else:
            open_time = filtered_trades[0]._time

        end_time = query.endTime if query.endTime else int(time.time() * 1000)
        # i also want to return volume = 0 in windows that have no trades
        # add volume to the kline element
        klines = []
        trade_idx = 0
        while open_time <= end_time:
            klines.append(
                {
                    "volume": 0,
                    "quote_volume": 0,
                    "open_time": open_time,
                    "close_time": open_time + interval_milliseconds,
                }
            )
            while (
                trade_idx < len(filtered_trades)
                and filtered_trades[trade_idx]._time < open_time + interval_milliseconds
            ):
                klines[-1]["volume"] += filtered_trades[trade_idx]._quantity / 2
                klines[-1]["quote_volume"] += filtered_trades[trade_idx]._quote_qty / 2
                trade_idx += 1
            open_time += interval_milliseconds

        # set o,h,l,c to 0, return in this form:
        """
        [
  [
    1499040000000,      // Kline open time
    "0.01634790",       // Open price
    "0.80000000",       // High price
    "0.01575800",       // Low price
    "0.01577100",       // Close price
    "148976.11427815",  // Volume
    1499644799999,      // Kline Close time
    "2434.19055334",    // Quote asset volume
    308,                // Number of trades
    "1756.87402397",    // Taker buy base asset volume
    "28.46694368",      // Taker buy quote asset volume
    "0"                 // Unused field, ignore.
  ]
]
        """
        return [
            [
                kline["open_time"],
                "0",
                "0",
                "0",
                "0",
                str(kline["volume"]),
                kline["close_time"],
                str(kline["quote_volume"]),
                "0",
                "0",
                "0",
                "0",
            ]
            for kline in klines
        ]


exchange = _Exchange()
