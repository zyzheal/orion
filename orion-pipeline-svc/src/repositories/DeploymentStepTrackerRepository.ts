// Stub - TODO: implement with PostgreSQL
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

export class DeploymentStepTrackerRepository {
  constructor(_pool: Pool | null) {}
  async create(_input: DeploymentStepTrackerCreateInput): Promise<DeploymentStepTrackerEntity> {
    throw new Error('Not implemented');
  }
  async findById(_id: string): Promise<DeploymentStepTrackerEntity | null> {
    return null;
  }
  async findByRunId(_runId: string): Promise<DeploymentStepTrackerEntity | null> {
    return null;
  }
  async updateStatus(_id: string, _status: DeploymentStepStatus, _completedAt?: Date): Promise<void> {
    throw new Error('Not implemented');
  }
  async advanceStep(_id: string, _stepIndex: number, _weight: number): Promise<void> {
    throw new Error('Not implemented');
  }
  async setRollbackReason(_id: string, _reason: string): Promise<void> {
    throw new Error('Not implemented');
  }
  async getHealthChecks(_stepTrackerId: string): Promise<DeploymentHealthCheckEntity[]> {
    return [];
  }
  async recordHealthCheck(_input: HealthCheckRecordInput): Promise<void> {
    throw new Error('Not implemented');
  }
}
export type DeploymentStepTrackerRepositoryType = typeof DeploymentStepTrackerRepository;
