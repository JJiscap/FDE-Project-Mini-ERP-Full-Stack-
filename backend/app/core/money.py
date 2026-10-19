"""Money in the API: `Decimal` in Python, `numeric(12,2)` in the database, a string like "9630.00" in JSON.

    class ProductIn(BaseModel):
        price: Annotated[Money, Field(ge=0)]     # input: number or string, at most 2 decimals

    class InvoiceOut(BaseModel):
        total: Money                             # output: "9630.00"

Always return pydantic models that use `Money` (or declare `response_model`).
A bare `Decimal` inside a plain dict is turned into a float by FastAPI.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from pydantic import Field, PlainSerializer

_TWO_PLACES = Decimal("0.01")


def format_money(value: Decimal) -> str:
    """`Decimal("9630")` -> "9630.00" (rounded half up if it has more decimals)."""
    return str(value.quantize(_TWO_PLACES, rounding=ROUND_HALF_UP))


Money = Annotated[
    Decimal,
    Field(max_digits=12, decimal_places=2),  # fits numeric(12,2)
    PlainSerializer(format_money, return_type=str, when_used="json"),
]
