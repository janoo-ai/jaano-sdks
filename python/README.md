# jaano (Python SDK)

Official Python client for the Jaano Enterprise Developer API (`/v1`). Python 3.9+, no third-party dependencies.

```bash
pip install jaano
```

```python
from jaano import JaanoClient

with JaanoClient(api_key="jaano_live_...") as client:
    me = client.workspace.me()
    call = client.calls.create(
        {"agent_id": "agent_...", "to": "+15555550100", "customer_name": "Jane Doe"},
        idempotency_key="order-1234",
    )
```

Errors raise `JaanoApiError` with `status`, `code`, and `request_id`. Requests are retried automatically on `429` and `5xx`.

Verify webhook deliveries with `jaano.verify_webhook_signature(raw_body, header, secret)`.

Full reference: [github.com/janoo-ai/jaano-sdks](https://github.com/janoo-ai/jaano-sdks). MIT license.
