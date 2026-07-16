/**
 * Agent Run 数据模型
 *
 * 定义 Agent 运行记录、决策日志和状态管理
 */

import { v4 as uuidv4 } from 'uuid';

export type AgentRunStatus =
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'waiting_approval';

export type AgentAction =
  | 'read_file'
  | 'write_code'
  | 'run_command'
  | 'create_pr'
  | 'request_approval';

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

export interface AgentApproval {
  id: string;
  runId: string;
  agentId: string;
  action: AgentAction;
  actionInput: Record<string, unknown>;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
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
  decisions: AgentDecision[];
  tenantId?: string;
}

export interface AgentRunCreateInput {
  agentProfileId: string;
  agentProfileName?: string;
  triggerPayload: Record<string, unknown>;
  totalSteps?: number;
  timeoutSec?: number;
  tenantId?: string;
}

export function createAgentRun(input: AgentRunCreateInput): AgentRun {
  const now = new Date();
  const timeoutSec = input.timeoutSec || 3600;
  const timeoutAt = new Date(now.getTime() + timeoutSec * 1000);

  return {
    id: uuidv4(),
    agentProfileId: input.agentProfileId,
    agentProfileName: input.agentProfileName || '',
    triggerPayload: input.triggerPayload,
    status: 'running',
    currentStep: 0,
    totalSteps: input.totalSteps || 1,
    startedAt: now,
    timeoutAt,
    decisions: [],
    tenantId: input.tenantId,
  };
}

export function addDecision(
  run: AgentRun,
  agentId: string,
  stepNumber: number,
  action: AgentAction,
  actionInput: Record<string, unknown>,
  reasoning: string
): AgentDecision {
  const decision: AgentDecision = {
    id: uuidv4(),
    runId: run.id,
    agentId,
    stepNumber,
    action,
    actionInput,
    reasoning,
    createdAt: new Date(),
  };
  run.decisions.push(decision);
  run.currentStep = stepNumber;
  return decision;
}

export function completeDecision(
  decision: AgentDecision,
  toolResult: Record<string, unknown>,
  actionOutput?: Record<string, unknown>
): void {
  decision.toolResult = toolResult;
  decision.actionOutput = actionOutput;
}

export function failDecision(
  decision: AgentDecision,
  error: string
): void {
  decision.error = error;
}

export function completeRun(
  run: AgentRun,
  result: Record<string, unknown>
): void {
  run.status = 'completed';
  run.result = result;
  run.completedAt = new Date();
}

export function failRun(
  run: AgentRun,
  error: string
): void {
  run.status = 'failed';
  run.error = error;
  run.completedAt = new Date();
}

export function cancelRun(run: AgentRun): void {
  run.status = 'cancelled';
  run.completedAt = new Date();
}

export function createAgentApproval(
  runId: string,
  agentId: string,
  action: AgentAction,
  actionInput: Record<string, unknown>,
  reason: string
): AgentApproval {
  const now = new Date();
  return {
    id: uuidv4(),
    runId,
    agentId,
    action,
    actionInput,
    reason,
    status: 'pending',
    createdAt: now,
  };
}
