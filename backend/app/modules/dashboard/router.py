"""dashboard: live numbers for every Role (ticket 11).

Endpoint to add here: GET /dashboard (Sales Today, Low Stock count, Open Invoices, Stock Value).
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
