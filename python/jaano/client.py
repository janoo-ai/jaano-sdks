"""Jaano Enterprise Developer API v1 Python client."""
from __future__ import annotations

import json
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Callable, Mapping, Optional

from ._generated_types import OPENAPI_VERSION
from .errors import JaanoApiError, JaanoNetworkError, JaanoTimeoutError
from .webhooks import verify_webhook_signature

SDK_VERSION = OPENAPI_VERSION
DEFAULT_BASE_URL = "https://api.jaano.ai/v1"
_RETRYABLE_STATUSES = {429, 500, 502, 503, 504}


@dataclass(frozen=True)
class TransportResponse:
    status: int
    headers: Mapping[str, str]
    body: str


Transport = Callable[[str, str, dict[str, str], Optional[str], float], TransportResponse]


def _encode_segment(value: str, name: str) -> str:
    s = str(value or "").strip()
    if not s:
        raise ValueError(f"{name} is required.")
    return urllib.parse.quote(s, safe="")


def _build_query(params: Optional[Mapping[str, Any]]) -> str:
    if not params:
        return ""
    clean: dict[str, str] = {}
    for k, v in params.items():
        if v is None or v == "":
            continue
        if isinstance(v, bool):
            clean[k] = "true" if v else "false"
        else:
            clean[k] = str(v)
    return f"?{urllib.parse.urlencode(clean)}" if clean else ""


def _parse_retry_after(value: Optional[str]) -> Optional[float]:
    if not value:
        return None
    try:
        secs = float(value)
        return secs if secs >= 0 else None
    except ValueError:
        return None


def _default_transport(
    method: str,
    url: str,
    headers: dict[str, str],
    body: Optional[str],
    timeout_seconds: float,
) -> TransportResponse:
    data = body.encode("utf-8") if body is not None else None
    req = urllib.request.Request(url=url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
            raw = resp.read().decode("utf-8")
            hdrs = {k.lower(): v for k, v in resp.headers.items()}
            return TransportResponse(status=resp.status, headers=hdrs, body=raw)
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", errors="replace") if err.fp else ""
        hdrs = {k.lower(): v for k, v in err.headers.items()} if err.headers else {}
        return TransportResponse(status=err.code, headers=hdrs, body=raw)
    except (socket.timeout, TimeoutError) as exc:
        raise JaanoTimeoutError(timeout_seconds) from exc
    except urllib.error.URLError as exc:
        if isinstance(exc.reason, (socket.timeout, TimeoutError)):
            raise JaanoTimeoutError(timeout_seconds) from exc
        raise JaanoNetworkError(str(exc.reason or exc)) from exc


class _Resource:
    def __init__(self, client: "JaanoClient") -> None:
        self._client = client


class WorkspaceResource(_Resource):
    def me(self) -> dict[str, Any]:
        return self._client._request("GET", "/me")

    def wallet(self) -> dict[str, Any]:
        return self._client._request("GET", "/wallet")

    def list_api_keys(self) -> dict[str, Any]:
        return self._client._request("GET", "/api-keys")

    def create_api_key(self, body: Mapping[str, Any]) -> dict[str, Any]:
        return self._client._request("POST", "/api-keys", body=body)

    def revoke_api_key(self, key_id: str) -> dict[str, Any]:
        return self._client._request("DELETE", f"/api-keys/{_encode_segment(key_id, 'key_id')}")


class AgentsResource(_Resource):
    def list(self, **params: Any) -> dict[str, Any]:
        return self._client._request("GET", f"/agents{_build_query(params)}")

    def create(self, body: Mapping[str, Any]) -> dict[str, Any]:
        return self._client._request("POST", "/agents", body=body)

    def get(self, agent_id: str) -> dict[str, Any]:
        return self._client._request("GET", f"/agents/{_encode_segment(agent_id, 'agent_id')}")

    def update(self, agent_id: str, body: Mapping[str, Any]) -> dict[str, Any]:
        return self._client._request(
            "PATCH", f"/agents/{_encode_segment(agent_id, 'agent_id')}", body=body
        )

    def archive(self, agent_id: str) -> dict[str, Any]:
        return self._client._request("DELETE", f"/agents/{_encode_segment(agent_id, 'agent_id')}")

    def activate_inbound(self, agent_id: str) -> dict[str, Any]:
        return self._client._request(
            "POST", f"/agents/{_encode_segment(agent_id, 'agent_id')}/activate-inbound"
        )

    def deactivate_inbound(self, agent_id: str) -> dict[str, Any]:
        return self._client._request(
            "POST", f"/agents/{_encode_segment(agent_id, 'agent_id')}/deactivate-inbound"
        )


class CallsResource(_Resource):
    def list(self, **params: Any) -> dict[str, Any]:
        return self._client._request("GET", f"/calls{_build_query(params)}")

    def create(
        self, body: Mapping[str, Any], *, idempotency_key: Optional[str] = None
    ) -> dict[str, Any]:
        headers = {"Idempotency-Key": str(idempotency_key)} if idempotency_key else None
        return self._client._request("POST", "/calls", body=body, headers=headers)

    def get(self, call_id: str) -> dict[str, Any]:
        return self._client._request("GET", f"/calls/{_encode_segment(call_id, 'call_id')}")

    def get_recording(self, call_id: str) -> dict[str, Any]:
        return self._client._request(
            "GET", f"/calls/{_encode_segment(call_id, 'call_id')}/recording"
        )

    def get_transcript(self, call_id: str) -> dict[str, Any]:
        return self._client._request(
            "GET", f"/calls/{_encode_segment(call_id, 'call_id')}/transcript"
        )

    def hangup(self, call_id: str) -> dict[str, Any]:
        return self._client._request(
            "POST", f"/calls/{_encode_segment(call_id, 'call_id')}/hangup"
        )


class LeadsResource(_Resource):
    def list(self, **params: Any) -> dict[str, Any]:
        return self._client._request("GET", f"/leads{_build_query(params)}")

    def create(self, body: Mapping[str, Any]) -> dict[str, Any]:
        return self._client._request("POST", "/leads", body=body)

    def get(self, lead_id: str) -> dict[str, Any]:
        return self._client._request("GET", f"/leads/{_encode_segment(lead_id, 'lead_id')}")

    def update(self, lead_id: str, body: Mapping[str, Any]) -> dict[str, Any]:
        return self._client._request(
            "PATCH", f"/leads/{_encode_segment(lead_id, 'lead_id')}", body=body
        )

    def delete(self, lead_id: str) -> dict[str, Any]:
        return self._client._request("DELETE", f"/leads/{_encode_segment(lead_id, 'lead_id')}")


class CampaignsResource(_Resource):
    def list(self, **params: Any) -> dict[str, Any]:
        return self._client._request("GET", f"/campaigns{_build_query(params)}")

    def create(self, body: Mapping[str, Any]) -> dict[str, Any]:
        return self._client._request("POST", "/campaigns", body=body)

    def get(self, campaign_id: str) -> dict[str, Any]:
        return self._client._request(
            "GET", f"/campaigns/{_encode_segment(campaign_id, 'campaign_id')}"
        )

    def update(self, campaign_id: str, body: Mapping[str, Any]) -> dict[str, Any]:
        return self._client._request(
            "PATCH", f"/campaigns/{_encode_segment(campaign_id, 'campaign_id')}", body=body
        )

    def archive(self, campaign_id: str) -> dict[str, Any]:
        return self._client._request(
            "DELETE", f"/campaigns/{_encode_segment(campaign_id, 'campaign_id')}"
        )

    def enroll_leads(self, campaign_id: str, body: Mapping[str, Any]) -> dict[str, Any]:
        return self._client._request(
            "POST", f"/campaigns/{_encode_segment(campaign_id, 'campaign_id')}/leads", body=body
        )

    def cancel(self, campaign_id: str) -> dict[str, Any]:
        return self._client._request(
            "POST", f"/campaigns/{_encode_segment(campaign_id, 'campaign_id')}/cancel"
        )


class PhoneNumbersResource(_Resource):
    def list(self) -> dict[str, Any]:
        return self._client._request("GET", "/phone-numbers")

    def provision(self, body: Optional[Mapping[str, Any]] = None) -> Any:
        return self._client._request("POST", "/phone-numbers/provision", body=body)

    def release(self, body: Optional[Mapping[str, Any]] = None) -> Any:
        return self._client._request("DELETE", "/phone-numbers", body=body)


class WebhooksResource(_Resource):
    def list(self) -> dict[str, Any]:
        return self._client._request("GET", "/workspace/webhooks")

    def create(self, body: Mapping[str, Any]) -> dict[str, Any]:
        return self._client._request("POST", "/workspace/webhooks", body=body)

    def update_settings(self, body: Mapping[str, Any]) -> dict[str, Any]:
        return self._client._request("PATCH", "/workspace/webhooks/settings", body=body)

    def update(self, webhook_id: str, body: Mapping[str, Any]) -> dict[str, Any]:
        return self._client._request(
            "PATCH",
            f"/workspace/webhooks/{_encode_segment(webhook_id, 'webhook_id')}",
            body=body,
        )

    def delete(self, webhook_id: str, *, force: bool = False) -> dict[str, Any]:
        q = _build_query({"force": True} if force else None)
        return self._client._request(
            "DELETE", f"/workspace/webhooks/{_encode_segment(webhook_id, 'webhook_id')}{q}"
        )

    def test(self, webhook_id: str) -> Any:
        return self._client._request(
            "POST", f"/workspace/webhooks/{_encode_segment(webhook_id, 'webhook_id')}/test"
        )

    def list_deliveries(self, webhook_id: str, **params: Any) -> dict[str, Any]:
        return self._client._request(
            "GET",
            f"/workspace/webhooks/{_encode_segment(webhook_id, 'webhook_id')}/deliveries{_build_query(params)}",
        )

    verify_signature = staticmethod(verify_webhook_signature)


class JaanoClient:
    def __init__(
        self,
        api_key: str,
        *,
        base_url: str = DEFAULT_BASE_URL,
        timeout_seconds: float = 30.0,
        max_retries: int = 2,
        retry_base_delay_seconds: float = 0.25,
        transport: Optional[Transport] = None,
        sleep: Optional[Callable[[float], None]] = None,
    ) -> None:
        key = str(api_key or "").strip()
        if not key:
            raise ValueError("JaanoClient requires a non-empty api_key.")
        self._api_key = key
        self._base_url = str(base_url or DEFAULT_BASE_URL).rstrip("/")
        self._timeout_seconds = float(timeout_seconds)
        self._max_retries = max(0, int(max_retries))
        self._retry_base_delay = max(0.0, float(retry_base_delay_seconds))
        self._transport = transport or _default_transport
        self._sleep = sleep or time.sleep

        self.workspace = WorkspaceResource(self)
        self.agents = AgentsResource(self)
        self.calls = CallsResource(self)
        self.leads = LeadsResource(self)
        self.campaigns = CampaignsResource(self)
        self.phone_numbers = PhoneNumbersResource(self)
        self.webhooks = WebhooksResource(self)

    def __enter__(self) -> "JaanoClient":
        return self

    def __exit__(self, *_exc: Any) -> None:
        return None

    def _request(
        self,
        method: str,
        path: str,
        *,
        body: Optional[Mapping[str, Any]] = None,
        headers: Optional[Mapping[str, str]] = None,
    ) -> Any:
        url = f"{self._base_url}{path}"
        req_headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Accept": "application/json",
            "User-Agent": f"jaano-python/{SDK_VERSION}",
        }
        if headers:
            req_headers.update(headers)

        serialized: Optional[str] = None
        if body is not None:
            req_headers["Content-Type"] = "application/json"
            serialized = json.dumps(dict(body))

        attempt = 0
        while True:
            try:
                resp = self._transport(
                    method, url, req_headers, serialized, self._timeout_seconds
                )
            except (JaanoTimeoutError, JaanoNetworkError):
                if attempt < self._max_retries:
                    attempt += 1
                    self._sleep(self._retry_base_delay * (2 ** (attempt - 1)))
                    continue
                raise

            parsed: Any = None
            if resp.body:
                try:
                    parsed = json.loads(resp.body)
                except ValueError:
                    parsed = resp.body

            if 200 <= resp.status < 300:
                return parsed

            retry_after = _parse_retry_after(resp.headers.get("retry-after"))
            if resp.status in _RETRYABLE_STATUSES and attempt < self._max_retries:
                attempt += 1
                delay = (
                    retry_after
                    if retry_after is not None
                    else self._retry_base_delay * (2 ** (attempt - 1))
                )
                self._sleep(delay)
                continue

            err_obj = parsed if isinstance(parsed, dict) else {}
            raise JaanoApiError(
                status=resp.status,
                code=str(err_obj.get("code") or "api_error"),
                message=str(err_obj.get("message") or f"HTTP {resp.status}"),
                request_id=err_obj.get("request_id") or resp.headers.get("x-request-id"),
                retry_after_seconds=retry_after,
                body=parsed,
            )
