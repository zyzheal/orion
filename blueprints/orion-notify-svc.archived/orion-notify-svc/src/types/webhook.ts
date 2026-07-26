export interface Webhook {
  id: string;
  tenant_id: string;
  name: string;
  url: string;
  events: string[];
  secret: string | null;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event: string;
  payload: Record<string, any>;
  status: string;
  response_code: number | null;
  response_body: string | null;
  attempt: number;
  next_retry_at: Date | null;
  attempted_at: Date;
}

export interface CreateWebhookInput {
  tenant_id: string;
  name: string;
  url: string;
  events: string[];
  secret?: string;
}

export interface UpdateWebhookInput {
  name?: string;
  url?: string;
  events?: string[];
  enabled?: boolean;
}

export interface TriggerWebhookInput {
  event: string;
  payload?: Record<string, any>;
}

export interface TriggerEventInput {
  tenant_id: string;
  event: string;
  payload: Record<string, any>;
}
