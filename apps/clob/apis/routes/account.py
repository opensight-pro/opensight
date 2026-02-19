from fastapi import APIRouter, Depends
from exchange import (
    exchange,
)
from pydantic import BaseModel
from decimal import Decimal
from apis.api_key import get_api_key

router = APIRouter(
    prefix="/account",
    tags=["account"],
    responses={404: {"description": "Not found"}},
)


@router.get("")
async def account(client_id: str = Depends(get_api_key)):
    return exchange.account(client_id)


class DepositRequest(BaseModel):
    asset: str
    amount: Decimal


@router.post("/deposit")
async def deposit(request: DepositRequest, client_id: str = Depends(get_api_key)):
    return exchange.deposit(client_id, request.asset, request.amount)
