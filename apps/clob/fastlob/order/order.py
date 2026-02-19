"""The order object manipulated by the lob."""

import abc
import secrets
from typing import Optional
from decimal import Decimal
from dataclasses import dataclass
from account import SpotAccount, get_account
from fastlob.enums import OrderSide, OrderType, OrderStatus
from fastlob.trade import Trade
from fastlob.consts import ORDERS_ID_SIZE
from .params import OrderParams
import time


@dataclass
class Order(abc.ABC):
    """Base abstract class for orders in the order-book. Extended by `BidOrder` and `AskOrder`."""

    _id: int
    _client_id: str
    _client_order_id: str
    _side: OrderSide
    _price: Decimal
    _org_quantity: Decimal
    _quantity: Decimal
    _is_market: bool
    _otype: OrderType
    _expiry: Optional[float]
    _status: OrderStatus
    _orig_quote_qty: Decimal
    _cummulative_quote_qty: Decimal
    _time: int
    _trades: list[Trade]

    _base: str
    _quote: str
    _account: SpotAccount

    def __init__(self, params: OrderParams):
        self._id = int(secrets.token_hex(nbytes=ORDERS_ID_SIZE), 16)
        self._client_id = params.client_id
        self._client_order_id = (
            params.client_order_id
            if params.client_order_id
            else secrets.token_urlsafe(nbytes=ORDERS_ID_SIZE)
        )
        self._price = params.price
        self._org_quantity = params.quantity
        self._quantity = params.quantity
        self._is_market = params.is_market
        self._otype = params.otype
        self._expiry = params.expiry
        self._status = OrderStatus.CREATED
        self._orig_quote_qty = params.quantity * params.price
        self._cummulative_quote_qty = Decimal("0")
        self._time = int(time.time() * 1000)
        self._trades = []
        self._base = params.base
        self._quote = params.quote
        self._side = params.side

        self._account = get_account(params.client_id)
        if not self._is_market:
            if self._side == OrderSide.BID:
                self._account.get_balance(self._quote).on_place_limit_order(
                    self._orig_quote_qty
                )
            else:
                self._account.get_balance(self._base).on_place_limit_order(
                    self._org_quantity
                )

    def id(self) -> int:
        """Getter for order identifier."""
        return self._id

    def is_market(self) -> bool:
        """Getter for order type."""
        return self._is_market

    def client_id(self) -> str:
        return self._client_id

    def client_order_id(self) -> str:
        return self._client_order_id

    def side(self) -> OrderSide:
        """Getter for order side."""
        return self._side

    def price(self) -> Decimal:
        """Getter for order price."""
        return self._price

    def quantity(self) -> Decimal:
        """Getter for order quantity."""
        return self._quantity

    def otype(self) -> OrderType:
        """Getter for order type."""
        return self._otype

    def expiry(self) -> Optional[float]:
        """Getter for the expiration date of the order. Only relevant in the case of a GTD order."""
        return self._expiry

    def status(self) -> OrderStatus:
        """Getter for order status."""
        return self._status

    def trades(self) -> list[Trade]:
        """Getter for trades associated with this order."""
        return self._trades

    def set_status(self, status: OrderStatus):
        """Set the order status."""
        self._status = status

    def cancel(self):
        """Cancel the order."""
        self.set_status(OrderStatus.CANCELED)
        if self._side == OrderSide.BID:
            self._account.get_balance(self._quote).on_cancel_limit_order(
                self._orig_quote_qty - self._cummulative_quote_qty
            )
        else:
            self._account.get_balance(self._base).on_cancel_limit_order(self._quantity)

    def fill(self, quantity: Decimal, price: Optional[Decimal] = None):
        """Decrease the quantity of the order by some numerical value. If `quantity` is greater than the order qty,
        we set it to 0.
        """
        print(f"Filling order: {self._client_order_id}, {quantity}, {price}")
        executed_price = price if price is not None else self._price

        executed_qty = min(quantity, self._quantity)
        self._quantity -= executed_qty
        quote_qty = executed_qty * executed_price
        self._cummulative_quote_qty += quote_qty

        if self._side == OrderSide.BID:
            if self._is_market:
                self._account.get_balance(self._quote).on_withdraw(quote_qty)
            else:
                self._account.get_balance(self._quote).take_reservation(quote_qty)
            self._account.get_balance(self._base).on_deposit(executed_qty)
        else:
            if self._is_market:
                self._account.get_balance(self._base).on_withdraw(executed_qty)
            else:
                self._account.get_balance(self._base).take_reservation(executed_qty)
            self._account.get_balance(self._quote).on_deposit(quote_qty)

        trade = Trade(
            self._id,
            executed_price,
            executed_qty,
            is_buyer=(self._side == OrderSide.BID),
            is_maker=price is None,
        )
        self._trades.append(trade)

        if self.quantity() == 0:
            self.set_status(OrderStatus.FILLED)
            return
        self.set_status(OrderStatus.PARTIAL)

    def update(self, quantity: Decimal):
        """Update the quantity of the order to some numerical value"""
        self._quantity = quantity

    def valid(self) -> bool:
        """True if order is valid (can be matched)."""
        return self.status() in OrderStatus.valid_states()

    def __eq__(self, other):
        """Two orders are equal if they're (unique) ids are equal."""
        return self.id() == other.id()

    def __repr__(self) -> str:
        return (
            f"{self._side.name}Order(id=[{self.id()}], status={self.status()}, price={self.price()}, "
            + f"quantity={self.quantity()}, type={self.otype()})"
        )


@dataclass
class BidOrder(Order):
    """A bid (buy) order."""

    def __init__(self, params: OrderParams):
        params.side = OrderSide.BID
        super().__init__(params)


@dataclass
class AskOrder(Order):
    """An ask (sell) order."""

    def __init__(self, params: OrderParams):
        params.side = OrderSide.ASK
        super().__init__(params)
