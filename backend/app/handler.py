"""AWS Lambda entry point (API Gateway HTTP API, payload format 2.0)."""

from __future__ import annotations

import hmac
import json
import logging
import os
from collections.abc import Callable
from functools import lru_cache
from typing import Any

from botocore.exceptions import BotoCoreError, ClientError
from pydantic import BaseModel, ValidationError

from .location import LocationService
from .models import IsolineRequest, ReverseRequest, RouteRequest, SearchRequest

logger = logging.getLogger()
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

MAX_BODY_BYTES = 16_384
Event = dict[str, Any]
Response = dict[str, Any]


@lru_cache(maxsize=1)
def get_service() -> LocationService:
    import boto3  # imported lazily so unit tests never need AWS credentials

    region = os.environ.get("AWS_REGION", "us-east-1")
    return LocationService(
        routes=boto3.client("geo-routes", region_name=region),
        places=boto3.client("geo-places", region_name=region),
    )


def _json(status: int, payload: Any) -> Response:
    body = payload.model_dump_json() if isinstance(payload, BaseModel) else json.dumps(payload)
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
        "body": body,
    }


def _body(event: Event) -> dict[str, Any]:
    raw = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        import base64

        raw = base64.b64decode(raw).decode("utf-8")
    if len(raw.encode("utf-8")) > MAX_BODY_BYTES:
        raise ValueError("request body too large")
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("request body must be a JSON object")
    return data


def _route(event: Event, svc: LocationService) -> Response:
    req = RouteRequest.model_validate(_body(event))
    return _json(200, svc.route(list(req.waypoints), req.optimize))


def _isoline(event: Event, svc: LocationService) -> Response:
    req = IsolineRequest.model_validate(_body(event))
    return _json(200, svc.isolines(req.origin, req.minutes))


def _search(event: Event, svc: LocationService) -> Response:
    req = SearchRequest.model_validate(event.get("queryStringParameters") or {})
    return _json(200, svc.search(req.q))


def _reverse(event: Event, svc: LocationService) -> Response:
    params = event.get("queryStringParameters") or {}
    req = ReverseRequest.model_validate(params)
    return _json(200, svc.reverse(req.position()))


ROUTES: dict[tuple[str, str], Callable[[Event, LocationService], Response]] = {
    ("POST", "/api/route"): _route,
    ("POST", "/api/isoline"): _isoline,
    ("GET", "/api/search"): _search,
    ("GET", "/api/reverse"): _reverse,
}


def _origin_verified(event: Event) -> bool:
    """Reject requests that bypass CloudFront (shared secret header added by the distribution)."""
    expected = os.environ.get("ORIGIN_VERIFY_SECRET", "")
    if not expected:
        return True  # local/unit-test mode
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    return hmac.compare_digest(headers.get("x-origin-verify", ""), expected)


def handler(event: Event, context: Any = None, service: LocationService | None = None) -> Response:
    if not _origin_verified(event):
        return _json(403, {"error": "forbidden"})

    http = event.get("requestContext", {}).get("http", {})
    key = (http.get("method", "").upper(), event.get("rawPath", ""))
    action = ROUTES.get(key)
    if action is None:
        return _json(404, {"error": "not found"})

    try:
        return action(event, service or get_service())
    except ValidationError as exc:
        errors = [{"loc": list(e["loc"]), "msg": e["msg"]} for e in exc.errors(include_url=False, include_input=False)]
        return _json(400, {"error": "invalid request", "details": errors})
    except (ValueError, json.JSONDecodeError) as exc:
        return _json(400, {"error": str(exc)})
    except LookupError as exc:
        return _json(404, {"error": str(exc)})
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "Unknown")
        logger.error("Amazon Location error on %s: %s", key, code, exc_info=True)
        status = 429 if code in {"ThrottlingException", "TooManyRequestsException"} else 502
        if code == "ValidationException":
            status = 400
        return _json(status, {"error": f"location service error: {code}"})
    except BotoCoreError:
        logger.exception("AWS SDK failure on %s", key)
        return _json(502, {"error": "upstream service unavailable"})
