# @jaano-sdk/js

Official Jaano Enterprise Developer API v1 SDK for Node.js (18+) and TypeScript. Zero runtime dependencies.

## Install

```bash
npm install @jaano-sdk/js
```

## Quickstart

```js
import { JaanoClient, verifyWebhookSignature } from "@jaano-sdk/js";

const client = new JaanoClient({ apiKey: process.env.JAANO_API_KEY });

const me = await client.workspace.me();
const call = await client.calls.create(
  { agent_id: "agent_123", to: "+15555550100", customer_name: "Jane Doe" },
  { idempotencyKey: "call-001" },
);
```

Full documentation and examples: [github.com/janoo-ai/jaano-sdks](https://github.com/janoo-ai/jaano-sdks). MIT license.
