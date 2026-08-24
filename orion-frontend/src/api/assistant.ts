/**
 * Global AI Assistant (Copilot) API
 * POST /api/v1/assistant/ask — 跨模块智能问答
 */
import { api } from './client';

export interface AssistantSourceResult {
  source: string;
  title: string;
  content: string;
  space_id?: string;
  similarity?: number;
  meta?: unknown;
}

export interface AssistantResponse {
  question: string;
  intent: string;
  answer: string;
  sources?: AssistantSourceResult[];
  generated?: boolean;
  session_id?: string;
  createdAt: string;
}

export interface AssistantAskParams {
  question: string;
  intent?: string;
  space_id?: string;
  top_k?: number;
  session_id?: string;
}

/** Ask the global AI assistant a question (cross-module retrieval). */
export function assistantAsk(data: AssistantAskParams) {
  return api.post<AssistantResponse>('/api/v1/assistant/ask', data);
}

/** Health check for the assistant module. */
export function assistantHealth() {
  return api.get<{ status: string; module: string }>('/assistant/health');
}

// --- Session Management (TR-02 多轮对话) ---

export interface AssistantMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface AssistantSession {
  id: string;
  tenant_id: string;
  user_id: string;
  messages: AssistantMessage[];
  created_at: string;
  updated_at: string;
}

/** List recent sessions for the current user. */
export function listAssistantSessions(limit?: number) {
  return api.get<AssistantSession[]>('/api/v1/assistant/sessions', {
    params: limit ? { limit } : undefined,
  });
}

/** Get a session with its full message history. */
export function getAssistantSession(sessionId: string) {
  return api.get<AssistantSession>(`/api/v1/assistant/sessions/${sessionId}`);
}

/** Delete a session. */
export function deleteAssistantSession(sessionId: string) {
  return api.delete<AssistantSession>(`/api/v1/assistant/sessions/${sessionId}`);
}

// --- Data Source Ingestion (TR-04) ---

export interface SourceIngestItem {
  id?: string;
  title: string;
  content: string;
  tags?: string[];
  status?: string;
}

export interface SourceIngestRequest {
  source: 'alert' | 'ticket' | 'incident' | 'change';
  space_id?: string;
  items: SourceIngestItem[];
}

export interface SourceIngestResponse {
  source: string;
  indexed: number;
  space_id: string;
  destination: string;
}

/** Ingest operational records (alerts/tickets/incidents/changes) into the knowledge base. */
export function ingestSource(data: SourceIngestRequest) {
  return api.post<SourceIngestResponse>('/ingest/source', data);
}

// --- Action Execution (TR-09 / TR-11) ---

export interface AssistantActionRequest {
  prompt: string;
  kind?:
    | 'trigger_pipeline'
    | 'suggest_command'
    | 'generate_flow'
    | 'create_ticket'
    | 'create_change'
    | 'auto';
  title?: string;
  description?: string;
}

export interface AssistantActionResult {
  kind: string;
  status: string;
  summary: string;
  entity_id?: string;
  entity_name?: string;
  steps?: string[];
  error?: string;
  metadata?: Record<string, unknown>;
  executed_at?: string;
}

/** Execute a workflow action via the assistant (trigger pipeline / suggest command / create ticket / create change). */
export function assistantAction(data: AssistantActionRequest) {
  return api.post<AssistantActionResult>('/api/v1/assistant/action', data);
}
