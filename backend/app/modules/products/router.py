"""products: master data with On Hand and Low Stock (ticket 05).

Endpoints to add here: GET|POST /products, PATCH /products/{id}.
Role matrix: see .scratch/mini-erp/spec.md. Guard with `require_roles(...)`.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/products", tags=["products"])
