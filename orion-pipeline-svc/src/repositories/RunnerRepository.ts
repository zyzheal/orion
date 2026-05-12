// Stub - TODO: implement with PostgreSQL
import { Pool } from 'pg';
import type { Runner, RunnerCreateInput, RunnerUpdateInput } from '../models/Runner';

export interface RunnerEntity {
  id: string;
  name: string;
  status: string;
  current_jobs: number;
  max_concurrent: number;
  labels: string[];
  tenant_id: string;
  url?: string;
  last_heartbeat?: Date;
  created_at: Date;
  updated_at: Date;
}

export class RunnerRepository {
  constructor(_pool: Pool | null) {}
  async create(_input: RunnerCreateInput): Promise<Runner> {
    throw new Error('Not implemented');
  }
  async findById(_id: string): Promise<Runner | undefined> {
    return undefined;
  }
  async findByStatus(_status: string): Promise<Runner[]> {
    return [];
  }
  async findByLabels(_tenantId: string, _labels: string[]): Promise<Runner[]> {
    return [];
  }
  async update(_id: string, _updates: RunnerUpdateInput): Promise<Runner | null> {
    return null;
  }
  async delete(_id: string): Promise<boolean> {
    return false;
  }
  async findByTenant(_tenantId: string): Promise<Runner[]> {
    return [];
  }
  async updateHeartbeat(_id: string, _heartbeat: Date): Promise<void> {
    throw new Error('Not implemented');
  }
  async decrementJobs(_id: string): Promise<void> {
    throw new Error('Not implemented');
  }
}
export type RunnerRepositoryType = typeof RunnerRepository;

export const PostgresRunnerRepository = {} as any;
export type PostgresRunnerRepositoryType = typeof PostgresRunnerRepository;
