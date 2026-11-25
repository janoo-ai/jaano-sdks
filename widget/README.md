# @jaano-sdk/widget

Typed browser embed for the Jaano AI chat widget. Replaces copy-pasted `<script>` tags with origin-pinned `postMessage` events (`onLead`, `onMessage`, `onOpen`, `onClose`, `onReady`) and clean SPA lifecycle.

## Install

```bash
npm install @jaano-sdk/widget
```

## Quickstart

```js
import { createJaanoWidget } from "@jaano-sdk/widget";

const widget = createJaanoWidget({
  chatbotId: "bot_123",
  userId: "usr_456",
  theme: "dark",
  onLead: (lead) => console.log("Lead captured:", lead),
  onMessage: (msg) => console.log(msg.role, msg.text),
});

widget.mount();
```

Never pass a private `jaano_live_...` API key to the browser widget. Full docs: [github.com/janoo-ai/jaano-sdks](https://github.com/janoo-ai/jaano-sdks). MIT license.
