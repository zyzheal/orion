/**
 * Agent Profile 数据模型
 *
 * 定义 Agent 的角色、工具集、能力配置和 LLM 配置
 */

import { v4 as uuidv4 } from 'uuid';

export type AgentRole =
  | 'bug_fixer'
  | 'code_fixer'
  | 'test_writer'
  | 'pr_submitter'
  | 'security_patcher'
  | 'doc_writer';

export interface AgentToolConfig {
  toolName: string;
  permission: 'read' | 'write' | 'execute';
  config?: Record<string, unknown>;
}

export interface AgentCapabilities {
  maxSteps: number;
  timeoutSec: number;
  retryCount: number;
}

export interface AgentConstraints {
  maxTokens: number;
  allowedBranches: string[];
  forbiddenOperations: string[];
}

export interface AgentLLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface AgentProfile {
  id: string;
  name: string;
  role: AgentRole;
  description: string;
  tools: AgentToolConfig[];
  capabilities: AgentCapabilities;
  constraints: AgentConstraints;
  llmConfig: AgentLLMConfig;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentProfileCreateInput {
  name: string;
  role: AgentRole;
  description?: string;
  tools?: AgentToolConfig[];
  capabilities?: Partial<AgentCapabilities>;
  constraints?: Partial<AgentConstraints>;
  llmConfig?: Partial<AgentLLMConfig>;
}

export interface AgentProfileUpdateInput {
  description?: string;
  tools?: AgentToolConfig[];
  capabilities?: Partial<AgentCapabilities>;
  constraints?: Partial<AgentConstraints>;
  llmConfig?: Partial<AgentLLMConfig>;
  enabled?: boolean;
}

const DEFAULT_CAPABILITIES: AgentCapabilities = {
  maxSteps: 20,
  timeoutSec: 3600,
  retryCount: 3,
};

const DEFAULT_CONSTRAINTS: AgentConstraints = {
  maxTokens: 8192,
  allowedBranches: ['main', 'develop'],
  forbiddenOperations: ['deploy_to_production', 'drop_database'],
};

const DEFAULT_LLM_CONFIG: AgentLLMConfig = {
  model: 'gpt-4o-mini',
  temperature: 0.2,
  maxTokens: 4096,
};

export function createAgentProfile(input: AgentProfileCreateInput): AgentProfile {
  const now = new Date();
  return {
    id: uuidv4(),
    name: input.name,
    role: input.role,
    description: input.description || '',
    tools: input.tools || [
      { toolName: 'read_file', permission: 'read' },
      { toolName: 'run_command', permission: 'execute' },
    ],
    capabilities: { ...DEFAULT_CAPABILITIES, ...input.capabilities },
    constraints: { ...DEFAULT_CONSTRAINTS, ...input.constraints },
    llmConfig: { ...DEFAULT_LLM_CONFIG, ...input.llmConfig },
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateAgentProfile(
  profile: AgentProfile,
  input: AgentProfileUpdateInput
): AgentProfile {
  return {
    ...profile,
    description: input.description ?? profile.description,
    tools: input.tools ?? profile.tools,
    capabilities: input.capabilities
      ? { ...profile.capabilities, ...input.capabilities }
      : profile.capabilities,
    constraints: input.constraints
      ? { ...profile.constraints, ...input.constraints }
      : profile.constraints,
    llmConfig: input.llmConfig
      ? { ...profile.llmConfig, ...input.llmConfig }
      : profile.llmConfig,
    enabled: input.enabled ?? profile.enabled,
    updatedAt: new Date(),
  };
}
