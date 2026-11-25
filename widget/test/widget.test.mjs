import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_WIDGET_ORIGIN,
  JaanoWidget,
  createJaanoWidget,
} from "../src/index.js";

/** Minimal in-memory DOM/window harness so tests run in pure Node with zero deps. */
function createDomHarness() {
  const windowListeners = new Map();
  const posted = [];

  function makeElement(tag) {
    const el = {
      tagName: tag.toUpperCase(),
      id: "",
      style: {},
      children: [],
      attributes: {},
      listeners: new Map(),
      contentWindow:
        tag === "iframe"
          ? {
              postMessage: (msg, origin) => posted.push({ msg, origin }),
            }
          : null,
      setAttribute(k, v) {
        this.attributes[k] = String(v);
      },
      appendChild(child) {
        child.parent = this;
        this.children.push(child);
        return child;
      },
      remove() {
        if (this.parent) {
          this.parent.children = this.parent.children.filter((c) => c !== this);
        }
      },
      addEventListener(type, fn) {
        const list = this.listeners.get(type) || [];
        list.push(fn);
        this.listeners.set(type, list);
      },
      dispatch(type, event) {
        for (const fn of this.listeners.get(type) || []) fn(event);
      },
    };
    return el;
  }

  const body = makeElement("body");
  const doc = {
    body,
    createElement: makeElement,
  };
  const win = {
    addEventListener(type, fn) {
      const list = windowListeners.get(type) || [];
      list.push(fn);
      windowListeners.set(type, list);
    },
    removeEventListener(type, fn) {
      const list = windowListeners.get(type) || [];
      windowListeners.set(
        type,
        list.filter((x) => x !== fn),
      );
    },
    dispatchMessage(event) {
      for (const fn of windowListeners.get("message") || []) fn(event);
    },
    listenerCount(type) {
      return (windowListeners.get(type) || []).length;
    },
  };

  return { win, doc, body, posted };
}

describe("@jaano-sdk/widget — validation & security", () => {
  it("requires chatbotId and userId and rejects API keys in browser config", () => {
    assert.throws(() => new JaanoWidget({}), TypeError);
    assert.throws(() => new JaanoWidget({ chatbotId: "bot_1" }), TypeError);
    assert.throws(
      () => new JaanoWidget({ chatbotId: "bot_1", userId: "usr_1", apiKey: "jaano_live_secret" }),
      TypeError,
    );
  });

  it("rejects non-HTTPS widgetDomain except localhost", () => {
    assert.throws(
      () =>
        new JaanoWidget({
          chatbotId: "bot_1",
          userId: "usr_1",
          widgetDomain: "javascript:alert(1)",
        }),
      TypeError,
    );
    assert.throws(
      () =>
        new JaanoWidget({
          chatbotId: "bot_1",
          userId: "usr_1",
          widgetDomain: "http://evil.example.com",
        }),
      TypeError,
    );

    const local = new JaanoWidget({
      chatbotId: "bot_1",
      userId: "usr_1",
      widgetDomain: "http://localhost:5173",
    });
    assert.match(local.buildIframeUrl(), /^http:\/\/localhost:5173\/chatapp\//);
  });

  it("is SSR-safe when window/document are absent", () => {
    const widget = createJaanoWidget({ chatbotId: "bot_1", userId: "usr_1" });
    widget.mount();
    assert.equal(widget.isMounted, false);
  });
});

describe("@jaano-sdk/widget — lifecycle, events & origin pinning", () => {
  it("mounts, opens, queues messages until iframe load, and dispatches onLead/onMessage", () => {
    const { win, doc, body, posted } = createDomHarness();
    const leads = [];
    const messages = [];
    let opened = 0;
    let closed = 0;
    let ready = 0;

    const widget = new JaanoWidget({
      chatbotId: "bot_123",
      userId: "usr_456",
      color: "#112233",
      theme: "dark",
      onLead: (lead) => leads.push(lead),
      onMessage: (msg) => messages.push(msg),
      onOpen: () => (opened += 1),
      onClose: () => (closed += 1),
      onReady: () => (ready += 1),
      _window: win,
      _document: doc,
    });

    widget.mount();
    assert.equal(widget.isMounted, true);
    assert.equal(body.children.length, 2); // overlay + launcher button

    // Queue message before iframe load
    widget.sendMessage("What are your pricing plans?");
    assert.equal(posted.length, 0);

    // Simulate iframe load
    const iframe = widget._iframe;
    iframe.dispatch("load", {});
    assert.equal(ready, 1);
    assert.equal(posted.length, 2);
    assert.equal(posted[0].origin, DEFAULT_WIDGET_ORIGIN);
    assert.deepEqual(posted[0].msg, {
      type: "JAANO_WIDGET_INIT",
      source: "jaano_widget_pkg",
    });
    assert.equal(posted[1].origin, DEFAULT_WIDGET_ORIGIN);
    assert.deepEqual(posted[1].msg, {
      type: "SUBMIT_QUESTION",
      payload: { question: "What are your pricing plans?" },
    });

    widget.open();
    assert.equal(widget.isOpen, true);
    assert.equal(opened, 1);

    // Spoofed origin MUST be ignored
    win.dispatchMessage({
      origin: "https://evil.example.com",
      source: iframe.contentWindow,
      data: { type: "LEAD_CAPTURED", payload: { name: "Attacker" } },
    });
    assert.equal(leads.length, 0);

    // Valid origin & source dispatches onLead and onMessage
    win.dispatchMessage({
      origin: DEFAULT_WIDGET_ORIGIN,
      source: iframe.contentWindow,
      data: { type: "LEAD_CAPTURED", payload: { name: "Jane Doe", phone: "+15555550100" } },
    });
    win.dispatchMessage({
      origin: DEFAULT_WIDGET_ORIGIN,
      source: iframe.contentWindow,
      data: { type: "CHAT_MESSAGE", payload: { role: "assistant", text: "Hello!" } },
    });
    assert.equal(leads.length, 1);
    assert.equal(leads[0].name, "Jane Doe");
    assert.equal(messages.length, 1);
    assert.equal(messages[0].text, "Hello!");

    // Close via postMessage from iframe
    win.dispatchMessage({
      origin: DEFAULT_WIDGET_ORIGIN,
      source: iframe.contentWindow,
      data: { type: "CLOSE_CHATBOT" },
    });
    assert.equal(widget.isOpen, false);
    assert.equal(closed, 1);

    // Clean destroy removes DOM and listeners
    widget.destroy();
    assert.equal(widget.isMounted, false);
    assert.equal(body.children.length, 0);
    assert.equal(win.listenerCount("message"), 0);
  });

  it("re-sends JAANO_WIDGET_INIT and CHAT_OPENED when iframe announces JAANO_IFRAME_READY", () => {
    const { win, doc, posted } = createDomHarness();
    let readyCalls = 0;
    const widget = new JaanoWidget({
      chatbotId: "bot_1",
      userId: "usr_1",
      position: "topLeft",
      onReady: () => (readyCalls += 1),
      _window: win,
      _document: doc,
    });

    // Open BEFORE iframe finishes loading
    widget.open();
    assert.equal(widget._button.style.top, "20px");
    assert.equal(widget._button.style.bottom, "auto");
    assert.equal(widget._button.style.left, "20px");

    posted.length = 0; // clear pre-load postMessage that React would have missed
    win.dispatchMessage({
      origin: DEFAULT_WIDGET_ORIGIN,
      source: widget._iframe.contentWindow,
      data: { type: "JAANO_IFRAME_READY" },
    });

    assert.equal(readyCalls, 1);
    assert.deepEqual(
      posted.map((p) => p.msg.type),
      ["JAANO_WIDGET_INIT", "CHAT_OPENED"],
    );

    // Null source must be rejected when iframe.contentWindow exists
    const leads = [];
    widget._config.onLead = (l) => leads.push(l);
    win.dispatchMessage({
      origin: DEFAULT_WIDGET_ORIGIN,
      source: null,
      data: { type: "LEAD_CAPTURED", payload: { name: "Spoof" } },
    });
    assert.equal(leads.length, 0);
    widget.destroy();
  });
});
