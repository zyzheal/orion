/**
 * AgentService - Business logic layer for Agent operations
 */

import { AgentRepository, AgentProfile, AgentRun } from './AgentRepository';

export class AgentServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'AgentServiceError'; }
}

export class AgentService {
  private repository: AgentRepository;
  constructor(repository: AgentRepository) { this.repository = repository; }

  async createProfile(tenantId: string, name: string, type: string, capabilities: string[], config?: Record<string, any>): Promise<AgentProfile> {
    if (!tenantId || !name) throw new AgentServiceError('Tenant ID and name required', 'INVALID_INPUT');
    return this.repository.createProfile(tenantId, name, type, capabilities, config);
  }

  async listProfiles(tenantId: string): Promise<AgentProfile[]> {
    return this.repository.findAllProfiles(tenantId);
  }

  async runAgent(agentId: string, task: string, input: Record<string, any>): Promise<AgentRun> {
    const profile = await this.repository.findProfileById(agentId);
    if (!profile) throw new AgentServiceError(`Agent not found: ${agentId}`, 'NOT_FOUND');
    if (profile.status !== 'active') throw new AgentServiceError('Agent is not active', 'INACTIVE');

    const run = await this.repository.createRun(agentId, task, input);

    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      const output = { result: `Task completed: ${task}`, agent: profile.name };
      return (await this.repository.completeRun(run.id, output))!;
    } catch (e: any) {
      return (await this.repository.failRun(run.id, e.message))!;
    }
  }

  async getRunHistory(agentId: string, limit?: number): Promise<AgentRun[]> {
    return this.repository.getRunHistory(agentId, limit);
  }
}