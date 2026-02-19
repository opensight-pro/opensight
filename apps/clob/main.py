from exchange import (
    exchange,
    NewOrderRequest,
    OrderSide,
    OrderType,
    get_account,
    KlineQuery,
)
from decimal import Decimal

symbol = "SPOREUSDT"
base = "SPORE"
quote = "USDT"


def print_account(acc: str):
    print(f"Account balance info: {acc}")
    account = get_account(acc)
    for asset, balance in account.balances.items():
        print(
            f"Asset: {asset}, Available: {balance.available}, Locked: {balance.reserved}"
        )


if __name__ == "__main__":
    exchange.new_book(symbol)
    for account in ["MM", "MM1", "TAKER"]:
        exchange.deposit(account, base, Decimal("10000"))
        exchange.deposit(account, quote, Decimal("10000"))

    exchange.new_order(
        "MM",
        NewOrderRequest(
            newClientOrderId="MM_order_1",
            symbol=symbol,
            side=OrderSide.SELL,
            type=OrderType.LIMIT_MAKER,
            quantity=Decimal("2000"),
            price=Decimal("1"),
        ),
    )

    exchange.new_order(
        "MM1",
        NewOrderRequest(
            newClientOrderId="MM1_order_1",
            symbol=symbol,
            side=OrderSide.SELL,
            type=OrderType.LIMIT_MAKER,
            quantity=Decimal("2000"),
            price=Decimal("1"),
        ),
    )

    exchange.new_order(
        "MM",
        NewOrderRequest(
            newClientOrderId="MM_order_2",
            symbol=symbol,
            side=OrderSide.SELL,
            type=OrderType.LIMIT_MAKER,
            quantity=Decimal("2000"),
            price=Decimal("1"),
        ),
    )

    for account in ["MM", "MM1", "TAKER"]:
        print_account(account)

    print("------------------------------------")
    exchange.new_order(
        "TAKER",
        NewOrderRequest(
            newClientOrderId="Taker_order",
            symbol=symbol,
            side=OrderSide.BUY,
            type=OrderType.MARKET,
            quantity=Decimal("4000"),
        ),
    )

    print("------------------------------------")
    exchange.new_order(
        "TAKER",
        NewOrderRequest(
            newClientOrderId="Taker_order",
            symbol=symbol,
            side=OrderSide.BUY,
            type=OrderType.MARKET,
            quantity=Decimal("4000"),
        ),
    )

    # print("------------------------------------")
    # for account in ["MM", "MM1", "TAKER"]:
    #     print_account(account)

    klines = exchange.klines(KlineQuery(symbol=symbol, interval="15m", startTime=1767586330149))

    print(klines)
