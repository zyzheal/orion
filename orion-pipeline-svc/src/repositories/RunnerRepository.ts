// Runner Repository - In-memory implementation
import { Pool } from 'pg';
import type { Runner, RunnerCreateInput, RunnerUpdateInput } from '../models/Runner';

// In-memory store using Runner interface (camelCase)
const runners = new Map<string, Runner>();

export class RunnerRepository {
  constructor(_pool: Pool | null) {}

  async create(input: RunnerCreateInput): Promise<Runner> {
    const runner: Runner = {
      id: crypto.randomUUID(),
      name: (input.name as string) || 'unnamed',
      status: (input.status as string) || 'idle',
      currentJobs: (input.currentJobs as number) || 0,
      maxConcurrent: (input.maxConcurrent as number) || 5,
      labels: (input.labels as string[]) || [],
      tenantId: (input.tenantId as string) || '',
      url: input.url as string | undefined,
    };
    runners.set(runner.id, runner);
    return runner;
  }

  async findById(id: string): Promise<Runner | undefined> {
    return runners.get(id);
  }

  async findByStatus(status: string): Promise<Runner[]> {
    return Array.from(runners.values()).filter(r => r.status === status);
  }

  async findByLabels(tenantId: string, labels: string[]): Promise<Runner[]> {
    return Array.from(runners.values()).filter(r =>
      r.tenantId === tenantId && labels.some(l => r.labels.includes(l))
    );
  }

  async update(id: string, updates: RunnerUpdateInput): Promise<Runner | null> {
    const existing = runners.get(id);
    if (!existing) return null;
    const updated: Runner = { ...existing, ...updates };
    runners.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return runners.delete(id);
  }

  async findByTenant(tenantId: string): Promise<Runner[]> {
    return Array.from(runners.values()).filter(r => r.tenantId === tenantId);
  }

  async updateHeartbeat(id: string, _heartbeat: Date): Promise<void> {
    // Heartbeat update - in production would update last_heartbeat field
    const runner = runners.get(id);
    if (runner) {
      runner.status = 'online';
      runners.set(id, runner);
    }
  }

  async decrementJobs(id: string): Promise<void> {
    const runner = runners.get(id);
    if (runner && runner.currentJobs > 0) {
      runner.currentJobs--;
      runners.set(id, runner);
    }
  }

  async incrementJobs(id: string): Promise<void> {
    const runner = runners.get(id);
    if (runner) {
      runner.currentJobs++;
      runners.set(id, runner);
    }
  }
}

export type RunnerRepositoryType = typeof RunnerRepository;

export const PostgresRunnerRepository = {} as any;
export type PostgresRunnerRepositoryType = typeof PostgresRunnerRepository;