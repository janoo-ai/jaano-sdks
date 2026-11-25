import {
  JaanoApiError,
  JaanoNetworkError,
  JaanoTimeoutError,
} from "./errors.js";
import { verifyWebhookSignature } from "./webhooks.js";

export const SDK_VERSION = "1.3.0";
export const DEFAULT_BASE_URL = "https://api.jaano.ai/v1";

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "PUT", "DELETE", "OPTIONS"]);
const DEFAULT_MAX_RETRY_DELAY_MS = 30_000;

function isRetrySafe(method, headers, status) {
  // 429 means the server rejected the request before executing it.
  if (status === 429) return true;
  if (IDEMPOTENT_METHODS.has(String(method || "").toUpperCase())) return true;
  return Object.keys(headers || {}).some((k) => k.toLowerCase() === "idempotency-key");
}

function encodeSegment(value, name) {
  const s = String(value ?? "").trim();
  if (!s) throw new TypeError(`${name} is required.`);
  return encodeURIComponent(s);
}

function buildQuery(params) {
  if (!params || typeof params !== "object") return "";
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

function parseRetryAfter(headerValue) {
  if (!headerValue) return null;
  const secs = Number(headerValue);
  if (Number.isFinite(secs) && secs >= 0) return secs;
  const dateMs = Date.parse(headerValue);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, Math.ceil((dateMs - Date.now()) / 1000));
  }
  return null;
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class JaanoClient {
  /**
   * @param {object} config
   * @param {string} config.apiKey
   * @param {string} [config.baseUrl]
   * @param {number} [config.timeoutMs=30000]
   * @param {number} [config.maxRetries=2]
   * @param {number} [config.retryBaseDelayMs=250]
   * @param {typeof fetch} [config.fetch]
   * @param {(ms: number) => Promise<void>} [config.sleep]
   */
  constructor(config = {}) {
    if (!config || typeof config !== "object") {
      throw new TypeError("JaanoClient requires a configuration object.");
    }
    const apiKey = String(config.apiKey ?? "").trim();
    if (!apiKey) {
      throw new TypeError("JaanoClient requires a non-empty apiKey.");
    }
    this._apiKey = apiKey;
    this._baseUrl = String(config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
    const timeoutMs = config.timeoutMs === undefined ? 30_000 : Number(config.timeoutMs);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new TypeError("timeoutMs must be a positive finite number.");
    }
    this._timeoutMs = timeoutMs;
    this._maxRetries = Math.max(0, Number(config.maxRetries ?? 2));
    this._retryBaseDelayMs = Math.max(0, Number(config.retryBaseDelayMs ?? 250));
    this._maxRetryDelayMs = Math.max(0, Number(config.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS));
    this._fetch = config.fetch || globalThis.fetch;
    this._sleep = config.sleep || defaultSleep;

    if (typeof this._fetch !== "function") {
      throw new TypeError("No fetch implementation available. Pass config.fetch or use Node 18+.");
    }

    this.workspace = {
      me: () => this._request("GET", "/me"),
      wallet: () => this._request("GET", "/wallet"),
      listApiKeys: () => this._request("GET", "/api-keys"),
      createApiKey: (body) => this._request("POST", "/api-keys", { body }),
      rotateApiKey: (keyId, body = {}) =>
        this._request("POST", `/api-keys/${encodeSegment(keyId, "keyId")}/rotate`, { body }),
      revokeApiKey: (keyId) =>
        this._request("DELETE", `/api-keys/${encodeSegment(keyId, "keyId")}`),
    };

    this.agents = {
      list: (params) => this._request("GET", `/agents${buildQuery(params)}`),
      create: (body) => this._request("POST", "/agents", { body }),
      get: (agentId) => this._request("GET", `/agents/${encodeSegment(agentId, "agentId")}`),
      update: (agentId, body) =>
        this._request("PATCH", `/agents/${encodeSegment(agentId, "agentId")}`, { body }),
      archive: (agentId) =>
        this._request("DELETE", `/agents/${encodeSegment(agentId, "agentId")}`),
      activateInbound: (agentId) =>
        this._request("POST", `/agents/${encodeSegment(agentId, "agentId")}/activate-inbound`),
      deactivateInbound: (agentId) =>
        this._request("POST", `/agents/${encodeSegment(agentId, "agentId")}/deactivate-inbound`),
    };

    this.calls = {
      list: (params) => this._request("GET", `/calls${buildQuery(params)}`),
      create: (body, options = {}) =>
        this._request("POST", "/calls", {
          body,
          headers: options.idempotencyKey
            ? { "Idempotency-Key": String(options.idempotencyKey) }
            : undefined,
        }),
      get: (callId) => this._request("GET", `/calls/${encodeSegment(callId, "callId")}`),
      getRecording: (callId) =>
        this._request("GET", `/calls/${encodeSegment(callId, "callId")}/recording`),
      getTranscript: (callId) =>
        this._request("GET", `/calls/${encodeSegment(callId, "callId")}/transcript`),
      hangup: (callId) =>
        this._request("POST", `/calls/${encodeSegment(callId, "callId")}/hangup`),
    };

    this.leads = {
      list: (params) => this._request("GET", `/leads${buildQuery(params)}`),
      create: (body) => this._request("POST", "/leads", { body }),
      get: (leadId) => this._request("GET", `/leads/${encodeSegment(leadId, "leadId")}`),
      update: (leadId, body) =>
        this._request("PATCH", `/leads/${encodeSegment(leadId, "leadId")}`, { body }),
      delete: (leadId) =>
        this._request("DELETE", `/leads/${encodeSegment(leadId, "leadId")}`),
    };

    this.campaigns = {
      list: (params) => this._request("GET", `/campaigns${buildQuery(params)}`),
      create: (body) => this._request("POST", "/campaigns", { body }),
      get: (campaignId) =>
        this._request("GET", `/campaigns/${encodeSegment(campaignId, "campaignId")}`),
      update: (campaignId, body) =>
        this._request("PATCH", `/campaigns/${encodeSegment(campaignId, "campaignId")}`, { body }),
      archive: (campaignId) =>
        this._request("DELETE", `/campaigns/${encodeSegment(campaignId, "campaignId")}`),
      enrollLeads: (campaignId, body) =>
        this._request("POST", `/campaigns/${encodeSegment(campaignId, "campaignId")}/leads`, {
          body,
        }),
      cancel: (campaignId) =>
        this._request("POST", `/campaigns/${encodeSegment(campaignId, "campaignId")}/cancel`),
    };

    this.phoneNumbers = {
      list: () => this._request("GET", "/phone-numbers"),
      provision: (body) => this._request("POST", "/phone-numbers/provision", { body }),
      release: (body) => this._request("DELETE", "/phone-numbers", { body }),
    };

    this.webhooks = {
      list: () => this._request("GET", "/workspace/webhooks"),
      create: (body) => this._request("POST", "/workspace/webhooks", { body }),
      updateSettings: (body) =>
        this._request("PATCH", "/workspace/webhooks/settings", { body }),
      update: (webhookId, body) =>
        this._request("PATCH", `/workspace/webhooks/${encodeSegment(webhookId, "webhookId")}`, {
          body,
        }),
      delete: (webhookId, options = {}) =>
        this._request(
          "DELETE",
          `/workspace/webhooks/${encodeSegment(webhookId, "webhookId")}${buildQuery(
            options.force ? { force: "true" } : undefined,
          )}`,
        ),
      test: (webhookId) =>
        this._request("POST", `/workspace/webhooks/${encodeSegment(webhookId, "webhookId")}/test`),
      listDeliveries: (webhookId, params) =>
        this._request(
          "GET",
          `/workspace/webhooks/${encodeSegment(webhookId, "webhookId")}/deliveries${buildQuery(params)}`,
        ),
      verifySignature: verifyWebhookSignature,
    };
  }

  async _request(method, path, { body, headers = {} } = {}) {
    const url = `${this._baseUrl}${path}`;
    const reqHeaders = {
      Authorization: `Bearer ${this._apiKey}`,
      Accept: "application/json",
      "User-Agent": `@jaano-sdk/js/${SDK_VERSION}`,
      ...headers,
    };

    let serializedBody;
    if (body !== undefined) {
      reqHeaders["Content-Type"] = "application/json";
      serializedBody = JSON.stringify(body);
    }

    let attempt = 0;
    while (true) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this._timeoutMs);

      let response;
      try {
        response = await this._fetch(url, {
          method,
          headers: reqHeaders,
          body: serializedBody,
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        const canRetry = attempt < this._maxRetries && isRetrySafe(method, reqHeaders, null);
        if (err?.name === "AbortError") {
          if (canRetry) {
            attempt += 1;
            const delayMs = Math.min(
              this._maxRetryDelayMs,
              this._retryBaseDelayMs * 2 ** (attempt - 1),
            );
            await this._sleep(delayMs);
            continue;
          }
          throw new JaanoTimeoutError(this._timeoutMs);
        }
        if (canRetry) {
          attempt += 1;
          const delayMs = Math.min(
            this._maxRetryDelayMs,
            this._retryBaseDelayMs * 2 ** (attempt - 1),
          );
          await this._sleep(delayMs);
          continue;
        }
        throw new JaanoNetworkError(err?.message || "Network request failed", err);
      } finally {
        clearTimeout(timer);
      }

      const rawText = await response.text();
      let parsed = null;
      if (rawText) {
        try {
          parsed = JSON.parse(rawText);
        } catch {
          parsed = rawText;
        }
      }

      if (response.ok) {
        return parsed;
      }

      const retryAfterSeconds = parseRetryAfter(response.headers?.get?.("retry-after"));
      if (
        RETRYABLE_STATUSES.has(response.status) &&
        attempt < this._maxRetries &&
        isRetrySafe(method, reqHeaders, response.status)
      ) {
        attempt += 1;
        const rawDelayMs =
          retryAfterSeconds !== null
            ? retryAfterSeconds * 1000
            : this._retryBaseDelayMs * 2 ** (attempt - 1);
        await this._sleep(Math.min(this._maxRetryDelayMs, rawDelayMs));
        continue;
      }

      const errObj = parsed && typeof parsed === "object" ? parsed : {};
      throw new JaanoApiError({
        status: response.status,
        code: errObj.code || "api_error",
        message: errObj.message || response.statusText || `HTTP ${response.status}`,
        requestId: errObj.request_id || response.headers?.get?.("x-request-id") || null,
        retryAfterSeconds,
        body: parsed,
      });
    }
  }
}
