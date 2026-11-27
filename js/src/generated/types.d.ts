// AUTO-GENERATED from openapi/openapi.v1.json. DO NOT EDIT.
// OpenAPI version: 1.3.0

export const OPENAPI_VERSION = "1.3.0" as const;

export type ErrorEnvelope = {
  error: true;
  code: string;
  message: string;
  request_id?: string | null;
};
export type PageMeta = {
  total?: number;
  limit?: number;
  offset?: number;
};
export type Pagination = {
  total?: number;
  limit?: number;
  offset?: number;
  has_more?: boolean;
};
export type Metadata = Record<string, unknown>;
export type Me = {
  org_id?: string;
  user_id?: string;
  name?: string;
  company_name?: string;
  plan?: {
    type?: string;
    expired_at?: string | null;
    voice_blocked?: boolean;
    entitlements?: Record<string, unknown>;
  };
  abuse_tier?: string;
  webhooks?: {
    default_post_call_webhook_id?: string | null;
    default_webhook_events?: Array<string>;
  };
  api_key?: {
    key_id?: string;
    name?: string;
    scopes?: Array<string>;
    default_bot_id?: string | null;
  } | null;
  limits?: {
    max_live_outbound_global?: number;
    max_live_inbound_global?: number;
    max_api_keys?: number;
  };
};
export type Wallet = {
  org_id?: string;
  currency?: string;
  credit_unit_value_inr?: number;
  call_credits?: number;
  reserved_credits?: number;
  available_credits?: number;
  plan_type?: string;
  plan_expired_at?: string | null;
  voice_blocked?: boolean;
  abuse_tier?: string;
  rate_card?: {
    standard_per_minute?: number;
    transfer_per_minute?: number;
    voicemail_flat_plivo?: number;
    voicemail_flat_exotel?: number;
    voicemail_max_duration_secs?: number;
    min_credits_to_dial?: number;
  };
};
export type ApiKey = {
  key_id?: string;
  name?: string;
  key_prefix?: string;
  scopes?: Array<string>;
  status?: "active" | "revoked" | "expired";
  default_bot_id?: string | null;
  allowed_ips?: Array<string>;
  expires_at?: string | null;
  revoked_at?: string | null;
  last_used_at?: string | null;
  rate_limit_per_min?: number | null;
  created_at?: string;
};
export type ApiKeyAuditEvent = {
  event_id?: string;
  action?: "api_key.created" | "api_key.rotated" | "api_key.revoked" | "api_key.deleted";
  target_type?: string;
  target_id?: string;
  actor_user_id?: string;
  actor_email?: string;
  metadata?: Record<string, unknown>;
  created_at?: string | null;
};
export type ApiKeyAuditList = {
  data?: Array<ApiKeyAuditEvent>;
  meta?: {
    total?: number;
    limit?: number;
    skip?: number;
  };
};
export type ApiKeyCreateRequest = {
  name: string;
  mode?: "live" | "test";
  rate_limit_per_min?: number;
  scopes?: Array<string>;
  expires_at?: string | null;
  allowed_ips?: Array<string>;
  default_bot_id?: string;
};
export type ApiKeyCreated = ApiKey & {
  api_key?: string;
  warning?: string;
};
export type ApiKeyList = {
  data?: Array<ApiKey>;
  meta?: {
    total?: number;
    active_count?: number;
    max_active_keys?: number;
    available_scopes?: Array<string>;
  };
};
export type ApiKeyRotateRequest = {
  grace_period_seconds?: number;
};
export type ApiKeyRotated = ApiKeyCreated & {
  rotated?: true;
  previous_key?: ApiKey;
};
export type ApiKeyRevoked = {
  revoked?: true;
  key?: ApiKey;
};
export type Agent = {
  agent_id?: string;
  bot_id?: string;
  agent_name?: string;
  company_name?: string;
  company_description?: string;
  direction?: "inbound" | "outbound";
  is_active_inbound?: boolean;
  agent_type?: string;
  agent_goal?: string;
  voice_backend?: "pipecat";
  phone_number_type?: "indian" | "international";
  voice_carrier?: string | null;
  assigned_phone_number?: string | null;
  first_message?: string;
  agent_language?: string;
  additional_languages?: Array<string>;
  voice_gender?: "male" | "female";
  maxdurationseconds?: number;
  inbound_company_details?: string;
  platform_settings?: {
    webhooks?: {
      post_call_webhook_id?: string | null;
      events?: Array<string> | null;
    };
  };
  created_at?: string | null;
};
export type AgentCreateRequest = {
  company_name: string;
  agent_name?: string;
  company_description?: string;
  inbound_company_details?: string;
  first_message?: string;
  direction?: "inbound" | "outbound";
  agent_language?: string;
  additional_languages?: Array<string>;
  voice_gender?: "male" | "female";
  maxdurationseconds?: number;
  phone_number_type?: "indian" | "international";
  voice_carrier?: string;
  assigned_phone_number?: string;
  agent_type?: string;
  agent_goal?: string;
  voice_backend?: "pipecat";
  bot_id?: string;
  platform_settings?: {
    webhooks?: {
      post_call_webhook_id?: string | null;
      events?: Array<string>;
    };
  };
};
export type AgentUpdateRequest = {
  company_name?: string;
  agent_name?: string;
  company_description?: string;
  inbound_company_details?: string;
  first_message?: string;
  agent_language?: string;
  additional_languages?: Array<string>;
  voice_gender?: "male" | "female";
  maxdurationseconds?: number;
  platform_settings?: {
    webhooks?: {
      post_call_webhook_id?: string | null;
      events?: Array<string>;
    };
  };
};
export type AgentCreated = Agent & {
  bot_created?: boolean;
};
export type AgentList = {
  data?: Array<Agent>;
  meta?: PageMeta;
};
export type AgentArchived = {
  archived?: true;
  agent_id?: string;
  deleted_at?: string;
};
export type AgentInboundChange = {
  activated?: boolean;
  deactivated?: boolean;
  agent?: Agent;
  demoted_agent_ids?: Array<string>;
};
export type Recording = {
  status?: "pending" | "ready" | "unavailable";
  available?: boolean;
  url?: string | null;
  url_expires_in_secs?: number | null;
  transfer?: Record<string, unknown> | null;
};
export type CallBilling = {
  credits_deducted?: boolean;
  credits_amount?: number;
  credit_tier?: string;
  billing_mode?: string | null;
  transfer_credits_amount?: number;
};
export type Call = {
  call_id?: string;
  agent_id?: string;
  bot_id?: string;
  lead_id?: string | null;
  direction?: "inbound" | "outbound";
  status?: string;
  duration_secs?: number | null;
  carrier?: string | null;
  phone_number_type?: "indian" | "international";
  conversation_id?: string | null;
  billing?: CallBilling;
  recording?: Recording;
  created_at?: string | null;
};
export type CallCreateRequest = {
  agent_id: string;
  to: string;
  from_phone_number?: string;
  customer_name?: string;
  lead_id?: string;
  lead_description?: string;
  dynamic_variables?: Record<string, unknown>;
  metadata?: Metadata;
  strict_dnd?: boolean;
  first_message?: string;
};
export type CallCreated = Call & {
  from?: string | null;
  to?: string;
  call_sid?: string | null;
  reserved_credits?: number;
};
export type CallList = {
  data?: Array<Call>;
  meta?: PageMeta;
};
export type CallRecordingResponse = {
  call_id?: string;
  recording?: Recording;
};
export type CallTranscript = {
  call_id?: string;
  conversation_id?: string | null;
  summary?: string;
  call_summary_title?: string;
  call_successful?: string;
  turns?: Array<Record<string, unknown>>;
  created_at?: string | null;
};
export type CallHangupResponse = {
  call_id?: string;
  status?: "canceled" | "completed";
  hangup_requested?: boolean;
  already_ended?: boolean;
  carrier_warning?: string;
};
export type PhoneNumber = {
  phone_number?: string;
  carrier?: "exotel" | "plivo" | "twilio";
  direction?: "inbound" | "outbound";
  phone_number_type?: "indian" | "international";
  agent_id?: string | null;
  agent_name?: string | null;
};
export type PhoneNumberList = {
  data?: Array<PhoneNumber>;
  limits?: {
    max_per_carrier?: number;
    by_carrier?: Record<string, unknown>;
  };
};
export type PhoneNumberRequest = {
  direction?: "outbound" | "inbound";
  phone_number_type?: "indian" | "international";
  carrier?: "exotel" | "plivo" | "twilio";
};
export type PhoneNumberReleaseRequest = {
  direction?: "outbound" | "inbound";
  phone_number_type?: "indian" | "international";
};
export type Lead = {
  lead_id?: string;
  lead_name?: string;
  lead_phone?: string;
  lead_description?: string;
  campaign_id?: string;
  bot_id?: string;
  agent_id?: string | null;
  lead_status?: "hot" | "warm" | "cold" | "unknown";
  classification_label?: string | null;
  is_called?: boolean;
  latest_call_status?: string;
  callback_requested?: boolean;
  callback_requested_at?: string | null;
  variables?: Record<string, unknown>;
  captured_fields?: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
};
export type LeadCreateRequest = {
  lead_name: string;
  lead_phone?: string;
  lead_description?: string;
  lead_status?: "hot" | "warm" | "cold" | "unknown";
  campaign_id?: string;
  agent_id?: string;
  bot_id?: string;
  variables?: Record<string, unknown>;
};
export type LeadUpdateRequest = {
  lead_name?: string;
  lead_phone?: string;
  lead_description?: string;
  agent_id?: string;
  lead_status?: "hot" | "warm" | "cold" | "unknown";
  callback_requested?: boolean;
  variables?: Record<string, unknown>;
};
export type LeadList = {
  leads?: Array<Lead>;
  pagination?: Pagination;
};
export type LeadDeleted = {
  lead_id?: string;
  deleted?: true;
  deleted_at?: string;
};
export type Campaign = {
  campaign_id?: string;
  campaign_name?: string;
  bot_id?: string;
  agent_id?: string | null;
  campaign_type?: "with_template" | "without_template" | "workflow";
  execution_status?: "pending" | "in_progress" | "completed" | "failed" | "cancelled";
  is_scheduled?: boolean;
  scheduled_time?: string | null;
  executed_at?: string | null;
  failure_reason?: string | null;
  lead_count?: number;
  ask_variables?: Array<{
    key?: string;
    label?: string;
    source?: string;
    column?: string;
  }>;
  created_at?: string | null;
};
export type CampaignCreateRequest = {
  campaign_name: string;
  agent_id?: string;
  bot_id?: string;
  campaign_type?: "with_template" | "without_template" | "workflow";
  scheduled_time?: string;
  ask_variables?: Array<{
    key: string;
    label?: string;
    source?: string;
    column?: string;
  }>;
};
export type CampaignUpdateRequest = {
  campaign_name?: string;
  agent_id?: string;
  scheduled_time?: string | null;
  ask_variables?: Array<Record<string, unknown>>;
};
export type CampaignList = {
  campaigns?: Array<Campaign>;
  pagination?: Pagination;
};
export type CampaignArchived = {
  campaign_id?: string;
  archived?: true;
  deleted_at?: string;
};
export type EnrollLeadsRequest = {
  leads: Array<{
    lead_name: string;
    lead_phone: string;
    lead_description?: string;
    variables?: Record<string, unknown>;
  }>;
};
export type EnrollLeadsResponse = {
  campaign_id?: string;
  enrolled_count?: number;
  enrolled_lead_ids?: Array<string>;
  rejected?: Array<{
    index?: number;
    error?: string;
  }>;
};
export type WebhookEndpoint = {
  webhook_id?: string;
  name?: string;
  url?: string;
  auth_type?: "hmac";
  events?: Array<string>;
  custom_header_names?: Array<string>;
  status?: "active" | "disabled";
  consecutive_failures?: number;
  last_success_at?: string | null;
  last_failure_at?: string | null;
  last_failure_reason?: string;
  disabled_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};
export type WebhookCreateRequest = {
  name: string;
  webhook_url: string;
  events?: Array<string>;
  request_headers?: Record<string, string>;
  set_as_workspace_default?: boolean;
};
export type WebhookCreated = WebhookEndpoint & {
  webhook_secret?: string;
  warning?: string;
};
export type WebhookUpdateRequest = {
  name?: string;
  webhook_url?: string;
  events?: Array<string>;
  request_headers?: Record<string, string>;
  status?: "active" | "disabled";
};
export type WebhookSettingsRequest = {
  default_post_call_webhook_id?: string | null;
  default_webhook_events?: Array<string>;
};
export type WebhookSettings = {
  default_post_call_webhook_id?: string | null;
  default_webhook_events?: Array<string>;
};
export type WebhookList = {
  data?: Array<WebhookEndpoint>;
  workspace_settings?: WebhookSettings;
  supported_events?: Array<string>;
};
export type WebhookDeleted = {
  deleted?: true;
  webhook_id?: string;
  detached_agent_ids?: Array<string>;
};
export type WebhookDelivery = {
  delivery_id?: string;
  event_id?: string;
  call_id?: string | null;
  conversation_id?: string | null;
  agent_id?: string | null;
  event_type?: string;
  status?: "pending" | "delivered" | "failed" | "dead";
  attempts?: number;
  max_attempts?: number;
  next_retry_at?: string | null;
  last_status_code?: number | null;
  last_error?: string | null;
  last_duration_ms?: number | null;
  delivered_at?: string | null;
  created_at?: string;
};
export type WebhookDeliveryList = {
  data?: Array<WebhookDelivery>;
  meta?: PageMeta;
};
export type WebhookDeliveryResent = {
  resent?: boolean;
  delivery?: WebhookDelivery;
};
