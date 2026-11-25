import type * as Types from "./generated/types.d.ts";

export * from "./generated/types.d.ts";

export declare const SDK_VERSION: string;
export declare const DEFAULT_BASE_URL: string;

export declare class JaanoError extends Error {}

export declare class JaanoApiError extends JaanoError {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;
  readonly retryAfterSeconds: number | null;
  readonly body: unknown;
}

export declare class JaanoTimeoutError extends JaanoError {
  readonly timeoutMs: number;
}

export declare class JaanoNetworkError extends JaanoError {
  readonly cause: unknown;
}

export declare class JaanoWebhookVerificationError extends JaanoError {}

export interface JaanoClientConfig {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  maxRetryDelayMs?: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export interface VerifyWebhookOptions {
  toleranceSeconds?: number;
  nowSeconds?: number;
}

export declare function verifyWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string,
  secret: string,
  options?: VerifyWebhookOptions,
): { timestamp: number };

export declare class JaanoClient {
  constructor(config: JaanoClientConfig);

  readonly workspace: {
    me(): Promise<Types.Me>;
    wallet(): Promise<Types.Wallet>;
    listApiKeys(): Promise<Types.ApiKeyList>;
    createApiKey(body: Types.ApiKeyCreateRequest): Promise<Types.ApiKeyCreated>;
    rotateApiKey(keyId: string, body?: Types.ApiKeyRotateRequest): Promise<Types.ApiKeyRotated>;
    revokeApiKey(keyId: string): Promise<Types.ApiKeyRevoked>;
  };

  readonly agents: {
    list(params?: { bot_id?: string; direction?: "inbound" | "outbound"; limit?: number; offset?: number }): Promise<Types.AgentList>;
    create(body: Types.AgentCreateRequest): Promise<Types.AgentCreated>;
    get(agentId: string): Promise<Types.Agent>;
    update(agentId: string, body: Types.AgentUpdateRequest): Promise<Types.Agent>;
    archive(agentId: string): Promise<Types.AgentArchived>;
    activateInbound(agentId: string): Promise<Types.AgentInboundChange>;
    deactivateInbound(agentId: string): Promise<Types.AgentInboundChange>;
  };

  readonly calls: {
    list(params?: { agent_id?: string; status?: string; direction?: "inbound" | "outbound"; limit?: number; offset?: number }): Promise<Types.CallList>;
    create(body: Types.CallCreateRequest, options?: { idempotencyKey?: string }): Promise<Types.CallCreated>;
    get(callId: string): Promise<Types.Call>;
    getRecording(callId: string): Promise<Types.CallRecordingResponse>;
    getTranscript(callId: string): Promise<Types.CallTranscript>;
    hangup(callId: string): Promise<Types.CallHangupResponse>;
  };

  readonly leads: {
    list(params?: { campaign_id?: string; bot_id?: string; agent_id?: string; lead_status?: "hot" | "warm" | "cold" | "unknown"; is_called?: boolean; phone?: string; limit?: number; offset?: number }): Promise<Types.LeadList>;
    create(body: Types.LeadCreateRequest): Promise<Types.Lead>;
    get(leadId: string): Promise<Types.Lead>;
    update(leadId: string, body: Types.LeadUpdateRequest): Promise<Types.Lead>;
    delete(leadId: string): Promise<Types.LeadDeleted>;
  };

  readonly campaigns: {
    list(params?: { bot_id?: string; agent_id?: string; execution_status?: "pending" | "in_progress" | "completed" | "failed" | "cancelled"; limit?: number; offset?: number }): Promise<Types.CampaignList>;
    create(body: Types.CampaignCreateRequest): Promise<Types.Campaign>;
    get(campaignId: string): Promise<Types.Campaign>;
    update(campaignId: string, body: Types.CampaignUpdateRequest): Promise<Types.Campaign>;
    archive(campaignId: string): Promise<Types.CampaignArchived>;
    enrollLeads(campaignId: string, body: Types.EnrollLeadsRequest): Promise<Types.EnrollLeadsResponse>;
    cancel(campaignId: string): Promise<Types.Campaign>;
  };

  readonly phoneNumbers: {
    list(): Promise<Types.PhoneNumberList>;
    provision(body?: Types.PhoneNumberRequest): Promise<unknown>;
    release(body?: Types.PhoneNumberReleaseRequest): Promise<unknown>;
  };

  readonly webhooks: {
    list(): Promise<Types.WebhookList>;
    create(body: Types.WebhookCreateRequest): Promise<Types.WebhookCreated>;
    updateSettings(body: Types.WebhookSettingsRequest): Promise<Types.WebhookSettings>;
    update(webhookId: string, body: Types.WebhookUpdateRequest): Promise<Types.WebhookEndpoint>;
    delete(webhookId: string, options?: { force?: boolean }): Promise<Types.WebhookDeleted>;
    test(webhookId: string): Promise<unknown>;
    listDeliveries(webhookId: string, params?: { limit?: number; offset?: number }): Promise<Types.WebhookDeliveryList>;
    verifySignature: typeof verifyWebhookSignature;
  };
}
