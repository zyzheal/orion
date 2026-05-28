/**
 * SubPipelineService - Sub-pipeline invocation management
 *
 * Handles invoking child pipelines as sub-processes within a parent pipeline run.
 * Enables reusable workflow composition (GAP-03).
 *
 * Features:
 * - invoke(): Start a child pipeline run with parameter mapping
 * - waitForCompletion(): Poll for child pipeline completion
 * - getResults(): Retrieve output results from a completed child run
 * - cancel(): Cancel a running child pipeline
 */

import { SubPipelineRepository, SubPipelineRecord } from '../../repositories/SubPipelineRepository';
import {
  SubPipelineInvocation,
  SubPipelineInvocationCreateInput,
  createSubPipelineInvocation,
  startSubPipeline,
  completeSubPipeline,
  failSubPipeline,
  cancelSubPipeline,
} from '../../models/SubPipeline';
import { PipelineEngine } from '../../engine/PipelineEngine';
import { PipelineService } from './PipelineService';
import { TriggerType } from '../../models/PipelineRun';
import pino from 'pino';
import { OrionError, ErrorCode } from '../../../errors';

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
  private repository: SubPipelineRepository | null;
  private pipelineEngine: PipelineEngine | null;
  private pipelineService: PipelineService | null;

  constructor(
    repository?: SubPipelineRepository | null,
    pipelineEngine?: PipelineEngine | null,
    pipelineService?: PipelineService | null
  ) {
    this.repository = repository || null;
    this.pipelineEngine = pipelineEngine || null;
    this.pipelineService = pipelineService || null;
  }

  // ==================== Mapping helpers ====================

  /**
   * Map database SubPipelineRecord to domain SubPipelineInvocation model
   */
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

  /**
   * Invoke a child pipeline as a sub-pipeline stage.
   *
   * Creates an invocation record, then triggers the child pipeline run
   * via the PipelineEngine. Returns immediately with the invocation ID
   * and child run ID.
   *
   * @param input - Sub-pipeline invocation parameters
   * @returns The created invocation with childRunId
   */
  async invoke(input: InvokeSubPipelineInput): Promise<SubPipelineResult> {
    // 1. Create invocation record
    const createInput: SubPipelineInvocationCreateInput = {
      parentRunId: input.parentRunId,
      childPipelineId: input.childPipelineId,
      inputParams: input.inputParams,
      stageName: input.stageName,
      outputMapping: input.outputMapping,
    };

    let invocation: SubPipelineInvocation;

    if (this.repository) {
      const record = await this.repository.create({
        parent_run_id: createInput.parentRunId,
        child_pipeline_id: createInput.childPipelineId,
        input_params: createInput.inputParams,
        stage_name: createInput.stageName,
        output_mapping: createInput.outputMapping,
      });
      invocation = this.mapInvocation(record);
    } else {
      // In-memory fallback
      invocation = createSubPipelineInvocation(createInput);
    }

    if (!this.pipelineEngine) {
      throw new Error('PipelineEngine not available for sub-pipeline invocation');
    }

    if (!this.pipelineService) {
      throw new Error('PipelineService not available for sub-pipeline invocation');
    }

    // 2. Verify child pipeline exists and is active
    const childPipeline = await this.pipelineService.getById(input.childPipelineId);
    if (!childPipeline) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Child pipeline not found: ${input.childPipelineId}`);
    }

    if (childPipeline.status !== 'active') {
      throw new OrionError(ErrorCode.NOT_FOUND, `Child pipeline is not active: ${input.childPipelineId}`);
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
        throw new OrionError(ErrorCode.OPERATION_FAILED, 'Failed to start child pipeline run');
      }

      // 4. Update invocation with child run ID
      invocation = startSubPipeline(invocation, childRun.id);

      if (this.repository) {
        await this.repository.updateChildRun(invocation.id, childRun.id, 'running');
      }

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

      if (this.repository) {
        await this.repository.updateStatus(
          invocation.id,
          'failed',
          {},
          invocation.error
        );
      }

      throw error;
    }
  }

  /**
   * Wait for a child pipeline run to complete.
   *
   * Polls the child run status until it reaches a terminal state
   * (success, failed, cancelled) or the timeout is reached.
   *
   * @param childRunId - The child pipeline run ID
   * @param timeoutMs - Maximum time to wait in milliseconds (default: 1 hour)
   * @param pollIntervalMs - Poll interval in milliseconds (default: 1 second)
   * @returns The final invocation state
   */
  async waitForCompletion(
    childRunId: string,
    timeoutMs = 3600000,
    pollIntervalMs = 1000
  ): Promise<SubPipelineInvocation> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      // Find the invocation record
      let invocation: SubPipelineInvocation | null = null;

      if (this.repository) {
        const record = await this.repository.findByChildRunId(childRunId);
        if (record) {
          invocation = this.mapInvocation(record);
        }
      }

      if (!invocation) {
        throw new OrionError(ErrorCode.NOT_FOUND, `Sub-pipeline invocation not found for childRunId: ${childRunId}`);
      }

      // Check if child has reached a terminal state
      if (invocation.status === 'completed') {
        return invocation;
      }

      if (invocation.status === 'failed') {
        throw new OrionError(ErrorCode.NOT_FOUND, `Sub-pipeline failed: ${invocation.error || 'Unknown error'}`);
      }

      if (invocation.status === 'cancelled') {
        throw new Error('Sub-pipeline was cancelled');
      }

      // Still running, poll again
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new OrionError(ErrorCode.NOT_FOUND, `Sub-pipeline timed out after ${timeoutMs}ms`);
  }

  /**
   * Get the output results from a completed child pipeline run.
   *
   * @param childRunId - The child pipeline run ID
   * @returns The output results map
   */
  async getResults(childRunId: string): Promise<Record<string, string>> {
    let invocation: SubPipelineInvocation | null = null;

    if (this.repository) {
      const record = await this.repository.findByChildRunId(childRunId);
      if (record) {
        invocation = this.mapInvocation(record);
      }
    }

    if (!invocation) {
      throw new Error(`Sub-pipeline invocation not found for childRunId: ${childRunId}`);
    }

    if (invocation.status !== 'completed') {
      throw new Error(
        `Sub-pipeline is not completed (status: ${invocation.status}). ` +
        'Cannot retrieve results.'
      );
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

  /**
   * Cancel a running child pipeline.
   *
   * @param childRunId - The child pipeline run ID
   * @returns The updated invocation
   */
  async cancel(childRunId: string): Promise<SubPipelineInvocation> {
    let invocation: SubPipelineInvocation | null = null;

    if (this.repository) {
      const record = await this.repository.findByChildRunId(childRunId);
      if (record) {
        invocation = this.mapInvocation(record);
      }
    }

    if (!invocation) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Sub-pipeline invocation not found for childRunId: ${childRunId}`);
    }

    if (invocation.status !== 'running') {
      throw new OrionError(ErrorCode.NOT_FOUND, `Cannot cancel sub-pipeline with status: ${invocation.status}`);
    }

    // Cancel via PipelineEngine
    if (this.pipelineEngine) {
      await this.pipelineEngine.cancelExecution(childRunId);
    }

    // Update invocation
    invocation = cancelSubPipeline(invocation);

    if (this.repository) {
      await this.repository.updateStatus(invocation.id, 'cancelled');
    }

    return invocation;
  }

  /**
   * Complete a sub-pipeline invocation with results.
   * Called by the PipelineEngine when the child run finishes.
   *
   * @param childRunId - The child pipeline run ID
   * @param results - Output results from the child run
   */
  async markCompleted(
    childRunId: string,
    results: Record<string, string>
  ): Promise<SubPipelineInvocation> {
    let invocation: SubPipelineInvocation | null = null;

    if (this.repository) {
      const record = await this.repository.findByChildRunId(childRunId);
      if (record) {
        invocation = this.mapInvocation(record);
      }
    }

    if (!invocation) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Sub-pipeline invocation not found for childRunId: ${childRunId}`);
    }

    invocation = completeSubPipeline(invocation, results);

    if (this.repository) {
      await this.repository.updateStatus(
        invocation.id,
        'completed',
        results
      );
    }

    return invocation;
  }

  /**
   * Mark a sub-pipeline invocation as failed.
   * Called by the PipelineEngine when the child run fails.
   *
   * @param childRunId - The child pipeline run ID
   * @param error - Error message
   */
  async markFailed(
    childRunId: string,
    error: string
  ): Promise<SubPipelineInvocation> {
    let invocation: SubPipelineInvocation | null = null;

    if (this.repository) {
      const record = await this.repository.findByChildRunId(childRunId);
      if (record) {
        invocation = this.mapInvocation(record);
      }
    }

    if (!invocation) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Sub-pipeline invocation not found for childRunId: ${childRunId}`);
    }

    invocation = failSubPipeline(invocation, error);

    if (this.repository) {
      await this.repository.updateStatus(
        invocation.id,
        'failed',
        undefined,
        error
      );
    }

    return invocation;
  }

  // ==================== Query methods ====================

  /**
   * Get all sub-pipeline invocations for a parent run
   */
  async getByParentRunId(parentRunId: string): Promise<SubPipelineInvocation[]> {
    if (this.repository) {
      const records = await this.repository.findByParentRunId(parentRunId);
      return records.map((r) => this.mapInvocation(r));
    }
    return [];
  }

  /**
   * Get a sub-pipeline invocation by ID
   */
  async getById(id: string): Promise<SubPipelineInvocation | null> {
    if (this.repository) {
      const record = await this.repository.findById(id);
      return record ? this.mapInvocation(record) : null;
    }
    return null;
  }

  /**
   * Get sub-pipeline invocations by child pipeline ID
   */
  async getByPipelineId(childPipelineId: string): Promise<SubPipelineInvocation[]> {
    if (this.repository) {
      const records = await this.repository.findByPipelineId(childPipelineId);
      return records.map((r) => this.mapInvocation(r));
    }
    return [];
  }
}
