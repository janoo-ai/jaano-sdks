"""Sample Python app using the jaano SDK.

Run:
    PYTHONPATH=python JAANO_API_KEY=jaano_live_... python examples/python-quickstart/main.py
"""
from __future__ import annotations

import os
import sys
import uuid

from jaano import JaanoApiError, JaanoClient


def main() -> None:
    api_key = os.environ.get("JAANO_API_KEY", "").strip()
    if not api_key:
        print("Set JAANO_API_KEY=jaano_live_... before running.", file=sys.stderr)
        sys.exit(1)

    base_url = os.environ.get("JAANO_BASE_URL", "https://api.jaano.ai/v1")
    with JaanoClient(api_key, base_url=base_url) as client:
        try:
            me = client.workspace.me()
            print("Workspace:", me.get("org_id"), "Plan:", (me.get("plan") or {}).get("type"))

            lead = client.leads.create(
                {
                    "lead_name": "Jane Doe",
                    "lead_phone": "+15555550100",
                    "lead_description": "Requested a product demo",
                }
            )
            print("Created lead:", lead["lead_id"])

            agent_id = os.environ.get("JAANO_AGENT_ID")
            to_phone = os.environ.get("JAANO_TO_PHONE")
            if agent_id and to_phone:
                call = client.calls.create(
                    {
                        "agent_id": agent_id,
                        "to": to_phone,
                        "customer_name": lead["lead_name"],
                        "lead_id": lead["lead_id"],
                        "lead_description": lead["lead_description"],
                    },
                    idempotency_key=f"demo-{uuid.uuid4()}",
                )
                print("Call queued:", call["call_id"], call["status"])
        except JaanoApiError as err:
            print(
                f"API error {err.status} ({err.code}): {err.message} [request_id={err.request_id}]",
                file=sys.stderr,
            )
            sys.exit(1)


if __name__ == "__main__":
    main()
