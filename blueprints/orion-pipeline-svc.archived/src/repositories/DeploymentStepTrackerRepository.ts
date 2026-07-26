// DeploymentStepTracker Repository - In-memory implementation
import { Pool } from 'pg';

export type DeploymentStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'healthy' | 'unhealthy' | 'rolledback';

export interface DeploymentStepTrackerEntity {
  id: string;
  run_id: string;
  strategy_id: string;
  strategy_type: string;
  total_steps: number;
  current_step: number;
  current_weight: number;
  status: DeploymentStepStatus;
  rollback_reason?: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date | null;
}

export interface DeploymentHealthCheckEntity {
  id: string;
  step_tracker_id: string;
  step_index: number;
  endpoint: string;
  status_code: number | null;
  response_time: number | null;
  healthy: boolean;
  error_message: string | null;
  checked_at: Date;
}

export interface DeploymentStepTrackerCreateInput {
  run_id: string;
  strategy_id: string;
  strategy_type: string;
  total_steps: number;
}

export interface HealthCheckRecordInput {
  step_tracker_id: string;
  step_index: number;
  endpoint: string;
  status_code: number | null;
  response_time: number;
  healthy: boolean;
  error_message: string | null;
}

// In-memory stores
const trackers = new Map<string, DeploymentStepTrackerEntity>();
const healthChecks = new Map<string, DeploymentHealthCheckEntity[]>();

export class DeploymentStepTrackerRepository {
  constructor(_pool: Pool | null) {}

  async create(input: DeploymentStepTrackerCreateInput): Promise<DeploymentStepTrackerEntity> {
    const now = new Date();
    const entity: DeploymentStepTrackerEntity = {
      id: crypto.randomUUID(),
      run_id: input.run_id,
      strategy_id: input.strategy_id,
      strategy_type: input.strategy_type,
      total_steps: input.total_steps,
      current_step: 0,
      current_weight: 0,
      status: 'pending',
      created_at: now,
      updated_at: now,
    };
    trackers.set(entity.id, entity);
    return entity;
  }

  async findById(id: string): Promise<DeploymentStepTrackerEntity | null> {
    return trackers.get(id) ?? null;
  }

  async findByRunId(runId: string): Promise<DeploymentStepTrackerEntity | null> {
    return Array.from(trackers.values()).find(t => t.run_id === runId) ?? null;
  }

  async updateStatus(id: string, status: DeploymentStepStatus, completedAt?: Date): Promise<void> {
    const tracker = trackers.get(id);
    if (tracker) {
      tracker.status = status;
      tracker.updated_at = new Date();
      if (completedAt || status === 'completed' || status === 'failed') {
        tracker.completed_at = completedAt ?? new Date();
      }
      trackers.set(id, tracker);
    }
  }

  async advanceStep(id: string, stepIndex: number, weight: number): Promise<void> {
    const tracker = trackers.get(id);
    if (tracker) {
      tracker.current_step = stepIndex;
      tracker.current_weight = weight;
      tracker.updated_at = new Date();
      trackers.set(id, tracker);
    }
  }

  async setRollbackReason(id: string, reason: string): Promise<void> {
    const tracker = trackers.get(id);
    if (tracker) {
      tracker.rollback_reason = reason;
      tracker.updated_at = new Date();
      trackers.set(id, tracker);
    }
  }

  async getHealthChecks(stepTrackerId: string): Promise<DeploymentHealthCheckEntity[]> {
    return healthChecks.get(stepTrackerId) ?? [];
  }

  async recordHealthCheck(input: HealthCheckRecordInput): Promise<void> {
    const check: DeploymentHealthCheckEntity = {
      id: crypto.randomUUID(),
      step_tracker_id: input.step_tracker_id,
      step_index: input.step_index,
      endpoint: input.endpoint,
      status_code: input.status_code,
      response_time: input.response_time,
      healthy: input.healthy,
      error_message: input.error_message,
      checked_at: new Date(),
    };
    const existing = healthChecks.get(input.step_tracker_id) ?? [];
    existing.push(check);
    healthChecks.set(input.step_tracker_id, existing);
  }
}

export type DeploymentStepTrackerRepositoryType = typeof DeploymentStepTrackerRepository;