"""customers: master data, search and paging (ticket 06).

GET /customers, GET /customers/{id}   admin, sales, accountant
POST /customers, PATCH /customers/{id} admin, sales  (PATCH {active: false} deactivates)
Warehouse gets 403 on all of them. Customers are deactivated, never deleted (rule 7).
Every query filters by the caller's company_id.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, BeforeValidator, Field, StringConstraints

from app.core.auth import CurrentUser, require_roles
from app.core.db import Conn

router = APIRouter(prefix="/customers", tags=["customers"])

CanView = Annotated[CurrentUser, Depends(require_roles("admin", "sales", "accountant"))]
CanEdit = Annotated[CurrentUser, Depends(require_roles("admin", "sales"))]

COLUMNS = "id, name, tax_id, payment_terms_days, address, phone, active"
MAX_PAGE_SIZE = 20

RequiredText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


def _blank_to_none(value: Any) -> Any:
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


OptionalText = Annotated[str | None, BeforeValidator(_blank_to_none)]


class CustomerOut(BaseModel):
    id: int
    name: str
    tax_id: str
    payment_terms_days: int
    address: str | None
    phone: str | None
    active: bool


class CustomerPage(BaseModel):
    items: list[CustomerOut]
    total: int
    page: int
    page_size: int


class CustomerIn(BaseModel):
    name: RequiredText
    tax_id: RequiredText
    payment_terms_days: Annotated[int, Field(ge=0)] = 0  # 0 means Cash
    address: OptionalText = None
    phone: OptionalText = None


class CustomerPatch(BaseModel):
    """Only the fields that are sent change. `active` deactivates or reactivates."""

    name: RequiredText | None = None
    tax_id: RequiredText | None = None
    payment_terms_days: Annotated[int, Field(ge=0)] | None = None
    address: OptionalText = None
    phone: OptionalText = None
    active: bool | None = None


def _like(text: str) -> str:
    """`%text%` with LIKE wildcards in `text` escaped, so '%' and '_' search for themselves."""
    escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


@router.get("")
def list_customers(
    user: CanView,
    conn: Conn,
    q: Annotated[str | None, Query()] = None,
    active: bool | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = MAX_PAGE_SIZE,
) -> CustomerPage:
    """Customers of the caller's Company, by name. `q` matches part of the name (any case) or the Tax ID."""
    where = ["company_id = %s"]
    params: list[Any] = [user.company_id]
    term = (q or "").strip()
    if term:
        where.append("(name ilike %s or tax_id ilike %s)")
        params += [_like(term), _like(term)]
    if active is not None:
        where.append("active = %s")
        params.append(active)
    condition = " and ".join(where)

    total = conn.execute(
        f"select count(*) as n from public.customers where {condition}", params
    ).fetchone()["n"]
    rows = conn.execute(
        f"select {COLUMNS} from public.customers where {condition} "
        "order by name, id limit %s offset %s",
        [*params, page_size, (page - 1) * page_size],
    ).fetchall()
    return CustomerPage(items=rows, total=total, page=page, page_size=page_size)


def _get(conn, company_id: int, customer_id: int) -> dict:
    row = conn.execute(
        f"select {COLUMNS} from public.customers where id = %s and company_id = %s",
        (customer_id, company_id),
    ).fetchone()
    if row is None:
        raise HTTPException(404, "Customer not found")
    return row


@router.get("/{customer_id}")
def get_customer(customer_id: int, user: CanView, conn: Conn) -> CustomerOut:
    return CustomerOut(**_get(conn, user.company_id, customer_id))


@router.post("", status_code=201)
def create_customer(body: CustomerIn, user: CanEdit, conn: Conn) -> CustomerOut:
    """The Tax ID is required but not unique (branches share one)."""
    row = conn.execute(
        "insert into public.customers (company_id, name, tax_id, payment_terms_days, address, phone, created_by) "
        f"values (%s, %s, %s, %s, %s, %s, %s) returning {COLUMNS}",
        (user.company_id, body.name, body.tax_id, body.payment_terms_days, body.address, body.phone, user.id),
    ).fetchone()
    return CustomerOut(**row)


@router.patch("/{customer_id}")
def update_customer(customer_id: int, body: CustomerPatch, user: CanEdit, conn: Conn) -> CustomerOut:
    current = _get(conn, user.company_id, customer_id)
    changes = {field: getattr(body, field) for field in body.model_fields_set}
    for field in ("name", "tax_id", "payment_terms_days", "active"):
        if field in changes and changes[field] is None:  # explicit null on a NOT NULL column
            changes.pop(field)
    if not changes:
        return CustomerOut(**current)
    assignments = ", ".join(f"{field} = %s" for field in changes)  # field names come from the model, not the client
    row = conn.execute(
        f"update public.customers set {assignments} where id = %s and company_id = %s returning {COLUMNS}",
        [*changes.values(), customer_id, user.company_id],
    ).fetchone()
    return CustomerOut(**row)
