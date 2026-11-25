/**
 * Structured error classes for @jaano-sdk/js.
 */

export class JaanoError extends Error {
  constructor(message) {
    super(message);
    this.name = "JaanoError";
  }
}

export class JaanoApiError extends JaanoError {
  /**
   * @param {object} opts
   * @param {number} opts.status
   * @param {string} opts.code
   * @param {string} opts.message
   * @param {string|null} [opts.requestId]
   * @param {number|null} [opts.retryAfterSeconds]
   * @param {unknown} [opts.body]
   */
  constructor({ status, code, message, requestId = null, retryAfterSeconds = null, body = null }) {
    super(message || `Jaano API error (${status})`);
    this.name = "JaanoApiError";
    this.status = status;
    this.code = code || "api_error";
    this.requestId = requestId;
    this.retryAfterSeconds = retryAfterSeconds;
    this.body = body;
  }
}

export class JaanoTimeoutError extends JaanoError {
  constructor(timeoutMs) {
    super(`Jaano API request timed out after ${timeoutMs}ms`);
    this.name = "JaanoTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export class JaanoNetworkError extends JaanoError {
  constructor(message, cause) {
    super(message);
    this.name = "JaanoNetworkError";
    this.cause = cause;
  }
}

export class JaanoWebhookVerificationError extends JaanoError {
  constructor(message) {
    super(message);
    this.name = "JaanoWebhookVerificationError";
  }
}
