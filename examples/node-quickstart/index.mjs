/**
 * Sample Node.js app using @jaano-sdk/js.
 *
 * Run:
 *   JAANO_API_KEY=jaano_live_... JAANO_AGENT_ID=agent_... node examples/node-quickstart/index.mjs
 */
import crypto from "node:crypto";
import { JaanoClient, JaanoApiError } from "../../js/src/index.js";

const apiKey = process.env.JAANO_API_KEY;
if (!apiKey) {
  console.error("Set JAANO_API_KEY=jaano_live_... before running.");
  process.exit(1);
}

const client = new JaanoClient({
  apiKey,
  baseUrl: process.env.JAANO_BASE_URL || "https://api.jaano.ai/v1",
});

try {
  const me = await client.workspace.me();
  console.log("Workspace:", me.org_id, "Plan:", me.plan?.type);

  const lead = await client.leads.create({
    lead_name: "Jane Doe",
    lead_phone: "+15555550100",
    lead_description: "Requested a product demo",
  });
  console.log("Created lead:", lead.lead_id);

  if (process.env.JAANO_AGENT_ID && process.env.JAANO_TO_PHONE) {
    const call = await client.calls.create(
      {
        agent_id: process.env.JAANO_AGENT_ID,
        to: process.env.JAANO_TO_PHONE,
        customer_name: lead.lead_name,
        lead_id: lead.lead_id,
        lead_description: lead.lead_description,
      },
      { idempotencyKey: `demo-${crypto.randomUUID()}` },
    );
    console.log("Call queued:", call.call_id, call.status);
  }
} catch (err) {
  if (err instanceof JaanoApiError) {
    console.error(`API error ${err.status} (${err.code}): ${err.message} [request_id=${err.requestId}]`);
    process.exit(1);
  }
  throw err;
}
