"""Errors always leave the API as `{"detail": "<message a person can act on>"}`.

    401  no or invalid token            403  wrong Role / no `users` row
    404  not found in your Company      409  business conflict (stock, duplicate, wrong status)
    422  bad input (one sentence per wrong field)

HTTPException(status, "message") already has that shape. This module adds the
handlers for everything else: validation errors, errors raised by Postgres,
and bugs.
"""

from __future__ import annotations

import logging

import psycopg.errors
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

log = logging.getLogger("app.errors")

_ACRONYMS = {"id": "ID", "sku": "SKU", "vat": "VAT", "po": "PO"}

_WHOLE_NUMBER = {"int_parsing", "int_type", "int_from_float", "int_parsing_size"}
_NUMBER = {"decimal_parsing", "decimal_type", "float_parsing", "float_type"}
_TOO_LARGE = {"decimal_max_digits", "decimal_whole_digits"}
_DATE = {"date_parsing", "date_type", "date_from_datetime_parsing", "date_from_datetime_inexact"}


def _label(field: str) -> str:
    """`tax_id` -> "Tax ID", `price` -> "Price", `sku` -> "SKU"."""
    words = [_ACRONYMS.get(w.lower(), w.lower()) for w in field.split("_") if w]
    if words and words[0] == words[0].lower():
        words[0] = words[0].capitalize()
    return " ".join(words)


def _sentence(label: str, error: dict) -> str:
    kind = error["type"]
    ctx = error.get("ctx") or {}
    if kind == "missing":
        return f"{label} is required"
    if kind == "greater_than_equal":
        return f"{label} must be {ctx['ge']} or more"
    if kind == "greater_than":
        return f"{label} must be greater than {ctx['gt']}"
    if kind == "less_than_equal":
        return f"{label} must be {ctx['le']} or less"
    if kind == "less_than":
        return f"{label} must be less than {ctx['lt']}"
    if kind == "string_too_short":
        if ctx.get("min_length") == 1:
            return f"{label} is required"
        return f"{label} must be at least {ctx['min_length']} characters"
    if kind == "string_too_long":
        return f"{label} must be at most {ctx['max_length']} characters"
    if kind in _WHOLE_NUMBER:
        return f"{label} must be a whole number"
    if kind in _NUMBER:
        return f"{label} must be a number"
    if kind == "decimal_max_places":
        return f"{label} can have at most {ctx['decimal_places']} decimal places"
    if kind in _TOO_LARGE:
        return f"{label} is too large"
    if kind in _DATE:
        return f"{label} must be a date like 2026-10-22"
    if kind == "literal_error":
        return f"{label} must be {str(ctx.get('expected', '')).replace(chr(39), '')}"
    if kind in ("bool_parsing", "bool_type"):
        return f"{label} must be true or false"
    if kind == "string_type":
        return f"{label} must be text"
    return f"{label} is not valid"


def validation_messages(errors: list[dict]) -> str:
    """Turn pydantic's error list into one readable sentence per wrong field."""
    messages: list[str] = []
    seen: set[tuple] = set()
    for error in errors:
        loc = tuple(error["loc"])
        if error["type"] == "json_invalid":
            message = "The request body is not valid JSON"
        elif loc == ("body",):
            message = (
                "The request body is required"
                if error["type"] == "missing"
                else "The request body is not valid"
            )
        else:
            fields = [part for part in loc if isinstance(part, str) and part not in ("body",)]
            message = _sentence(_label(fields[-1] if fields else "value"), error)
            indexes = [part for part in loc if isinstance(part, int)]
            if indexes:
                message = f"Line {indexes[0] + 1}: {message}"
        if loc not in seen:  # one message per field
            seen.add(loc)
            messages.append(message)
    return "; ".join(dict.fromkeys(messages))


def _detail(status_code: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"detail": message})


async def _validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    return _detail(422, validation_messages(exc.errors()))


async def _database_refusal(request: Request, exc: psycopg.errors.RaiseException) -> JSONResponse:
    # Our own RAISE EXCEPTION in Postgres (e.g. "Not enough stock for ARB-1KG"):
    # the message is already written for people.
    return _detail(409, exc.diag.message_primary or "That change is not allowed.")


async def _duplicate(request: Request, exc: psycopg.errors.UniqueViolation) -> JSONResponse:
    return _detail(409, "That already exists. Check for a duplicate and try again.")


async def _unexpected(request: Request, exc: Exception) -> JSONResponse:
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return _detail(500, "Something went wrong on our side. Please try again.")


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(psycopg.errors.RaiseException, _database_refusal)
    app.add_exception_handler(psycopg.errors.UniqueViolation, _duplicate)
    app.add_exception_handler(Exception, _unexpected)
