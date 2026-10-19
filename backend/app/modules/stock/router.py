"""stock: Stock-in, Stock-out, Adjustment and movement history (ticket 07).

Endpoints to add here: POST /stock/movements, GET /stock/movements?product_id=.
Role matrix: see .scratch/mini-erp/spec.md. Guard with `require_roles(...)`.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/stock", tags=["stock"])
