/** AgentRun model stub */
export interface AgentRun { id: string; profileId: string; status: string; }
export type AgentRunStatus = 'running' | 'completed' | 'failed' | 'cancelled';
export interface AgentDecision { id: string; runId: string; action: string; reasoning: string; }
export interface AgentApproval { id: string; runId: string; status: string; }
export type AgentAction = 'execute' | 'skip' | 'approve' | 'reject';
