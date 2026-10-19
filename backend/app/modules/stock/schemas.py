"""Request and response shapes of the stock module."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

MovementType = Literal["in", "out", "adjust"]


class MovementIn(BaseModel):
    product_id: int
    movement_type: MovementType
    # Whole numbers only. In/out are entered positive; an Adjustment is signed.
    quantity: int
    reason: str | None = Field(default=None, max_length=500)


class MovementOut(BaseModel):
    id: int
    product_id: int
    created_at: datetime
    movement_type: str
    ref_doc: str
    quantity: int  # stored sign: a Stock-out is negative
    reason: str | None
    on_hand: int  # the Product's On Hand after this movement


class HistoryItem(BaseModel):
    id: int
    created_at: datetime
    movement_type: str
    ref_doc: str | None
    quantity: int
    reason: str | None
    balance_after: int
    created_by_name: str | None


class HistoryPage(BaseModel):
    items: list[HistoryItem]
    total: int
    page: int
    page_size: int


class StockProduct(BaseModel):
    id: int
    sku: str
    name: str
    unit: str
    on_hand: int
    reorder_level: int
    low_stock: bool
