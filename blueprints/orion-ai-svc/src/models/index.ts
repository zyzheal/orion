/**
 * AI Service Models
 *
 * Data models for orion-ai-service
 */

export interface BaseEntity {
  id: string;
  created_at: Date;
  updated_at: Date;
}

export interface TenantAware {
  tenant_id: string;
}

/**
 * AI Model version entity
 */
export interface AIModelVersion extends BaseEntity, TenantAware {
  name: string;
  version: string;
  status: 'active' | 'deprecated' | 'training' | 'archived';
  framework: 'openai' | 'anthropic' | 'local' | 'custom';
  description: string | null;
  metadata: Record<string, unknown> | null;
  training_date: Date | null;
  training_data_size: number | null;
  hyperparameters: Record<string, unknown> | null;
  metrics: Record<string, unknown>;
  registered_by: string | null;
  activated_at: Date | null;
  deprecated_at: Date | null;
  tags: string[] | null;
}

/**
 * Code embedding entity
 */
export interface CodeEmbedding extends BaseEntity, TenantAware {
  project_id: string;
  file_path: string;
  chunk_type: 'function' | 'class' | 'module' | 'file' | 'comment';
  chunk_name: string;
  content: string;
  embedding: number[];
  metadata: {
    language: string;
    startLine: number;
    endLine: number;
    complexity?: number;
  };
}

/**
 * Knowledge embedding entity
 */
export interface KnowledgeEmbedding extends BaseEntity, TenantAware {
  doc_id: string;
  doc_type: string;
  title: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

/**
 * Vector collection entity
 */
export interface VectorCollection extends BaseEntity, TenantAware {
  name: string;
  description: string | null;
  dimension: number;
  metric: 'cosine' | 'euclidean' | 'dot';
  embedding_model: string;
  metadata: Record<string, unknown>;
}

/**
 * LLM Trace entity
 */
export interface LLMTrace extends BaseEntity, TenantAware {
  trace_id: string;
  request_id: string;
  model: string;
  provider: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  latency_ms: number;
  cost: number;
  currency: string;
  status: 'success' | 'error' | 'timeout';
  error_message: string | null;
  metadata: Record<string, unknown>;
}

/**
 * AI Decision entity
 */
export interface AIDecision extends BaseEntity, TenantAware {
  decision_id: string;
  scenario: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  confidence: number;
  reasoning: string | null;
  model_version: string;
  latency_ms: number;
  metadata: Record<string, unknown>;
}

/**
 * Audit log entity
 */
export interface AuditLog extends BaseEntity, TenantAware {
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  request_body: Record<string, unknown> | null;
  response_status: number;
  ip_address: string | null;
  user_agent: string | null;
}

/**
 * A/B Test entity
 */
export interface ABTest extends BaseEntity, TenantAware {
  model_name: string;
  variants: Array<{
    name: string;
    model_version: string;
    weight: number;
  }>;
  traffic_split: Record<string, number>;
  start_date: Date;
  end_date: Date | null;
  target_metrics: string[];
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
}

/**
 * Circuit breaker state entity
 */
export interface CircuitBreakerState extends BaseEntity {
  provider: string;
  model: string;
  state: 'closed' | 'open' | 'half-open';
  failure_count: number;
  success_count: number;
  last_failure_time: Date | null;
  last_success_time: Date | null;
  next_attempt_time: Date | null;
}