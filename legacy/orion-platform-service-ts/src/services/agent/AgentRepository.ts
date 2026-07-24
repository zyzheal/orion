import { DatabasePool } from '../database';
/**
 * AgentRepository - Database layer for Agent operations
 */


export interface AgentProfile {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  capabilities: string[];
  config: Record<string, any>;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface AgentRun {
  id: string;
  agent_id: string;
  task: string;
  input: Record<string, any>;
  output: Record<string, any> | null;
  status: string;
  error: string | null;
  started_at: Date;
  completed_at: Date | null;
  created_at: Date;
}

export class AgentRepository {
  constructor(private pool: DatabasePool) {}

  async findProfileById(id: string): Promise<AgentProfile | null> {
    return (await this.pool.query('SELECT * FROM agent_profiles WHERE id = $1', [id])).rows[0] || null;
  }

  async findAllProfiles(tenantId: string): Promise<AgentProfile[]> {
    return (await this.pool.query('SELECT * FROM agent_profiles WHERE tenant_id = $1', [tenantId])).rows;
  }

  async createProfile(tenantId: string, name: string, type: string, capabilities: string[], config?: Record<string, any>): Promise<AgentProfile> {
    const result = await this.pool.query(
      'INSERT INTO agent_profiles (tenant_id, name, type, capabilities, config, status) VALUES ($1, $2, $3, $4, $5, \'active\') RETURNING *',
      [tenantId, name, type, capabilities, config || {}]
    );
    return result.rows[0];
  }

  async createRun(agentId: string, task: string, input: Record<string, any>): Promise<AgentRun> {
    const result = await this.pool.query(
      'INSERT INTO agent_runs (agent_id, task, input, status) VALUES ($1, $2, $3, \'running\') RETURNING *',
      [agentId, task, input]
    );
    return result.rows[0];
  }

  async completeRun(id: string, output: Record<string, any>): Promise<AgentRun | null> {
    return (await this.pool.query(
      "UPDATE agent_runs SET status = 'completed', output = $1, completed_at = NOW() WHERE id = $2 RETURNING *",
      [output, id]
    )).rows[0] || null;
  }

  async failRun(id: string, error: string): Promise<AgentRun | null> {
    return (await this.pool.query(
      "UPDATE agent_runs SET status = 'failed', error = $1, completed_at = NOW() WHERE id = $2 RETURNING *",
      [error, id]
    )).rows[0] || null;
  }

  async getRunHistory(agentId: string, limit: number = 20): Promise<AgentRun[]> {
    return (await this.pool.query(
      'SELECT * FROM agent_runs WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2',
      [agentId, limit]
    )).rows;
  }
}