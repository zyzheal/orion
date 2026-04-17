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
  tools: Array<{ toolName: string; permission: string; config?: Record<string, any> }>;
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
  triggerPayload: Record<string, any>;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'waiting_approval';
  currentAgent?: string;
  currentStep: number;
  totalSteps: number;
  result?: Record<string, any>;
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
  actionInput: Record<string, any>;
  actionOutput?: Record<string, any>;
  reasoning?: string;
  toolResult?: Record<string, any>;
  error?: string;
  createdAt: string;
}

export interface AgentApproval {
  id: string;
  runId: string;
  agentId: string;
  action: string;
  actionInput: Record<string, any>;
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
  return api.get<AgentProfile[]>('/v1/agents');
}

export function createAgentProfile(data: Omit<AgentProfile, 'id' | 'createdAt' | 'updatedAt'>) {
  return api.post<AgentProfile>('/v1/agents', data);
}

export function updateAgentProfile(id: string, data: Partial<AgentProfile>) {
  return api.put<AgentProfile>(`/v1/agents/${id}`, data);
}

export function deleteAgentProfile(id: string) {
  return api.delete<void>(`/v1/agents/${id}`);
}

export function toggleAgentProfile(id: string) {
  return api.patch<AgentProfile>(`/v1/agents/${id}/toggle`);
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
  return api.get<AgentRun[]>('/v1/agent-runs', { params });
}

export function getAgentRun(id: string) {
  return api.get<AgentRun>(`/v1/agent-runs/${id}`);
}

export function getAgentRunDecisions(runId: string) {
  return api.get<AgentDecision[]>(`/v1/agent-runs/${runId}/decisions`);
}

export interface TriggerAgentRunInput {
  workflowId?: string;
  triggerEvent: string;
  triggerPayload: Record<string, any>;
}

export function triggerAgentRun(data: TriggerAgentRunInput) {
  return api.post<AgentRun>('/v1/agent-runs', data);
}

export function cancelAgentRun(id: string) {
  return api.post<AgentRun>(`/v1/agent-runs/${id}/cancel`);
}

export function retryAgentRun(id: string) {
  return api.post<AgentRun>(`/v1/agent-runs/${id}/retry`);
}

// ============================================================================
// Agent Approval APIs
// ============================================================================

export interface AgentApprovalParams {
  status?: string;
  page?: number;
  pageSize?: number;
}

export function getAgentApprovals(params?: AgentApprovalParams) {
  return api.get<AgentApproval[]>('/v1/agent-approvals', { params });
}

export interface ApprovalResponseInput {
  approved: boolean;
  reason?: string;
  rejectionReason?: string;
}

export function respondToApproval(id: string, data: ApprovalResponseInput) {
  return api.post<AgentApproval>(`/v1/agent-approvals/${id}/respond`, data);
}
