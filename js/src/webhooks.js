import crypto from "node:crypto";
import { JaanoWebhookVerificationError } from "./errors.js";

/**
 * Verify a Jaano webhook signature (`Jaano-Signature: t=<unix_sec>,v0=<hex>`).
 * Uses constant-time comparison and enforces a replay-window tolerance.
 *
 * @param {string | Buffer} rawBody
 * @param {string} signatureHeader
 * @param {string} secret
 * @param {{ toleranceSeconds?: number, nowSeconds?: number }} [options]
 * @returns {{ timestamp: number }}
 */
export function verifyWebhookSignature(rawBody, signatureHeader, secret, options = {}) {
  const toleranceSeconds =
    options.toleranceSeconds === undefined ? 300 : Number(options.toleranceSeconds);
  const nowSeconds =
    options.nowSeconds === undefined ? Math.floor(Date.now() / 1000) : Number(options.nowSeconds);

  if (!secret || typeof secret !== "string") {
    throw new JaanoWebhookVerificationError("Webhook secret is required.");
  }
  if (!signatureHeader || typeof signatureHeader !== "string") {
    throw new JaanoWebhookVerificationError("Missing Jaano-Signature header.");
  }
  if (rawBody === undefined || rawBody === null) {
    throw new JaanoWebhookVerificationError("Raw request body is required.");
  }

  const parts = {};
  for (const segment of signatureHeader.split(",")) {
    const idx = segment.indexOf("=");
    if (idx === -1) continue;
    const k = segment.slice(0, idx).trim();
    const v = segment.slice(idx + 1).trim();
    if (k && v) parts[k] = v;
  }

  const rawTs = parts.t;
  const signature = parts.v0;
  if (
    !rawTs ||
    !/^\d+$/.test(rawTs) ||
    !signature ||
    !/^[0-9a-f]{64}$/i.test(signature)
  ) {
    throw new JaanoWebhookVerificationError("Malformed Jaano-Signature header.");
  }
  const timestamp = Number(rawTs);

  if (toleranceSeconds > 0 && Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    throw new JaanoWebhookVerificationError(
      `Webhook timestamp outside tolerance (${toleranceSeconds}s).`,
    );
  }

  const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody);
  const expectedHex = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${bodyStr}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expectedHex, "hex");
  const actualBuf = Buffer.from(signature, "hex");
  if (
    expectedBuf.length !== actualBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, actualBuf)
  ) {
    throw new JaanoWebhookVerificationError("Webhook signature mismatch.");
  }

  return { timestamp };
}
