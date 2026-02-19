"""The order object manipulated by the lob."""

import secrets
from decimal import Decimal
from dataclasses import dataclass

from fastlob.consts import ORDERS_ID_SIZE
import time

@dataclass
class Trade:

    _id: int
    _order_id: int
    _price: Decimal
    _quote_qty: Decimal
    _quantity: Decimal
    _is_buyer: bool
    _is_maker: bool
    _time: int

    def __init__(self, order_id: int, price: Decimal, quantity: Decimal, is_buyer: bool = False, is_maker: bool = False):
        self._id = int(secrets.token_hex(nbytes=ORDERS_ID_SIZE), 16)
        
        self._order_id = order_id
        self._price = price
        self._quantity = quantity
        self._quote_qty = price * quantity

        self._is_buyer = is_buyer
        self._is_maker = is_maker
        self._time = int(time.time() * 1000)

    def id(self) -> int:
        """Getter for trade identifier."""
        return self._id

    def order_id(self) -> int:
        return self._order_id

    def price(self) -> Decimal:
        """Getter for order price."""
        return self._price

    def quantity(self) -> Decimal:
        """Getter for order quantity."""
        return self._quantity

    def quote_qty(self) -> Decimal:
        """Getter for order type."""
        return self._quote_qty
    
    def is_buyer(self) -> bool:
        return self._is_buyer
    
    def is_maker(self) -> bool:
        return self._is_maker