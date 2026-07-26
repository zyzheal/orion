// SubPipeline Repository - In-memory implementation
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

// In-memory store
const records = new Map<string, SubPipelineRecord>();

export class SubPipelineRepository {
  constructor(_pool: Pool | null) {}

  async create(input: SubPipelineCreateInput): Promise<SubPipelineRecord> {
    const record: SubPipelineRecord = {
      id: crypto.randomUUID(),
      parent_run_id: input.parent_run_id,
      child_pipeline_id: input.child_pipeline_id,
      status: 'pending',
      input_params: input.input_params,
      output_results: {},
      stage_name: input.stage_name,
      output_mapping: input.output_mapping ?? {},
      created_at: new Date(),
    };
    records.set(record.id, record);
    return record;
  }

  async findById(id: string): Promise<SubPipelineRecord | null> {
    return records.get(id) ?? null;
  }

  async findByParentRunId(parentRunId: string): Promise<SubPipelineRecord[]> {
    return Array.from(records.values()).filter(r => r.parent_run_id === parentRunId);
  }

  async findByChildRunId(childRunId: string): Promise<SubPipelineRecord | null> {
    return Array.from(records.values()).find(r => r.child_run_id === childRunId) ?? null;
  }

  async findByPipelineId(pipelineId: string): Promise<SubPipelineRecord[]> {
    return Array.from(records.values()).filter(r => r.child_pipeline_id === pipelineId);
  }

  async update(id: string, updates: SubPipelineUpdateInput): Promise<SubPipelineRecord | null> {
    const existing = records.get(id);
    if (!existing) return null;
    const updated: SubPipelineRecord = { ...existing, ...updates };
    records.set(id, updated);
    return updated;
  }

  async updateChildRun(id: string, childRunId: string, status: string): Promise<SubPipelineRecord | null> {
    return this.update(id, { child_run_id: childRunId, status });
  }

  async updateStatus(id: string, status: string, outputResults?: Record<string, unknown>, error?: string): Promise<SubPipelineRecord | null> {
    return this.update(id, {
      status,
      output_results: outputResults,
      completed_at: status === 'completed' || status === 'failed' ? new Date() : undefined,
      error_message: error,
    });
  }

  async delete(id: string): Promise<boolean> {
    return records.delete(id);
  }
}

export type SubPipelineRepositoryType = typeof SubPipelineRepository;