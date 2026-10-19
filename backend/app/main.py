"""The FastAPI app. Every route lives under /api (Vercel serves the SPA at / and this at /api/*).

Each module owns one file, `app/modules/<module>/router.py`. To add an
endpoint, edit only that file; this file changes only when a module is added.
"""

from __future__ import annotations

from fastapi import APIRouter, FastAPI

from app.core.errors import register_error_handlers
from app.modules.auth.router import router as auth_router
from app.modules.customers.router import router as customers_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.invoice_pdf.router import router as invoice_pdf_router
from app.modules.invoices.router import accounting_router, router as invoices_router
from app.modules.products.router import router as products_router
from app.modules.sales_orders.router import router as sales_orders_router
from app.modules.stock.router import router as stock_router

app = FastAPI(
    title="Siam Bean Mini ERP API",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
)
register_error_handlers(app)

api = APIRouter(prefix="/api")
for module_router in (
    auth_router,
    products_router,
    customers_router,
    stock_router,
    sales_orders_router,
    invoices_router,
    invoice_pdf_router,
    accounting_router,
    dashboard_router,
):
    api.include_router(module_router)
app.include_router(api)
