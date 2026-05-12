// Stub - TODO: implement with PostgreSQL
import { Pool } from 'pg';

export interface SubPipelineRecord {
  id: string;
  parent_run_id: string;
  child_pipeline_id: string;
  child_run_id?: string;
  status: string;
  input_params: Record<string, string>;
  output_results: Record<string, unknown>;
  stage_name: string;
  output_mapping: Record<string, string>;
  created_at: Date;
  completed_at?: Date | null;
  error_message?: string | null;
}

export interface SubPipelineCreateInput {
  parent_run_id: string;
  child_pipeline_id: string;
  input_params: Record<string, string>;
  stage_name: string;
  output_mapping?: Record<string, string>;
}

export interface SubPipelineUpdateInput {
  child_run_id?: string;
  status?: string;
  output_results?: Record<string, unknown>;
  completed_at?: Date;
  error_message?: string;
}

export class SubPipelineRepository {
  constructor(_pool: Pool | null) {}
  async create(_input: SubPipelineCreateInput): Promise<SubPipelineRecord> {
    throw new Error('Not implemented');
  }
  async findById(_id: string): Promise<SubPipelineRecord | null> {
    return null;
  }
  async findByParentRunId(_parentRunId: string): Promise<SubPipelineRecord[]> {
    return [];
  }
  async findByChildRunId(_childRunId: string): Promise<SubPipelineRecord | null> {
    return null;
  }
  async findByPipelineId(_pipelineId: string): Promise<SubPipelineRecord[]> {
    return [];
  }
  async update(_id: string, _updates: SubPipelineUpdateInput): Promise<SubPipelineRecord | null> {
    return null;
  }
  async updateChildRun(_id: string, _childRunId: string, _status: string): Promise<SubPipelineRecord | null> {
    return null;
  }
  async updateStatus(_id: string, _status: string, _outputResults?: Record<string, unknown>, _error?: string): Promise<SubPipelineRecord | null> {
    return null;
  }
  async delete(_id: string): Promise<boolean> {
    return false;
  }
}
export type SubPipelineRepositoryType = typeof SubPipelineRepository;
