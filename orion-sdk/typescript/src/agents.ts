import { ApiBase, ApiResponse } from './client';

/**
 * Agent run request options
 */
export interface AgentRunRequest {
  agentId: string;
  prompt: string;
  context?: Record<string, unknown>;
  wait?: boolean;
}

/**
 * Agent run response
 */
export interface AgentRunResponse {
  runId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  result?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Agent status response
 */
export interface AgentStatusResponse {
  runId: string;
  agentId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  result?: string;
  error?: string;
  progress?: number;
  logs?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Agent info
 */
export interface AgentInfo {
  id: string;
  name: string;
  description?: string;
  version?: string;
  capabilities?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Agent API Module
 * Provides methods for interacting with AI Agents
 */
export class AgentAPI extends ApiBase {
  /**
   * Run an AI agent with a prompt
   * @param agentId - The ID of the agent to run
   * @param prompt - The prompt to send to the agent
   * @param context - Optional context data
   * @param wait - Whether to wait for completion (default: false)
   */
  async run(
    agentId: string,
    prompt: string,
    context?: Record<string, unknown>,
    wait: boolean = false
  ): Promise<AgentRunResponse> {
    return this.post<AgentRunResponse>('/v1/agents/run', {
      agentId,
      prompt,
      context,
      wait,
    });
  }

  /**
   * Get the status of an agent run
   * @param runId - The ID of the run
   */
  async getStatus(runId: string): Promise<AgentStatusResponse> {
    return this.get<AgentStatusResponse>(`/v1/agents/runs/${runId}/status`);
  }

  /**
   * List all available agents
   */
  async listAgents(): Promise<AgentInfo[]> {
    return this.get<AgentInfo[]>('/v1/agents');
  }

  /**
   * Get a specific agent by ID
   * @param agentId - The ID of the agent
   */
  async getAgent(agentId: string): Promise<AgentInfo> {
    return this.get<AgentInfo>(`/v1/agents/${agentId}`);
  }

  /**
   * Cancel a running agent
   * @param runId - The ID of the run to cancel
   */
  async cancelRun(runId: string): Promise<void> {
    await this.post(`/v1/agents/runs/${runId}/cancel`);
  }

  /**
   * Get logs for an agent run
   * @param runId - The ID of the run
   */
  async getLogs(runId: string): Promise<string[]> {
    const response = await this.get<{ logs: string[] }>(
      `/v1/agents/runs/${runId}/logs`
    );
    return response.logs || [];
  }

  /**
   * Get result of a completed agent run
   * @param runId - The ID of the run
   */
  async getResult(runId: string): Promise<AgentRunResponse> {
    return this.get<AgentRunResponse>(`/v1/agents/runs/${runId}`);
  }
}