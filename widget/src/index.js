/**
 * @jaano-sdk/widget — Typed browser embed for the Jaano AI chat widget.
 * Replaces copy-pasted <script> tags with origin-pinned postMessage events
 * (onLead, onMessage, onOpen, onClose, onReady) and clean SPA lifecycle.
 */

export const DEFAULT_WIDGET_ORIGIN = "https://widget.jaano.ai";
export const WIDGET_VERSION = "1.3.0";

const VALID_POSITIONS = new Set(["bottomRight", "bottomLeft", "topRight", "topLeft"]);
const VALID_THEMES = new Set(["light", "dark", "auto"]);

function validateWidgetOrigin(raw) {
  const input = String(raw || DEFAULT_WIDGET_ORIGIN).trim().replace(/\/+$/, "");
  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    throw new TypeError(`Invalid widgetDomain URL: "${input}"`);
  }
  const isLocal =
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
  if (parsed.protocol !== "https:" && !isLocal) {
    throw new TypeError(
      `widgetDomain must use https: (or http://localhost for local dev). Received: "${input}"`,
    );
  }
  return parsed.origin;
}

function normalizeMessagePayload(data) {
  if (data && typeof data === "object") return data;
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return { type: data };
    }
  }
  return null;
}

export class JaanoWidget {
  constructor(config = {}) {
    if (!config || typeof config !== "object") {
      throw new TypeError("JaanoWidget requires a configuration object.");
    }
    if ("apiKey" in config && config.apiKey) {
      throw new TypeError(
        "Never pass an API key to @jaano-sdk/widget. API keys are server-side secrets only.",
      );
    }

    const chatbotId = String(config.chatbotId ?? "").trim();
    const userId = String(config.userId ?? "").trim();
    if (!chatbotId) throw new TypeError("JaanoWidget requires a non-empty chatbotId.");
    if (!userId) throw new TypeError("JaanoWidget requires a non-empty userId.");

    const position = config.position || "bottomRight";
    if (!VALID_POSITIONS.has(position)) {
      throw new TypeError(`Invalid position "${position}".`);
    }

    const theme = config.theme || "auto";
    if (!VALID_THEMES.has(theme)) {
      throw new TypeError(`Invalid theme "${theme}".`);
    }

    this._config = {
      chatbotId,
      userId,
      widgetOrigin: validateWidgetOrigin(config.widgetDomain),
      position,
      theme,
      color: String(config.color || "#000000"),
      reranking: config.reranking !== undefined ? Boolean(config.reranking) : true,
      queryExpansion: config.queryExpansion !== undefined ? Boolean(config.queryExpansion) : false,
      onLead: typeof config.onLead === "function" ? config.onLead : null,
      onMessage: typeof config.onMessage === "function" ? config.onMessage : null,
      onOpen: typeof config.onOpen === "function" ? config.onOpen : null,
      onClose: typeof config.onClose === "function" ? config.onClose : null,
      onReady: typeof config.onReady === "function" ? config.onReady : null,
      onError: typeof config.onError === "function" ? config.onError : null,
    };

    this._win = config._window || (typeof window !== "undefined" ? window : null);
    this._doc = config._document || (typeof document !== "undefined" ? document : null);

    this._mounted = false;
    this._open = false;
    this._ready = false;
    this._pendingMessages = [];
    this._overlay = null;
    this._container = null;
    this._iframe = null;
    this._button = null;
    this._boundOnMessage = (event) => this._handleMessage(event);
  }

  get isMounted() {
    return this._mounted;
  }

  get isOpen() {
    return this._open;
  }

  buildIframeUrl() {
    const c = this._config;
    const resolvedTheme = c.theme === "auto" ? "light" : c.theme;
    const params = new URLSearchParams({
      clor: c.color,
      theme: resolvedTheme,
      embed: "1",
    });
    return (
      `${c.widgetOrigin}/chatapp/` +
      `${encodeURIComponent(c.userId)}/` +
      `${encodeURIComponent(c.chatbotId)}/` +
      `${c.reranking}/${c.queryExpansion}?${params.toString()}`
    );
  }

  mount(target) {
    if (this._mounted) return this;
    if (!this._win || !this._doc) return this; // SSR-safe no-op

    const root = target || this._doc.body;
    if (!root) return this;

    const c = this._config;
    const isLeft = /left/i.test(c.position);
    const isTop = /top/i.test(c.position);

    const overlay = this._doc.createElement("div");
    overlay.id = "jaano-widget-overlay";
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      display: "none",
      zIndex: "99998",
      pointerEvents: "none",
    });

    const container = this._doc.createElement("div");
    container.id = "jaano-widget-container";
    Object.assign(container.style, {
      position: "fixed",
      bottom: isTop ? "auto" : "16px",
      top: isTop ? "16px" : "auto",
      left: isLeft ? "16px" : "auto",
      right: isLeft ? "auto" : "16px",
      width: "min(360px, calc(100vw - 24px))",
      height: "min(67.5vh, 640px)",
      borderRadius: "16px",
      overflow: "hidden",
      pointerEvents: "auto",
    });

    const iframe = this._doc.createElement("iframe");
    iframe.id = "jaano-widget-iframe";
    iframe.title = "Jaano AI Chat";
    iframe.src = this.buildIframeUrl();
    iframe.sandbox =
      "allow-scripts allow-same-origin allow-popups allow-forms allow-downloads";
    iframe.allow = "microphone";
    Object.assign(iframe.style, {
      width: "100%",
      height: "100%",
      border: "none",
      display: "block",
    });
    iframe.addEventListener("load", () => {
      this._markReady();
    });

    container.appendChild(iframe);
    overlay.appendChild(container);
    root.appendChild(overlay);

    const button = this._doc.createElement("button");
    button.id = "jaano-widget-launcher";
    button.type = "button";
    button.setAttribute("aria-label", "Open Jaano chat");
    Object.assign(button.style, {
      position: "fixed",
      bottom: isTop ? "auto" : "20px",
      top: isTop ? "20px" : "auto",
      left: isLeft ? "20px" : "auto",
      right: isLeft ? "auto" : "20px",
      width: "56px",
      height: "56px",
      borderRadius: "999px",
      backgroundColor: c.color,
      border: "none",
      cursor: "pointer",
      zIndex: "99999",
    });
    button.addEventListener("click", () => this.toggle());
    root.appendChild(button);

    this._win.addEventListener("message", this._boundOnMessage);
    this._overlay = overlay;
    this._container = container;
    this._iframe = iframe;
    this._button = button;
    this._mounted = true;
    return this;
  }

  open() {
    if (!this._mounted) this.mount();
    if (!this._mounted || this._open) return this;
    this._open = true;
    if (this._overlay) this._overlay.style.display = "block";
    this._post({ type: "CHAT_OPENED", source: "jaano_widget_pkg" });
    this._safeCall(this._config.onOpen);
    return this;
  }

  close() {
    if (!this._open) return this;
    this._open = false;
    if (this._overlay) this._overlay.style.display = "none";
    this._post({ type: "CHAT_CLOSED", source: "jaano_widget_pkg" });
    this._safeCall(this._config.onClose);
    return this;
  }

  toggle() {
    return this._open ? this.close() : this.open();
  }

  sendMessage(question) {
    const text = String(question ?? "").trim();
    if (!text) return this;
    if (!this._mounted) this.mount();
    if (!this._ready) {
      this._pendingMessages.push(text);
      return this;
    }
    this._post({ type: "SUBMIT_QUESTION", payload: { question: text } });
    return this;
  }

  setTheme(theme) {
    if (theme !== "light" && theme !== "dark") {
      throw new TypeError(`setTheme expects "light" or "dark". Received: "${theme}"`);
    }
    this._config.theme = theme;
    this._post({ type: "SET_THEME", theme });
    return this;
  }

  destroy() {
    if (!this._mounted) return;
    if (this._win) {
      this._win.removeEventListener("message", this._boundOnMessage);
    }
    this._overlay?.remove?.();
    this._button?.remove?.();
    this._overlay = null;
    this._container = null;
    this._iframe = null;
    this._button = null;
    this._mounted = false;
    this._open = false;
    this._ready = false;
    this._pendingMessages = [];
  }

  _post(message) {
    const win = this._iframe?.contentWindow;
    if (!win || typeof win.postMessage !== "function") return false;
    try {
      win.postMessage(message, this._config.widgetOrigin);
      return true;
    } catch (err) {
      this._safeCall(this._config.onError, err);
      return false;
    }
  }

  _markReady() {
    const firstReady = !this._ready;
    this._ready = true;
    // Always post an init handshake so the iframe learns our exact origin
    // even if open() was called before React mounted its message listener.
    this._post({ type: "JAANO_WIDGET_INIT", source: "jaano_widget_pkg" });
    if (this._open) {
      this._post({ type: "CHAT_OPENED", source: "jaano_widget_pkg" });
    }
    this._flushPending();
    if (firstReady) {
      this._safeCall(this._config.onReady);
    }
  }

  _flushPending() {
    while (this._pendingMessages.length > 0) {
      const q = this._pendingMessages.shift();
      this._post({ type: "SUBMIT_QUESTION", payload: { question: q } });
    }
  }

  _handleMessage(event) {
    // Strict origin & source pinning — ignore messages from any other origin or window.
    if (!event || event.origin !== this._config.widgetOrigin) return;
    if (this._iframe?.contentWindow && event.source !== this._iframe.contentWindow) {
      return;
    }

    const payload = normalizeMessagePayload(event.data);
    if (!payload || !payload.type) return;

    switch (payload.type) {
      case "JAANO_IFRAME_READY":
        this._markReady();
        break;
      case "CLOSE_CHATBOT":
      case "closeChatbot":
        this.close();
        break;
      case "resizeChatbot":
        if (this._container) {
          this._container.style.width = payload.isLarge
            ? "min(420px, calc(100vw - 24px))"
            : "min(360px, calc(100vw - 24px))";
        }
        break;
      case "LEAD_CAPTURED":
      case "JAANO_LEAD":
        this._safeCall(this._config.onLead, payload.payload || payload.lead || payload);
        break;
      case "CHAT_MESSAGE":
      case "JAANO_MESSAGE":
        this._safeCall(this._config.onMessage, payload.payload || payload.message || payload);
        break;
      default:
        break;
    }
  }

  _safeCall(fn, arg) {
    if (typeof fn !== "function") return;
    try {
      fn(arg);
    } catch (err) {
      if (fn !== this._config.onError && typeof this._config.onError === "function") {
        this._config.onError(err);
      }
    }
  }
}

export function createJaanoWidget(config) {
  return new JaanoWidget(config);
}
