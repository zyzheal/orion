/**
 * AgentProfile model
 *
 * Defines the shape of an agent profile and provides factory/validation helpers.
 */

export type AgentRole = 'coder' | 'reviewer' | 'planner' | 'executor';

export interface AgentProfile {
  id: string;
  name: string;
  role: AgentRole;
  description: string;
  tools: Array<{ toolName: string; permission: string }>;
  capabilities: {
    maxSteps?: number;
    timeoutSec?: number;
    retryCount?: number;
  };
  constraints: {
    maxTokens?: number;
    allowedBranches?: string[];
    forbiddenOperations?: string[];
  };
  llmConfig: {
    model: string;
    temperature: number;
    maxTokens: number;
  };
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentProfileCreateInput {
  name: string;
  role: AgentRole;
  description?: string;
  capabilities?: Record<string, unknown>;
  tools?: Array<{ toolName: string; permission: string }>;
  constraints?: {
    maxTokens?: number;
    allowedBranches?: string[];
    forbiddenOperations?: string[];
  };
  llmConfig?: {
    model: string;
    temperature: number;
    maxTokens: number;
  };
}

export interface AgentProfileUpdateInput {
  name?: string;
  role?: AgentRole;
  description?: string;
  capabilities?: Record<string, unknown>;
  tools?: Array<{ toolName: string; permission: string }>;
  constraints?: {
    maxTokens?: number;
    allowedBranches?: string[];
    forbiddenOperations?: string[];
  };
  llmConfig?: {
    model: string;
    temperature: number;
    maxTokens: number;
  };
  enabled?: boolean;
}

/**
 * Create a new AgentProfile with defaults
 */
export function createAgentProfile(input: AgentProfileCreateInput): AgentProfile {
  const now = new Date();
  return {
    id: `ap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name,
    role: input.role,
    description: input.description || '',
    tools: input.tools || [
      { toolName: 'read_file', permission: 'read' },
      { toolName: 'run_command', permission: 'execute' },
    ],
    capabilities: {
      maxSteps: (input.capabilities?.maxSteps as number) ?? 20,
      timeoutSec: (input.capabilities?.timeoutSec as number) ?? 3600,
      retryCount: (input.capabilities?.retryCount as number) ?? 3,
    },
    constraints: input.constraints || {
      maxTokens: 8192,
      allowedBranches: ['main', 'develop'],
      forbiddenOperations: ['deploy_to_production', 'drop_database'],
    },
    llmConfig: input.llmConfig || {
      model: 'gpt-4o-mini',
      temperature: 0.2,
      maxTokens: 4096,
    },
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Apply partial updates to an existing profile
 */
export function updateAgentProfile(
  existing: AgentProfile,
  input: AgentProfileUpdateInput,
): AgentProfile {
  const updated: AgentProfile = { ...existing, updatedAt: new Date() };
  if (input.name !== undefined) updated.name = input.name;
  if (input.role !== undefined) updated.role = input.role;
  if (input.description !== undefined) updated.description = input.description;
  if (input.tools !== undefined) updated.tools = input.tools;
  if (input.capabilities !== undefined) updated.capabilities = { ...updated.capabilities, ...input.capabilities };
  if (input.constraints !== undefined) updated.constraints = { ...updated.constraints, ...input.constraints };
  if (input.llmConfig !== undefined) updated.llmConfig = { ...updated.llmConfig, ...input.llmConfig };
  if (input.enabled !== undefined) updated.enabled = input.enabled;
  return updated;
}
