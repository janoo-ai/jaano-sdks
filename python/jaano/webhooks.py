"""HMAC-SHA256 verification for Jaano webhooks (Jaano-Signature: t=...,v0=...)."""
from __future__ import annotations

import hashlib
import hmac
import re
import time
from typing import Optional, Union

from .errors import JaanoWebhookVerificationError

_HEX_RE = re.compile(r"^[0-9a-fA-F]+$")


def verify_webhook_signature(
    raw_body: Union[str, bytes],
    signature_header: str,
    secret: str,
    *,
    tolerance_seconds: int = 300,
    now_seconds: Optional[int] = None,
) -> dict[str, int]:
    if not secret or not isinstance(secret, str):
        raise JaanoWebhookVerificationError("Webhook secret is required.")
    if not signature_header or not isinstance(signature_header, str):
        raise JaanoWebhookVerificationError("Missing Jaano-Signature header.")
    if raw_body is None:
        raise JaanoWebhookVerificationError("Raw request body is required.")

    parts: dict[str, str] = {}
    for segment in signature_header.split(","):
        if "=" not in segment:
            continue
        k, v = segment.split("=", 1)
        k, v = k.strip(), v.strip()
        if k and v:
            parts[k] = v

    raw_ts = parts.get("t")
    signature = parts.get("v0")
    if not raw_ts or not signature or not _HEX_RE.match(signature):
        raise JaanoWebhookVerificationError("Malformed Jaano-Signature header.")

    try:
        timestamp = int(raw_ts)
    except ValueError as exc:
        raise JaanoWebhookVerificationError("Invalid timestamp in Jaano-Signature header.") from exc

    now = int(time.time()) if now_seconds is None else int(now_seconds)
    if tolerance_seconds > 0 and abs(now - timestamp) > tolerance_seconds:
        raise JaanoWebhookVerificationError(
            f"Webhook timestamp outside tolerance ({tolerance_seconds}s)."
        )

    try:
        body_str = raw_body.decode("utf-8") if isinstance(raw_body, bytes) else str(raw_body)
    except UnicodeDecodeError as exc:
        raise JaanoWebhookVerificationError("Webhook body is not valid UTF-8.") from exc
    expected = hmac.new(
        secret.encode("utf-8"),
        f"{timestamp}.{body_str}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected.lower(), signature.lower()):
        raise JaanoWebhookVerificationError("Webhook signature mismatch.")

    return {"timestamp": timestamp}
