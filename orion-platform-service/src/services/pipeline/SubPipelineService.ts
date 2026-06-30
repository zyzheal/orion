/**
 * SubPipelineService - Sub-pipeline invocation management
 *
 * Handles invoking child pipelines as sub-processes within a parent pipeline run.
 * Enables reusable workflow composition (GAP-03).
 *
 * PostgreSQL Repository pattern — repository is the single source of truth.
 * All in-memory fallback paths have been removed.
 */

import { SubPipelineRepository, SubPipelineRecord } from '../../repositories/SubPipelineRepository';
import {
  SubPipelineInvocation,
  SubPipelineInvocationCreateInput,
  startSubPipeline,
  completeSubPipeline,
  failSubPipeline,
  cancelSubPipeline,
} from '../../models/SubPipeline';
import { PipelineEngine } from '../../engine/PipelineEngine';
import { PipelineService } from './PipelineService';
import { TriggerType } from '../../models/PipelineRun';
import pino from 'pino';
import { OrionError, ErrorCode } from '../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface InvokeSubPipelineInput {
  childPipelineId: string;
  parentRunId: string;
  inputParams: Record<string, string>;
  stageName: string;
  outputMapping?: Record<string, string>;
}

export interface SubPipelineResult {
  invocation: SubPipelineInvocation;
  childRunId: string;
}

export class SubPipelineService {
  private repository: SubPipelineRepository;
  private pipelineEngine: PipelineEngine | null;
  private pipelineService: PipelineService | null;

  constructor(
    repository: SubPipelineRepository,
    pipelineEngine?: PipelineEngine | null,
    pipelineService?: PipelineService | null
  ) {
    if (!repository) throw new Error('SubPipelineRepository is required');
    this.repository = repository;
    this.pipelineEngine = pipelineEngine || null;
    this.pipelineService = pipelineService || null;
  }

  // ==================== Mapping helpers ====================

  private mapInvocation(record: SubPipelineRecord): SubPipelineInvocation {
    return {
      id: record.id,
      parentRunId: record.parent_run_id,
      childPipelineId: record.child_pipeline_id,
      childRunId: record.child_run_id,
      status: record.status as SubPipelineInvocation['status'],
      inputParams: record.input_params || {},
      outputResults: record.output_results || {},
      stageName: record.stage_name,
      outputMapping: record.output_mapping || {},
      createdAt: record.created_at,
      completedAt: record.completed_at || undefined,
      error: record.error_message || undefined,
    };
  }

  // ==================== Core operations ====================

  async invoke(input: InvokeSubPipelineInput): Promise<SubPipelineResult> {
    // 1. Create invocation record
    const record = await this.repository.create({
      parent_run_id: input.parentRunId,
      child_pipeline_id: input.childPipelineId,
      input_params: input.inputParams,
      stage_name: input.stageName,
      output_mapping: input.outputMapping,
    });
    let invocation = this.mapInvocation(record);

    if (!this.pipelineEngine) {
      throw new OrionError('PipelineEngine not available for sub-pipeline invocation', ErrorCode.SERVICE_UNAVAILABLE);
    }

    if (!this.pipelineService) {
      throw new OrionError('PipelineService not available for sub-pipeline invocation', ErrorCode.SERVICE_UNAVAILABLE);
    }

    // 2. Verify child pipeline exists and is active
    const childPipeline = await this.pipelineService.getById(input.childPipelineId);
    if (!childPipeline) {
      throw new OrionError(`Child pipeline not found: ${input.childPipelineId}`, ErrorCode.NOT_FOUND);
    }

    if (childPipeline.status !== 'active') {
      throw new OrionError(`Child pipeline is not active: ${input.childPipelineId}`, ErrorCode.NOT_FOUND);
    }

    // 3. Trigger the child pipeline run
    const context = {
      ...input.inputParams,
      parentRunId: input.parentRunId,
      subPipelineInvocationId: invocation.id,
      isSubPipeline: true,
    };

    try {
      const childRun = await this.pipelineEngine.execute(
        input.childPipelineId,
        TriggerType.API,
        'sub-pipeline',
        context
      );

      if (!childRun) {
        throw new OrionError('Failed to start child pipeline run', ErrorCode.OPERATION_FAILED);
      }

      // 4. Update invocation with child run ID
      invocation = startSubPipeline(invocation, childRun.id);
      await this.repository.updateChildRun(invocation.id, childRun.id, 'running');

      logger.info(
        {
          invocationId: invocation.id,
          parentRunId: input.parentRunId,
          childPipelineId: input.childPipelineId,
          childRunId: childRun.id,
        },
        'Sub-pipeline invoked'
      );

      return { invocation, childRunId: childRun.id };
    } catch (error) {
      // Mark invocation as failed if child run could not be started
      invocation = failSubPipeline(
        invocation,
        error instanceof Error ? error.message : 'Failed to start child pipeline'
      );

      await this.repository.updateStatus(
        invocation.id,
        'failed',
        {},
        invocation.error
      );

      throw error;
    }
  }

  async waitForCompletion(
    childRunId: string,
    timeoutMs = 3600000,
    pollIntervalMs = 1000
  ): Promise<SubPipelineInvocation> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const record = await this.repository.findByChildRunId(childRunId);
      if (!record) {
        throw new OrionError(`Sub-pipeline invocation not found for childRunId: ${childRunId}`, ErrorCode.NOT_FOUND);
      }
      const invocation = this.mapInvocation(record);

      if (invocation.status === 'completed') {
        return invocation;
      }

      if (invocation.status === 'failed') {
        throw new OrionError(`Sub-pipeline failed: ${invocation.error || 'Unknown error'}`, ErrorCode.NOT_FOUND);
      }

      if (invocation.status === 'cancelled') {
        throw new OrionError('Sub-pipeline was cancelled', ErrorCode.OPERATION_FAILED);
      }

      // Still running, poll again
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new OrionError(`Sub-pipeline timed out after ${timeoutMs}ms`, ErrorCode.NOT_FOUND);
  }

  async getResults(childRunId: string): Promise<Record<string, string>> {
    const record = await this.repository.findByChildRunId(childRunId);
    if (!record) {
      throw new OrionError(`Sub-pipeline invocation not found for childRunId: ${childRunId}`, ErrorCode.NOT_FOUND);
    }
    const invocation = this.mapInvocation(record);

    if (invocation.status !== 'completed') {
      throw new OrionError(`Sub-pipeline is not completed (status: ${invocation.status}). ` +
        'Cannot retrieve results.', 'NOT_FOUND')
    }

    // Apply output mapping: map child results to parent variable names
    const mappedResults: Record<string, string> = {};
    for (const [parentKey, childKey] of Object.entries(invocation.outputMapping)) {
      const value = invocation.outputResults[childKey];
      if (value !== undefined) {
        mappedResults[parentKey] = value;
      }
    }

    // Include unmapped results as well
    for (const [key, value] of Object.entries(invocation.outputResults)) {
      if (!(key in mappedResults)) {
        mappedResults[key] = value;
      }
    }

    return mappedResults;
  }

  async cancel(childRunId: string): Promise<SubPipelineInvocation> {
    const record = await this.repository.findByChildRunId(childRunId);
    if (!record) {
      throw new OrionError(`Sub-pipeline invocation not found for childRunId: ${childRunId}`, ErrorCode.NOT_FOUND);
    }
    let invocation = this.mapInvocation(record);

    if (invocation.status !== 'running') {
      throw new OrionError(`Cannot cancel sub-pipeline with status: ${invocation.status}`, ErrorCode.NOT_FOUND);
    }

    // Cancel via PipelineEngine
    if (this.pipelineEngine) {
      await this.pipelineEngine.cancelExecution(childRunId);
    }

    // Update invocation
    invocation = cancelSubPipeline(invocation);
    await this.repository.updateStatus(invocation.id, 'cancelled');

    return invocation;
  }

  async markCompleted(
    childRunId: string,
    results: Record<string, string>
  ): Promise<SubPipelineInvocation> {
    const record = await this.repository.findByChildRunId(childRunId);
    if (!record) {
      throw new OrionError(`Sub-pipeline invocation not found for childRunId: ${childRunId}`, ErrorCode.NOT_FOUND);
    }
    let invocation = this.mapInvocation(record);

    invocation = completeSubPipeline(invocation, results);
    await this.repository.updateStatus(invocation.id, 'completed', results);

    return invocation;
  }

  async markFailed(
    childRunId: string,
    error: string
  ): Promise<SubPipelineInvocation> {
    const record = await this.repository.findByChildRunId(childRunId);
    if (!record) {
      throw new OrionError(`Sub-pipeline invocation not found for childRunId: ${childRunId}`, ErrorCode.NOT_FOUND);
    }
    let invocation = this.mapInvocation(record);

    invocation = failSubPipeline(invocation, error);
    await this.repository.updateStatus(invocation.id, 'failed', undefined, error);

    return invocation;
  }

  // ==================== Query methods ====================

  async getByParentRunId(parentRunId: string): Promise<SubPipelineInvocation[]> {
    const records = await this.repository.findByParentRunId(parentRunId);
    return records.map((r) => this.mapInvocation(r));
  }

  async getById(id: string): Promise<SubPipelineInvocation | null> {
    const record = await this.repository.findById(id);
    return record ? this.mapInvocation(record) : null;
  }

  async getByPipelineId(childPipelineId: string): Promise<SubPipelineInvocation[]> {
    const records = await this.repository.findByPipelineId(childPipelineId);
    return records.map((r) => this.mapInvocation(r));
  }
}
