from decimal import Decimal
from typing import Dict


class SpotBalance:
    _asset: str
    _available: Decimal
    _reserved: Decimal

    def __init__(
        self,
        asset: str,
        available: Decimal = Decimal(0),
        reserved: Decimal = Decimal(0),
    ):
        self._asset = asset
        self._available = available
        self._reserved = reserved

    @property
    def asset(self) -> str:
        return self._asset

    @property
    def available(self) -> Decimal:
        return self._available

    @property
    def reserved(self) -> Decimal:
        return self._reserved

    @property
    def total(self) -> Decimal:
        return self._available + self._reserved

    def on_deposit(self, amount: Decimal):
        if amount < 0:
            raise ValueError("Deposit amount must be positive")
        self._available += amount

    def on_withdraw(self, amount: Decimal):
        if amount < 0:
            raise ValueError("Withdraw amount must be positive")
        self._available -= amount

    def on_place_limit_order(self, amount: Decimal):
        if amount > self._available:
            raise ValueError("Not enough available balance to place limit order")
        self._reserved += amount
        self._available -= amount

    def on_cancel_limit_order(self, amount: Decimal):
        if amount > self._reserved:
            raise ValueError("Not enough reserved balance to cancel limit order")
        self._reserved -= amount
        self._available += amount

    def take_reservation(self, amount: Decimal):
        if amount > self._reserved:
            raise ValueError("Not enough reserved balance to take")
        self._reserved -= amount


class SpotAccount:
    _client_id: str
    _balances: Dict[str, SpotBalance]

    def __init__(self, client_id: str):
        self._client_id = client_id
        self._balances = {}

    @classmethod
    def new_with_initial_balance(
        cls, client_id: str, asset: str, initial_balance: Decimal
    ):
        account = cls(client_id)
        account._balances[asset] = SpotBalance(asset, initial_balance)
        return account

    def get_balance(self, asset: str) -> SpotBalance:
        if asset not in self._balances:
            self._balances[asset] = SpotBalance(asset)
        return self._balances[asset]

    @property
    def balances(self) -> Dict[str, SpotBalance]:
        return self._balances


_accounts: Dict[str, SpotAccount] = {}


def get_account(client_id: str) -> SpotAccount:
    if not _accounts.get(client_id):
        _accounts[client_id] = SpotAccount(client_id)
    return _accounts[client_id]


def reset_accounts():
    _accounts.clear()
