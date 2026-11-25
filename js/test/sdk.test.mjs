import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  JaanoClient,
  JaanoApiError,
  JaanoTimeoutError,
  JaanoNetworkError,
  JaanoWebhookVerificationError,
  SDK_VERSION,
  verifyWebhookSignature,
} from "../src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function mockResponse(status, body, headers = {}) {
  const map = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: { get: (k) => map.get(k.toLowerCase()) ?? null },
    text: async () => (body === null || body === undefined ? "" : JSON.stringify(body)),
  };
}

describe("@jaano-sdk/js — configuration & version sync", () => {
  it("requires a non-empty apiKey", () => {
    assert.throws(() => new JaanoClient(), TypeError);
    assert.throws(() => new JaanoClient({ apiKey: "   " }), TypeError);
  });

  it("matches the OpenAPI spec version", () => {
    const spec = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../../openapi/openapi.v1.json"), "utf8"),
    );
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf8"),
    );
    assert.equal(SDK_VERSION, spec.info.version);
    assert.equal(pkg.version, spec.info.version);
  });
});

describe("@jaano-sdk/js — resource endpoints", () => {
  it("sends Authorization, JSON body, query params, and Idempotency-Key", async () => {
    const seen = [];
    const client = new JaanoClient({
      apiKey: "jaano_live_test_key",
      baseUrl: "https://api.jaano.ai/v1/",
      fetch: async (url, init) => {
        seen.push({ url, method: init.method, headers: init.headers, body: init.body });
        return mockResponse(201, { call_id: "call_1", status: "queued" });
      },
    });

    const res = await client.calls.create(
      { agent_id: "agent_1", to: "+15555550100", customer_name: "Jane Doe" },
      { idempotencyKey: "idem-001" },
    );

    assert.equal(res.call_id, "call_1");
    assert.equal(seen.length, 1);
    assert.equal(seen[0].url, "https://api.jaano.ai/v1/calls");
    assert.equal(seen[0].method, "POST");
    assert.equal(seen[0].headers.Authorization, "Bearer jaano_live_test_key");
    assert.equal(seen[0].headers["Idempotency-Key"], "idem-001");
    assert.deepEqual(JSON.parse(seen[0].body), {
      agent_id: "agent_1",
      to: "+15555550100",
      customer_name: "Jane Doe",
    });
  });

  it("encodes path segments and omits empty query params", async () => {
    const urls = [];
    const client = new JaanoClient({
      apiKey: "jaano_live_test",
      fetch: async (url) => {
        urls.push(url);
        return mockResponse(200, { ok: true });
      },
    });

    await client.leads.list({ campaign_id: "camp_1", lead_status: "hot", phone: undefined, limit: 10 });
    await client.leads.get("lead/with space");
    await client.campaigns.enrollLeads("camp_1", {
      leads: [{ lead_name: "Jane Doe", lead_phone: "+15555550100" }],
    });
    await client.webhooks.delete("wh_1", { force: true });

    assert.equal(
      urls[0],
      "https://api.jaano.ai/v1/leads?campaign_id=camp_1&lead_status=hot&limit=10",
    );
    assert.equal(urls[1], "https://api.jaano.ai/v1/leads/lead%2Fwith%20space");
    assert.equal(urls[2], "https://api.jaano.ai/v1/campaigns/camp_1/leads");
    assert.equal(urls[3], "https://api.jaano.ai/v1/workspace/webhooks/wh_1?force=true");
  });

  it("rejects empty path IDs before making a network call", () => {
    const client = new JaanoClient({
      apiKey: "jaano_live_test",
      fetch: async () => {
        throw new Error("should not be called");
      },
    });
    assert.throws(() => client.agents.get(""), TypeError);
    assert.throws(() => client.calls.hangup("   "), TypeError);
  });
});

describe("@jaano-sdk/js — retries, errors, and timeouts", () => {
  it("retries 429 using Retry-After header and succeeds on next attempt", async () => {
    const sleeps = [];
    let calls = 0;
    const client = new JaanoClient({
      apiKey: "jaano_live_test",
      maxRetries: 2,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      fetch: async () => {
        calls += 1;
        if (calls === 1) {
          return mockResponse(
            429,
            { error: true, code: "rate_limited", message: "Slow down", request_id: "req_1" },
            { "retry-after": "3" },
          );
        }
        return mockResponse(200, { org_id: "org_1" });
      },
    });

    const me = await client.workspace.me();
    assert.equal(me.org_id, "org_1");
    assert.equal(calls, 2);
    assert.deepEqual(sleeps, [3000]);
  });

  it("does not retry 4xx non-429 errors and throws structured JaanoApiError", async () => {
    let calls = 0;
    const client = new JaanoClient({
      apiKey: "jaano_live_test",
      maxRetries: 3,
      fetch: async () => {
        calls += 1;
        return mockResponse(422, {
          error: true,
          code: "trai_quiet_hours",
          message: "Calls blocked during quiet hours.",
          request_id: "req_trai",
        });
      },
    });

    await assert.rejects(
      () => client.calls.create({ agent_id: "a", to: "+15555550100" }),
      (err) => {
        assert.ok(err instanceof JaanoApiError);
        assert.equal(err.status, 422);
        assert.equal(err.code, "trai_quiet_hours");
        assert.equal(err.requestId, "req_trai");
        return true;
      },
    );
    assert.equal(calls, 1);
  });

  it("throws JaanoTimeoutError when fetch aborts after maxRetries", async () => {
    const client = new JaanoClient({
      apiKey: "jaano_live_test",
      timeoutMs: 25,
      maxRetries: 1,
      retryBaseDelayMs: 1,
      sleep: async () => {},
      fetch: async (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            const e = new Error("Aborted");
            e.name = "AbortError";
            reject(e);
          });
        }),
    });

    await assert.rejects(() => client.workspace.wallet(), JaanoTimeoutError);
  });

  it("throws JaanoNetworkError on persistent transport failure", async () => {
    const client = new JaanoClient({
      apiKey: "jaano_live_test",
      maxRetries: 0,
      fetch: async () => {
        throw new Error("ECONNREFUSED");
      },
    });

    await assert.rejects(() => client.workspace.me(), JaanoNetworkError);
  });
});

describe("@jaano-sdk/js — webhook HMAC verification", () => {
  const secret = "whsec_test_secret_123456"; // gitleaks:allow (fake test fixture)
  const rawBody = JSON.stringify({ event_id: "evt_1", type: "post_call_transcription" });
  const now = 1700000000;

  function sign(body, ts, key = secret) {
    const hex = crypto.createHmac("sha256", key).update(`${ts}.${body}`).digest("hex");
    return `t=${ts},v0=${hex}`;
  }

  it("accepts a valid signature within tolerance", () => {
    const header = sign(rawBody, now - 10);
    const out = verifyWebhookSignature(rawBody, header, secret, { nowSeconds: now });
    assert.equal(out.timestamp, now - 10);
  });

  it("rejects tampered body, wrong secret, expired timestamp, and malformed header", () => {
    const validHeader = sign(rawBody, now);
    assert.throws(
      () => verifyWebhookSignature(rawBody + " ", validHeader, secret, { nowSeconds: now }),
      JaanoWebhookVerificationError,
    );
    assert.throws(
      () => verifyWebhookSignature(rawBody, validHeader, "whsec_wrong", { nowSeconds: now }),
      JaanoWebhookVerificationError,
    );
    assert.throws(
      () => verifyWebhookSignature(rawBody, sign(rawBody, now - 600), secret, { nowSeconds: now }),
      JaanoWebhookVerificationError,
    );
    assert.throws(
      () => verifyWebhookSignature(rawBody, "not-a-valid-header", secret, { nowSeconds: now }),
      JaanoWebhookVerificationError,
    );
  });
});
