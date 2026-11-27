"""AUTO-GENERATED from openapi/openapi.v1.json. DO NOT EDIT."""
from __future__ import annotations

from typing import Any, Literal, Optional, TypedDict, Union

OPENAPI_VERSION: str = "1.3.0"

class ErrorEnvelope(TypedDict, total=False):
    error: Literal[true]
    code: str
    message: str
    request_id: Optional[str]

class PageMeta(TypedDict, total=False):
    total: int
    limit: int
    offset: int

class Pagination(TypedDict, total=False):
    total: int
    limit: int
    offset: int
    has_more: bool

Metadata = dict[str, Any]

class Me(TypedDict, total=False):
    org_id: str
    user_id: str
    name: str
    company_name: str
    plan: dict[str, Any]
    abuse_tier: str
    webhooks: dict[str, Any]
    api_key: Optional[dict[str, Any]]
    limits: dict[str, Any]

class Wallet(TypedDict, total=False):
    org_id: str
    currency: str
    credit_unit_value_inr: float
    call_credits: float
    reserved_credits: float
    available_credits: float
    plan_type: str
    plan_expired_at: Optional[str]
    voice_blocked: bool
    abuse_tier: str
    rate_card: dict[str, Any]

class ApiKey(TypedDict, total=False):
    key_id: str
    name: str
    key_prefix: str
    scopes: list[str]
    status: Literal["active", "revoked", "expired"]
    default_bot_id: Optional[str]
    allowed_ips: list[str]
    expires_at: Optional[str]
    revoked_at: Optional[str]
    last_used_at: Optional[str]
    rate_limit_per_min: Optional[int]
    created_at: str

class ApiKeyAuditEvent(TypedDict, total=False):
    event_id: str
    action: Literal["api_key.created", "api_key.rotated", "api_key.revoked", "api_key.deleted"]
    target_type: str
    target_id: str
    actor_user_id: str
    actor_email: str
    metadata: dict[str, Any]
    created_at: Optional[str]

class ApiKeyAuditList(TypedDict, total=False):
    data: list["ApiKeyAuditEvent"]
    meta: dict[str, Any]

class ApiKeyCreateRequest(TypedDict, total=False):
    name: str
    mode: Literal["live", "test"]
    rate_limit_per_min: int
    scopes: list[str]
    expires_at: Optional[str]
    allowed_ips: list[str]
    default_bot_id: str

class ApiKeyCreated(TypedDict, total=False):
    key_id: str
    name: str
    key_prefix: str
    scopes: list[str]
    status: Literal["active", "revoked", "expired"]
    default_bot_id: Optional[str]
    allowed_ips: list[str]
    expires_at: Optional[str]
    revoked_at: Optional[str]
    last_used_at: Optional[str]
    rate_limit_per_min: Optional[int]
    created_at: str
    api_key: str
    warning: str

class ApiKeyList(TypedDict, total=False):
    data: list["ApiKey"]
    meta: dict[str, Any]

class ApiKeyRotateRequest(TypedDict, total=False):
    grace_period_seconds: int

class ApiKeyRotated(TypedDict, total=False):
    rotated: Literal[true]
    previous_key: "ApiKey"

class ApiKeyRevoked(TypedDict, total=False):
    revoked: Literal[true]
    key: "ApiKey"

class Agent(TypedDict, total=False):
    agent_id: str
    bot_id: str
    agent_name: str
    company_name: str
    company_description: str
    direction: Literal["inbound", "outbound"]
    is_active_inbound: bool
    agent_type: str
    agent_goal: str
    voice_backend: Literal["pipecat"]
    phone_number_type: Literal["indian", "international"]
    voice_carrier: Optional[str]
    assigned_phone_number: Optional[str]
    first_message: str
    agent_language: str
    additional_languages: list[str]
    voice_gender: Literal["male", "female"]
    maxdurationseconds: int
    inbound_company_details: str
    platform_settings: dict[str, Any]
    created_at: Optional[str]

class AgentCreateRequest(TypedDict, total=False):
    company_name: str
    agent_name: str
    company_description: str
    inbound_company_details: str
    first_message: str
    direction: Literal["inbound", "outbound"]
    agent_language: str
    additional_languages: list[str]
    voice_gender: Literal["male", "female"]
    maxdurationseconds: int
    phone_number_type: Literal["indian", "international"]
    voice_carrier: str
    assigned_phone_number: str
    agent_type: str
    agent_goal: str
    voice_backend: Literal["pipecat"]
    bot_id: str
    platform_settings: dict[str, Any]

class AgentUpdateRequest(TypedDict, total=False):
    company_name: str
    agent_name: str
    company_description: str
    inbound_company_details: str
    first_message: str
    agent_language: str
    additional_languages: list[str]
    voice_gender: Literal["male", "female"]
    maxdurationseconds: int
    platform_settings: dict[str, Any]

class AgentCreated(TypedDict, total=False):
    agent_id: str
    bot_id: str
    agent_name: str
    company_name: str
    company_description: str
    direction: Literal["inbound", "outbound"]
    is_active_inbound: bool
    agent_type: str
    agent_goal: str
    voice_backend: Literal["pipecat"]
    phone_number_type: Literal["indian", "international"]
    voice_carrier: Optional[str]
    assigned_phone_number: Optional[str]
    first_message: str
    agent_language: str
    additional_languages: list[str]
    voice_gender: Literal["male", "female"]
    maxdurationseconds: int
    inbound_company_details: str
    platform_settings: dict[str, Any]
    created_at: Optional[str]
    bot_created: bool

class AgentList(TypedDict, total=False):
    data: list["Agent"]
    meta: "PageMeta"

class AgentArchived(TypedDict, total=False):
    archived: Literal[true]
    agent_id: str
    deleted_at: str

class AgentInboundChange(TypedDict, total=False):
    activated: bool
    deactivated: bool
    agent: "Agent"
    demoted_agent_ids: list[str]

class Recording(TypedDict, total=False):
    status: Literal["pending", "ready", "unavailable"]
    available: bool
    url: Optional[str]
    url_expires_in_secs: Optional[int]
    transfer: Optional[dict[str, Any]]

class CallBilling(TypedDict, total=False):
    credits_deducted: bool
    credits_amount: float
    credit_tier: str
    billing_mode: Optional[str]
    transfer_credits_amount: float

class Call(TypedDict, total=False):
    call_id: str
    agent_id: str
    bot_id: str
    lead_id: Optional[str]
    direction: Literal["inbound", "outbound"]
    status: str
    duration_secs: Optional[int]
    carrier: Optional[str]
    phone_number_type: Literal["indian", "international"]
    conversation_id: Optional[str]
    billing: "CallBilling"
    recording: "Recording"
    created_at: Optional[str]

class CallCreateRequest(TypedDict, total=False):
    agent_id: str
    to: str
    from_phone_number: str
    customer_name: str
    lead_id: str
    lead_description: str
    dynamic_variables: dict[str, Any]
    metadata: "Metadata"
    strict_dnd: bool
    first_message: str

CallCreated = TypedDict(
    "CallCreated",
    {
        "call_id": str,
        "agent_id": str,
        "bot_id": str,
        "lead_id": Optional[str],
        "direction": Literal["inbound", "outbound"],
        "status": str,
        "duration_secs": Optional[int],
        "carrier": Optional[str],
        "phone_number_type": Literal["indian", "international"],
        "conversation_id": Optional[str],
        "billing": "CallBilling",
        "recording": "Recording",
        "created_at": Optional[str],
        "from": Optional[str],
        "to": str,
        "call_sid": Optional[str],
        "reserved_credits": float,
    },
    total=False,
)

class CallList(TypedDict, total=False):
    data: list["Call"]
    meta: "PageMeta"

class CallRecordingResponse(TypedDict, total=False):
    call_id: str
    recording: "Recording"

class CallTranscript(TypedDict, total=False):
    call_id: str
    conversation_id: Optional[str]
    summary: str
    call_summary_title: str
    call_successful: str
    turns: list[dict[str, Any]]
    created_at: Optional[str]

class CallHangupResponse(TypedDict, total=False):
    call_id: str
    status: Literal["canceled", "completed"]
    hangup_requested: bool
    already_ended: bool
    carrier_warning: str

class PhoneNumber(TypedDict, total=False):
    phone_number: str
    carrier: Literal["exotel", "plivo", "twilio"]
    direction: Literal["inbound", "outbound"]
    phone_number_type: Literal["indian", "international"]
    agent_id: Optional[str]
    agent_name: Optional[str]

class PhoneNumberList(TypedDict, total=False):
    data: list["PhoneNumber"]
    limits: dict[str, Any]

class PhoneNumberRequest(TypedDict, total=False):
    direction: Literal["outbound", "inbound"]
    phone_number_type: Literal["indian", "international"]
    carrier: Literal["exotel", "plivo", "twilio"]

class PhoneNumberReleaseRequest(TypedDict, total=False):
    direction: Literal["outbound", "inbound"]
    phone_number_type: Literal["indian", "international"]

class Lead(TypedDict, total=False):
    lead_id: str
    lead_name: str
    lead_phone: str
    lead_description: str
    campaign_id: str
    bot_id: str
    agent_id: Optional[str]
    lead_status: Literal["hot", "warm", "cold", "unknown"]
    classification_label: Optional[str]
    is_called: bool
    latest_call_status: str
    callback_requested: bool
    callback_requested_at: Optional[str]
    variables: dict[str, Any]
    captured_fields: dict[str, Any]
    created_at: Optional[str]
    updated_at: Optional[str]

class LeadCreateRequest(TypedDict, total=False):
    lead_name: str
    lead_phone: str
    lead_description: str
    lead_status: Literal["hot", "warm", "cold", "unknown"]
    campaign_id: str
    agent_id: str
    bot_id: str
    variables: dict[str, Any]

class LeadUpdateRequest(TypedDict, total=False):
    lead_name: str
    lead_phone: str
    lead_description: str
    agent_id: str
    lead_status: Literal["hot", "warm", "cold", "unknown"]
    callback_requested: bool
    variables: dict[str, Any]

class LeadList(TypedDict, total=False):
    leads: list["Lead"]
    pagination: "Pagination"

class LeadDeleted(TypedDict, total=False):
    lead_id: str
    deleted: Literal[true]
    deleted_at: str

class Campaign(TypedDict, total=False):
    campaign_id: str
    campaign_name: str
    bot_id: str
    agent_id: Optional[str]
    campaign_type: Literal["with_template", "without_template", "workflow"]
    execution_status: Literal["pending", "in_progress", "completed", "failed", "cancelled"]
    is_scheduled: bool
    scheduled_time: Optional[str]
    executed_at: Optional[str]
    failure_reason: Optional[str]
    lead_count: int
    ask_variables: list[dict[str, Any]]
    created_at: Optional[str]

class CampaignCreateRequest(TypedDict, total=False):
    campaign_name: str
    agent_id: str
    bot_id: str
    campaign_type: Literal["with_template", "without_template", "workflow"]
    scheduled_time: str
    ask_variables: list[dict[str, Any]]

class CampaignUpdateRequest(TypedDict, total=False):
    campaign_name: str
    agent_id: str
    scheduled_time: Optional[str]
    ask_variables: list[dict[str, Any]]

class CampaignList(TypedDict, total=False):
    campaigns: list["Campaign"]
    pagination: "Pagination"

class CampaignArchived(TypedDict, total=False):
    campaign_id: str
    archived: Literal[true]
    deleted_at: str

class EnrollLeadsRequest(TypedDict, total=False):
    leads: list[dict[str, Any]]

class EnrollLeadsResponse(TypedDict, total=False):
    campaign_id: str
    enrolled_count: int
    enrolled_lead_ids: list[str]
    rejected: list[dict[str, Any]]

class WebhookEndpoint(TypedDict, total=False):
    webhook_id: str
    name: str
    url: str
    auth_type: Literal["hmac"]
    events: list[str]
    custom_header_names: list[str]
    status: Literal["active", "disabled"]
    consecutive_failures: int
    last_success_at: Optional[str]
    last_failure_at: Optional[str]
    last_failure_reason: str
    disabled_at: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]

class WebhookCreateRequest(TypedDict, total=False):
    name: str
    webhook_url: str
    events: list[str]
    request_headers: dict[str, str]
    set_as_workspace_default: bool

class WebhookCreated(TypedDict, total=False):
    webhook_id: str
    name: str
    url: str
    auth_type: Literal["hmac"]
    events: list[str]
    custom_header_names: list[str]
    status: Literal["active", "disabled"]
    consecutive_failures: int
    last_success_at: Optional[str]
    last_failure_at: Optional[str]
    last_failure_reason: str
    disabled_at: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]
    webhook_secret: str
    warning: str

class WebhookUpdateRequest(TypedDict, total=False):
    name: str
    webhook_url: str
    events: list[str]
    request_headers: dict[str, str]
    status: Literal["active", "disabled"]

class WebhookSettingsRequest(TypedDict, total=False):
    default_post_call_webhook_id: Optional[str]
    default_webhook_events: list[str]

class WebhookSettings(TypedDict, total=False):
    default_post_call_webhook_id: Optional[str]
    default_webhook_events: list[str]

class WebhookList(TypedDict, total=False):
    data: list["WebhookEndpoint"]
    workspace_settings: "WebhookSettings"
    supported_events: list[str]

class WebhookDeleted(TypedDict, total=False):
    deleted: Literal[true]
    webhook_id: str
    detached_agent_ids: list[str]

class WebhookDelivery(TypedDict, total=False):
    delivery_id: str
    event_id: str
    call_id: Optional[str]
    conversation_id: Optional[str]
    agent_id: Optional[str]
    event_type: str
    status: Literal["pending", "delivered", "failed", "dead"]
    attempts: int
    max_attempts: int
    next_retry_at: Optional[str]
    last_status_code: Optional[int]
    last_error: Optional[str]
    last_duration_ms: Optional[int]
    delivered_at: Optional[str]
    created_at: str

class WebhookDeliveryList(TypedDict, total=False):
    data: list["WebhookDelivery"]
    meta: "PageMeta"

class WebhookDeliveryResent(TypedDict, total=False):
    resent: bool
    delivery: "WebhookDelivery"
