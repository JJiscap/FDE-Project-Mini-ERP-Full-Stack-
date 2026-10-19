"""customers: master data, search and paging (ticket 06).

Endpoints to add here: GET|POST /customers, PATCH /customers/{id}.
Role matrix: see .scratch/mini-erp/spec.md. Guard with `require_roles(...)`.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/customers", tags=["customers"])
