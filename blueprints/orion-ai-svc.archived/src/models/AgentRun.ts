/**
 * AgentRun model
 *
 * Defines the shape of an agent run (execution instance) and provides factory helpers.
 */

export type AgentAction = 'read_file' | 'run_command' | 'write_code' | 'create_pr' | 'request_approval';

export type AgentRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface AgentDecision {
  id: string;
  runId: string;
  agentId: string;
  stepNumber: number;
  action: AgentAction;
  actionInput: Record<string, unknown>;
  actionOutput?: Record<string, unknown>;
  reasoning: string;
  toolResult?: Record<string, unknown>;
  error?: string;
  createdAt: Date;
}

export interface AgentRun {
  id: string;
  agentProfileId: string;
  agentProfileName: string;
  triggerPayload: Record<string, unknown>;
  status: AgentRunStatus;
  currentStep: number;
  totalSteps: number;
  result?: Record<string, unknown>;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  timeoutAt: Date;
  timeoutSec?: number;
  decisions: AgentDecision[];
  tenantId?: string;
}

export interface AgentRunCreateInput {
  agentProfileId: string;
  triggerPayload: Record<string, unknown>;
  totalSteps?: number;
  tenantId?: string;
}

/**
 * Create a new AgentRun with defaults
 */
export function createAgentRun(input: AgentRunCreateInput & { agentProfileName?: string; timeoutSec?: number }): AgentRun {
  const now = new Date();
  const timeoutSec = input.timeoutSec ?? 3600;
  return {
    id: `ar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    agentProfileId: input.agentProfileId,
    agentProfileName: input.agentProfileName || '',
    triggerPayload: input.triggerPayload,
    status: 'running',
    currentStep: 0,
    totalSteps: input.totalSteps ?? 1,
    timeoutSec,
    startedAt: now,
    timeoutAt: new Date(now.getTime() + timeoutSec * 1000),
    decisions: [],
    tenantId: input.tenantId,
  };
}
