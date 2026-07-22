/**
 * Event Bus Types - CloudEvents envelope and JetStream configuration types
 */

/**
 * CloudEvents-style typed envelope
 */
export interface TypedEnvelope<T = unknown> {
  id: string;
  source: string;
  specversion: string;
  type: string;
  datacontenttype: string;
  data: T;
  time: string;
  tenantid?: number | string;
  subject?: string;
  dataschema?: string;
}

/**
 * JetStream stream configuration
 */
export interface JetStreamConfig {
  name: string;
  subjects: string[];
  retention?: string;
  maxConsumers?: number;
  maxMsgs?: number;
  maxBytes?: number;
  maxAge?: number;
  maxMsgSize?: number;
  storage?: string;
  numReplicas?: number;
  duplicateWindow?: number;
}

/**
 * JetStream consumer configuration
 */
export interface ConsumerConfig {
  durable_name?: string;
  description?: string;
  deliver_policy?: string;
  opt_start_seq?: number;
  opt_start_time?: string;
  ack_policy?: string;
  ack_wait?: number;
  max_deliver?: number;
  filter_subject?: string;
  replay_policy?: string;
  rate_limit_bps?: number;
  sample_freq?: string;
  max_waiting?: number;
  max_ack_pending?: number;
  flow_control?: boolean;
  idle_heartbeat?: number;
  headers_only?: boolean;
  max_batch?: number;
  max_expires?: number;
  inactive_threshold?: number;
  backoff?: number[];
  metadata?: Record<string, string>;
  mem_storage?: boolean;
}

/**
 * Orion stream definitions
 */
export const ORION_STREAMS: Record<string, { name: string; subjects: string[] }> = {
  pipeline: { name: 'PIPELINE_EVENTS', subjects: ['orion.pipeline.*'] },
  deployment: { name: 'DEPLOYMENT_EVENTS', subjects: ['orion.deployment.*'] },
  alert: { name: 'ALERT_EVENTS', subjects: ['orion.alert.*'] },
  config: { name: 'CONFIG_EVENTS', subjects: ['orion.config.*'] },
  incident: { name: 'INCIDENT_EVENTS', subjects: ['orion.incident.*'] },
  chatops: { name: 'CHATOPS_EVENTS', subjects: ['orion.chatops.*'] },
  code: { name: 'CODE_EVENTS', subjects: ['orion.code.*'] },
  audit: { name: 'AUDIT_EVENTS', subjects: ['orion.audit.*'] },
};
