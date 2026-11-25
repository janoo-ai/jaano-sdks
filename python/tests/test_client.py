from __future__ import annotations

import hashlib
import hmac
import json
import pathlib
import unittest

from jaano import (
    JaanoApiError,
    JaanoClient,
    JaanoNetworkError,
    JaanoTimeoutError,
    JaanoWebhookVerificationError,
    SDK_VERSION,
    TransportResponse,
    verify_webhook_signature,
)


class TestJaanoClient(unittest.TestCase):
    def test_requires_non_empty_api_key(self) -> None:
        with self.assertRaises(ValueError):
            JaanoClient("")
        with self.assertRaises(ValueError):
            JaanoClient("   ")
        with self.assertRaises(ValueError):
            JaanoClient("jaano_live_test", timeout_seconds=0)
        with self.assertRaises(ValueError):
            JaanoClient("jaano_live_test", timeout_seconds=-1.0)

    def test_version_matches_openapi_spec(self) -> None:
        spec_path = pathlib.Path(__file__).resolve().parents[2] / "openapi" / "openapi.v1.json"
        spec = json.loads(spec_path.read_text(encoding="utf-8"))
        self.assertEqual(SDK_VERSION, spec["info"]["version"])

    def test_create_call_sends_auth_body_and_idempotency_key(self) -> None:
        seen = []

        def transport(method, url, headers, body, timeout):
            seen.append((method, url, headers, body, timeout))
            return TransportResponse(
                status=201,
                headers={"content-type": "application/json"},
                body=json.dumps({"call_id": "call_123", "status": "queued"}),
            )

        with JaanoClient("jaano_live_test", base_url="https://api.jaano.ai/v1/", transport=transport) as client:
            res = client.calls.create(
                {"agent_id": "agent_1", "to": "+15555550100", "customer_name": "Jane Doe"},
                idempotency_key="idem-py-1",
            )

        self.assertEqual(res["call_id"], "call_123")
        method, url, headers, body, _ = seen[0]
        self.assertEqual(method, "POST")
        self.assertEqual(url, "https://api.jaano.ai/v1/calls")
        self.assertEqual(headers["Authorization"], "Bearer jaano_live_test")
        self.assertEqual(headers["Idempotency-Key"], "idem-py-1")
        self.assertEqual(json.loads(body)["customer_name"], "Jane Doe")

    def test_path_encoding_and_query_params(self) -> None:
        urls = []

        def transport(method, url, headers, body, timeout):
            urls.append((method, url))
            return TransportResponse(status=200, headers={}, body='{"ok": true}')

        client = JaanoClient("jaano_live_test", transport=transport)
        client.leads.list(campaign_id="camp_1", is_called=False, phone=None, limit=10)
        client.leads.get("lead/with space")
        client.campaigns.enroll_leads(
            "camp_1", {"leads": [{"lead_name": "Jane Doe", "lead_phone": "+15555550100"}]}
        )
        client.webhooks.delete("wh_1", force=True)

        self.assertEqual(
            urls[0],
            ("GET", "https://api.jaano.ai/v1/leads?campaign_id=camp_1&is_called=false&limit=10"),
        )
        self.assertEqual(urls[1], ("GET", "https://api.jaano.ai/v1/leads/lead%2Fwith%20space"))
        self.assertEqual(urls[2], ("POST", "https://api.jaano.ai/v1/campaigns/camp_1/leads"))
        self.assertEqual(urls[3], ("DELETE", "https://api.jaano.ai/v1/workspace/webhooks/wh_1?force=true"))

    def test_rejects_empty_path_ids(self) -> None:
        client = JaanoClient(
            "jaano_live_test",
            transport=lambda *a: (_ for _ in ()).throw(AssertionError("should not call transport")),
        )
        with self.assertRaises(ValueError):
            client.agents.get("")
        with self.assertRaises(ValueError):
            client.calls.hangup("   ")

    def test_retries_429_respecting_retry_after(self) -> None:
        sleeps: list[float] = []
        attempts = 0

        def transport(method, url, headers, body, timeout):
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                return TransportResponse(
                    status=429,
                    headers={"retry-after": "2"},
                    body=json.dumps({"error": True, "code": "rate_limited", "message": "Slow down"}),
                )
            return TransportResponse(status=200, headers={}, body='{"org_id": "org_1"}')

        client = JaanoClient(
            "jaano_live_test",
            max_retries=2,
            transport=transport,
            sleep=sleeps.append,
        )
        me = client.workspace.me()
        self.assertEqual(me["org_id"], "org_1")
        self.assertEqual(attempts, 2)
        self.assertEqual(sleeps, [2.0])

    def test_does_not_retry_422_and_raises_structured_api_error(self) -> None:
        attempts = 0

        def transport(method, url, headers, body, timeout):
            nonlocal attempts
            attempts += 1
            return TransportResponse(
                status=422,
                headers={},
                body=json.dumps(
                    {
                        "error": True,
                        "code": "dnd_registered",
                        "message": "Number is on NDNC.",
                        "request_id": "req_dnd",
                    }
                ),
            )

        client = JaanoClient("jaano_live_test", max_retries=3, transport=transport)
        with self.assertRaises(JaanoApiError) as ctx:
            client.calls.create({"agent_id": "a", "to": "+15555550100"})

        self.assertEqual(attempts, 1)
        self.assertEqual(ctx.exception.status, 422)
        self.assertEqual(ctx.exception.code, "dnd_registered")
        self.assertEqual(ctx.exception.request_id, "req_dnd")

    def test_retries_timeout_and_raises_after_exhaustion(self) -> None:
        attempts = 0

        def transport(*_args):
            nonlocal attempts
            attempts += 1
            raise JaanoTimeoutError(5.0)

        client = JaanoClient(
            "jaano_live_test",
            max_retries=1,
            retry_base_delay_seconds=0.0,
            transport=transport,
            sleep=lambda _: None,
        )
        with self.assertRaises(JaanoTimeoutError):
            client.workspace.wallet()
        self.assertEqual(attempts, 2)

    def test_raises_network_error(self) -> None:
        def transport(*_args):
            raise JaanoNetworkError("connection refused")

        client = JaanoClient("jaano_live_test", max_retries=0, transport=transport)
        with self.assertRaises(JaanoNetworkError):
            client.workspace.me()

    def test_rotate_api_key(self) -> None:
        seen = []

        def transport(method, url, headers, body, timeout):
            seen.append((method, url, body))
            return TransportResponse(
                status=201,
                headers={},
                body=json.dumps({"rotated": True, "key_id": "key_new", "api_key": "jaano_live_new"}),
            )

        client = JaanoClient("jaano_live_test", transport=transport)
        res = client.workspace.rotate_api_key("key_old", {"grace_period_seconds": 600})
        self.assertTrue(res["rotated"])
        self.assertEqual(seen[0][0], "POST")
        self.assertEqual(seen[0][1], "https://api.jaano.ai/v1/api-keys/key_old/rotate")
        self.assertEqual(json.loads(seen[0][2]), {"grace_period_seconds": 600})

    def test_does_not_retry_non_idempotent_post_on_5xx_without_idempotency_key(self) -> None:
        attempts = 0

        def transport(*_args):
            nonlocal attempts
            attempts += 1
            return TransportResponse(
                status=503,
                headers={},
                body=json.dumps({"code": "service_unavailable", "message": "Busy"}),
            )

        client = JaanoClient("jaano_live_test", max_retries=2, transport=transport, sleep=lambda _: None)
        with self.assertRaises(JaanoApiError):
            client.calls.create({"agent_id": "a", "to": "+15555550100"})
        self.assertEqual(attempts, 1)

        # With idempotency_key, 503 IS retried
        attempts = 0

        def transport_recover(*_args):
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                return TransportResponse(status=503, headers={}, body='{"code":"service_unavailable"}')
            return TransportResponse(status=201, headers={}, body='{"call_id":"call_ok"}')

        client_idem = JaanoClient(
            "jaano_live_test", max_retries=2, transport=transport_recover, sleep=lambda _: None
        )
        out = client_idem.calls.create({"agent_id": "a", "to": "+15555550100"}, idempotency_key="idem-1")
        self.assertEqual(out["call_id"], "call_ok")
        self.assertEqual(attempts, 2)

    def test_caps_retry_after_delay(self) -> None:
        sleeps: list[float] = []
        attempts = 0

        def transport(*_args):
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                return TransportResponse(status=429, headers={"retry-after": "86400"}, body="{}")
            return TransportResponse(status=200, headers={}, body='{"ok": true}')

        client = JaanoClient(
            "jaano_live_test",
            max_retries=1,
            max_retry_delay_seconds=5.0,
            transport=transport,
            sleep=sleeps.append,
        )
        client.workspace.me()
        self.assertEqual(sleeps, [5.0])


class TestWebhookSignature(unittest.TestCase):
    secret = "whsec_py_test_secret"
    body = '{"event_id":"evt_1","type":"post_call_transcription"}'
    now = 1700000000

    def _sign(self, body: str, ts: int, secret: str = secret) -> str:
        digest = hmac.new(
            secret.encode("utf-8"),
            f"{ts}.{body}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return f"t={ts},v0={digest}"

    def test_valid_signature(self) -> None:
        header = self._sign(self.body, self.now - 15)
        out = verify_webhook_signature(self.body, header, self.secret, now_seconds=self.now)
        self.assertEqual(out["timestamp"], self.now - 15)

    def test_rejects_tampered_wrong_secret_expired_and_malformed(self) -> None:
        valid = self._sign(self.body, self.now)
        with self.assertRaises(JaanoWebhookVerificationError):
            verify_webhook_signature(self.body + " ", valid, self.secret, now_seconds=self.now)
        with self.assertRaises(JaanoWebhookVerificationError):
            verify_webhook_signature(self.body, valid, "whsec_wrong", now_seconds=self.now)
        with self.assertRaises(JaanoWebhookVerificationError):
            verify_webhook_signature(
                self.body, self._sign(self.body, self.now - 600), self.secret, now_seconds=self.now
            )
        with self.assertRaises(JaanoWebhookVerificationError):
            verify_webhook_signature(self.body, "bad-header", self.secret, now_seconds=self.now)
        with self.assertRaises(JaanoWebhookVerificationError):
            verify_webhook_signature(b"\xff\xfe", valid, self.secret, now_seconds=self.now)


if __name__ == "__main__":
    unittest.main()
