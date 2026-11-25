"""Structured error classes for the Jaano Python SDK."""
from __future__ import annotations

from typing import Any, Optional


class JaanoError(Exception):
    """Base exception for all Jaano SDK errors."""


class JaanoApiError(JaanoError):
    def __init__(
        self,
        *,
        status: int,
        code: str,
        message: str,
        request_id: Optional[str] = None,
        retry_after_seconds: Optional[float] = None,
        body: Any = None,
    ) -> None:
        super().__init__(message or f"Jaano API error ({status})")
        self.status = status
        self.code = code or "api_error"
        self.message = message
        self.request_id = request_id
        self.retry_after_seconds = retry_after_seconds
        self.body = body


class JaanoTimeoutError(JaanoError):
    def __init__(self, timeout_seconds: float) -> None:
        super().__init__(f"Jaano API request timed out after {timeout_seconds}s")
        self.timeout_seconds = timeout_seconds


class JaanoNetworkError(JaanoError):
    pass


class JaanoWebhookVerificationError(JaanoError):
    pass
