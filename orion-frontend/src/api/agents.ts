/**
 * AI Agent Orchestration API Service
 * Agent profiles, runs, decisions, and approvals
 */
import { api } from './client';

// ============================================================================
// Types
// ============================================================================

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  description?: string;
  tools: Array<{ toolName: string; permission: string; config?: Record<string, unknown> }>;
  capabilities?: { maxSteps?: number; timeoutSec?: number; retryCount?: number };
  constraints?: { maxTokens?: number; allowedBranches?: string[]; forbiddenOperations?: string[] };
  llmConfig?: { model?: string; temperature?: number; maxTokens?: number };
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRun {
  id: string;
  workflowId?: string;
  triggerEvent: string;
  triggerPayload: Record<string, unknown>;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'waiting_approval';
  currentAgent?: string;
  currentStep: number;
  totalSteps: number;
  result?: Record<string, unknown>;
  startedAt: string;
  completedAt?: string;
  timeoutAt: string;
}

export interface AgentDecision {
  id: string;
  runId: string;
  agentId: string;
  stepNumber: number;
  action: string;
  actionInput: Record<string, unknown>;
  actionOutput?: Record<string, unknown>;
  reasoning?: string;
  toolResult?: Record<string, unknown>;
  error?: string;
  createdAt: string;
}

export interface AgentApproval {
  id: string;
  runId: string;
  agentId: string;
  action: string;
  actionInput: Record<string, unknown>;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

// ============================================================================
// Agent Profile APIs
// ============================================================================

export function getAgentProfiles() {
  return api.get<AgentProfile[]>('/api/agents');
}

export function createAgentProfile(data: Omit<AgentProfile, 'id' | 'createdAt' | 'updatedAt'>) {
  return api.post<AgentProfile>('/api/agents', data);
}

export function updateAgentProfile(id: string, data: Partial<AgentProfile>) {
  return api.put<AgentProfile>(`/api/agents/${id}`, data);
}

export function deleteAgentProfile(id: string) {
  return api.delete<void>(`/api/agents/${id}`);
}

export function toggleAgentProfile(id: string) {
  return api.patch<AgentProfile>(`/api/agents/${id}/toggle`);
}

// ============================================================================
// Agent Run APIs
// ============================================================================

export interface AgentRunParams {
  workflowId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export function getAgentRuns(params?: AgentRunParams) {
  return api.get<AgentRun[]>('/api/agent-runs', { params });
}

export function getAgentRun(id: string) {
  return api.get<AgentRun>(`/api/agent-runs/${id}`);
}

export function getAgentRunDecisions(runId: string) {
  return api.get<AgentDecision[]>(`/api/agent-runs/${runId}/decisions`);
}

export interface TriggerAgentRunInput {
  workflowId?: string;
  triggerEvent: string;
  triggerPayload: Record<string, unknown>;
}

export function triggerAgentRun(data: TriggerAgentRunInput) {
  return api.post<AgentRun>('/api/agent-runs', data);
}

export function cancelAgentRun(id: string) {
  return api.post<AgentRun>(`/api/agent-runs/${id}/cancel`);
}

export function retryAgentRun(id: string) {
  return api.post<AgentRun>(`/api/agent-runs/${id}/retry`);
}

// ============================================================================
// Agent Approvals APIs
// Note: Backend agent-routes.ts doesn't have /agent-approvals endpoints.
// Approvals are managed through individual agent run decisions.
// ============================================================================

export interface AgentApprovalParams {
  status?: string;
  page?: number;
  pageSize?: number;
}

export function getAgentApprovals(_params?: AgentApprovalParams) {
  console.warn('getAgentApprovals: backend /agent-approvals endpoint not available');
  return Promise.resolve([] as AgentApproval[]);
}

export interface ApprovalResponseInput {
  approved: boolean;
  reason?: string;
  rejectionReason?: string;
}

export function respondToApproval(_id: string, _data: ApprovalResponseInput) {
  console.warn('respondToApproval: backend /agent-approvals/:id/respond endpoint not available');
  return Promise.resolve({} as AgentApproval);
}
