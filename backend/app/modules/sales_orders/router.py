"""sales orders: Drafts, lines, cancel and Confirm (tickets 08 and 09).

Endpoints to add here: GET|POST /sales-orders, GET|PATCH /sales-orders/{id},
POST /sales-orders/{id}/confirm, POST /sales-orders/{id}/cancel.
Role matrix: see .scratch/mini-erp/spec.md. Guard with `require_roles(...)`.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/sales-orders", tags=["sales orders"])
