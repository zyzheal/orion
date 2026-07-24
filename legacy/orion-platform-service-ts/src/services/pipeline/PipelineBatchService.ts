/**
 * PipelineBatchService - Business logic for Pipeline Batch Execution
 *
 * Manages phase groups and batch runs for progressive/gradual pipeline execution.
 * Supports percentage, count, and label-based batch strategies.
 *
 * State machine for Phase Group:
 *   pending -> running -> completed
 *              |-> failed -> rolling_back -> rolled_back
 *              |-> paused -> running (resume)
 *   pending -> cancelled
 *
 * State machine for Batch Run:
 *   pending -> running -> completed
 *              |-> failed
 *   pending -> skipped (prior batch failure)
 */

import {
  PipelineBatchRepository,
  PhaseGroup,
  BatchRun,
  CreatePhaseGroupInput,
  CreateBatchRunInput,
  UpdatePhaseGroupInput,
  UpdateBatchRunInput,
  ListPhaseGroupsFilter,
} from './PipelineBatchRepository';
import { getCurrentTenantId } from '../../db/tenant-context-storage';

export class PipelineBatchService {
  constructor(private repository: PipelineBatchRepository) {}

  // ==================== Phase Group CRUD ====================

  async getPhaseGroup(id: string): Promise<PhaseGroup> {
    const group = await this.repository.findPhaseGroupById(id);
    if (!group) {
      throw new OrionError('Phase group not found', 'NOT_FOUND');
    }
    return group;
  }

  async listPhaseGroups(filter?: ListPhaseGroupsFilter): Promise<PhaseGroup[]> {
    return this.repository.listPhaseGroups(filter);
  }

  async createPhaseGroup(input: CreatePhaseGroupInput): Promise<PhaseGroup> {
    this.validateBatchStrategy(input.batch_strategy, input.batch_config);
    return this.repository.createPhaseGroup(input);
  }

  async updatePhaseGroup(id: string, input: UpdatePhaseGroupInput): Promise<PhaseGroup> {
    const group = await this.getPhaseGroup(id);
    if (group.status !== 'pending') {
      throw new OrionError('Can only update phase group in pending status', 'STATE_CONFLICT');
    }
    if (input.batch_strategy && input.batch_config) {
      this.validateBatchStrategy(input.batch_strategy, input.batch_config);
    }
    const updated = await this.repository.updatePhaseGroup(id, input);
    if (!updated) {
      throw new OrionError('Failed to update phase group', 'OPERATION_FAILED');
    }
    return updated;
  }

  async deletePhaseGroup(id: string): Promise<boolean> {
    const group = await this.getPhaseGroup(id);
    if (group.status === 'running') {
      throw new OrionError('Cannot delete a running phase group', 'STATE_CONFLICT');
    }
    // Cascade will delete batch runs
    return this.repository.deletePhaseGroup(id);
  }

  // ==================== Batch Execution Operations ====================

  async startExecution(groupId: string): Promise<PhaseGroup> {
    const group = await this.getPhaseGroup(groupId);
    if (group.status !== 'pending') {
      throw new OrionError('Phase group must be in pending status to start execution', 'STATE_CONFLICT');
    }

    // Create batch run records based on strategy
    const batches = this.resolveBatches(group.batch_strategy, group.batch_config);
    for (let i = 0; i < batches.length; i++) {
      await this.repository.createBatchRun({
        group_id: groupId,
        batch_index: i,
        batch_size: batches[i],
      });
    }

    // Update group status to running
    const updated = await this.repository.updatePhaseGroup(groupId, {
      status: 'running',
      current_batch: 0,
    });
    if (!updated) {
      throw new OrionError('Failed to start execution', 'OPERATION_FAILED');
    }

    // Mark first batch as running
    const allBatches = await this.repository.listBatchRunsByGroup(groupId);
    if (allBatches.length > 0) {
      await this.repository.updateBatchRun(allBatches[0].id, {
        status: 'running',
        started_at: new Date(),
      });
    }

    return updated;
  }

  async pauseExecution(groupId: string): Promise<PhaseGroup> {
    const group = await this.getPhaseGroup(groupId);
    if (group.status !== 'running') {
      throw new OrionError('Can only pause a running phase group', 'STATE_CONFLICT');
    }

    // Mark current running batch as pending (paused effect)
    const batches = await this.repository.listBatchRunsByGroup(groupId);
    const runningBatch = batches.find(b => b.status === 'running');
    if (runningBatch) {
      await this.repository.updateBatchRun(runningBatch.id, { status: 'pending' });
    }

    const updated = await this.repository.updatePhaseGroup(groupId, { status: 'paused' });
    if (!updated) {
      throw new OrionError('Failed to pause execution', 'OPERATION_FAILED');
    }
    return updated;
  }

  async resumeExecution(groupId: string): Promise<PhaseGroup> {
    const group = await this.getPhaseGroup(groupId);
    if (group.status !== 'paused') {
      throw new OrionError('Can only resume a paused phase group', 'STATE_CONFLICT');
    }

    // Re-activate current batch
    const batches = await this.repository.listBatchRunsByGroup(groupId);
    const currentBatch = batches.find(b => b.batch_index === group.current_batch);
    if (currentBatch && currentBatch.status === 'pending') {
      await this.repository.updateBatchRun(currentBatch.id, { status: 'running' });
    }

    const updated = await this.repository.updatePhaseGroup(groupId, { status: 'running' });
    if (!updated) {
      throw new OrionError('Failed to resume execution', 'OPERATION_FAILED');
    }
    return updated;
  }

  async advanceToNextBatch(groupId: string): Promise<PhaseGroup> {
    const group = await this.getPhaseGroup(groupId);
    if (group.status !== 'running' && group.status !== 'waiting_approval') {
      throw new OrionError('Can only advance from running or waiting_approval status', 'STATE_CONFLICT');
    }

    const batches = await this.repository.listBatchRunsByGroup(groupId);

    // Mark current batch as completed
    const currentBatch = batches.find(b => b.batch_index === group.current_batch);
    if (currentBatch) {
      await this.repository.updateBatchRun(currentBatch.id, {
        status: 'completed',
        completed_at: new Date(),
      });
    }

    const nextBatchIndex = group.current_batch + 1;
    if (nextBatchIndex >= batches.length) {
      // All batches completed
      const updated = await this.repository.updatePhaseGroup(groupId, {
        status: 'completed',
        current_batch: nextBatchIndex,
      });
      if (!updated) {
        throw new OrionError('Failed to complete execution', 'OPERATION_FAILED');
      }
      return updated;
    }

    // Start next batch
    const nextBatch = batches[nextBatchIndex];
    await this.repository.updateBatchRun(nextBatch.id, {
      status: 'running',
      started_at: new Date(),
    });

    const updated = await this.repository.updatePhaseGroup(groupId, {
      status: 'running',
      current_batch: nextBatchIndex,
    });
    if (!updated) {
      throw new OrionError('Failed to advance to next batch', 'OPERATION_FAILED');
    }
    return updated;
  }

  async rollbackExecution(groupId: string): Promise<PhaseGroup> {
    const group = await this.getPhaseGroup(groupId);
    if (!['running', 'paused', 'failed', 'waiting_approval'].includes(group.status)) {
      throw new OrionError('Cannot rollback from current status', 'STATE_CONFLICT');
    }

    // Update group status
    await this.repository.updatePhaseGroup(groupId, { status: 'rolling_back' });

    const batches = await this.repository.listBatchRunsByGroup(groupId);
    const completedBatches = batches.filter(b => b.status === 'completed').reverse();

    for (const batch of completedBatches) {
      await this.repository.updateBatchRun(batch.id, { status: 'rolled_back' });
    }

    // Skip remaining pending batches
    const pendingBatches = batches.filter(b => b.status === 'pending' || b.status === 'running');
    for (const batch of pendingBatches) {
      await this.repository.updateBatchRun(batch.id, { status: 'skipped' });
    }

    const updated = await this.repository.updatePhaseGroup(groupId, { status: 'rolled_back' });
    if (!updated) {
      throw new OrionError('Failed to rollback execution', 'OPERATION_FAILED');
    }
    return updated;
  }

  async completeBatch(groupId: string, batchId: string, result?: Record<string, unknown>): Promise<BatchRun> {
    const batch = await this.repository.findBatchRunById(batchId);
    if (!batch) {
      throw new OrionError('Batch run not found', 'NOT_FOUND');
    }
    if (batch.group_id !== groupId) {
      throw new OrionError('Batch does not belong to this group', 'VALIDATION_ERROR');
    }

    const updated = await this.repository.updateBatchRun(batchId, {
      status: 'completed',
      completed_at: new Date(),
      result: result || undefined,
    });
    if (!updated) {
      throw new OrionError('Failed to complete batch', 'OPERATION_FAILED');
    }
    return updated;
  }

  async failBatch(groupId: string, batchId: string, result?: Record<string, unknown>): Promise<BatchRun> {
    const batch = await this.repository.findBatchRunById(batchId);
    if (!batch) {
      throw new OrionError('Batch run not found', 'NOT_FOUND');
    }
    if (batch.group_id !== groupId) {
      throw new OrionError('Batch does not belong to this group', 'VALIDATION_ERROR');
    }

    const updated = await this.repository.updateBatchRun(batchId, {
      status: 'failed',
      completed_at: new Date(),
      result: result || undefined,
    });
    if (!updated) {
      throw new OrionError('Failed to mark batch as failed', 'OPERATION_FAILED');
    }

    // Mark group as failed
    await this.repository.updatePhaseGroup(groupId, { status: 'failed' });

    return updated;
  }

  // ==================== Batch Runs ====================

  async getBatchRun(id: string): Promise<BatchRun> {
    const batch = await this.repository.findBatchRunById(id);
    if (!batch) {
      throw new OrionError('Batch run not found', 'NOT_FOUND');
    }
    return batch;
  }

  async listBatchRuns(groupId: string): Promise<BatchRun[]> {
    return this.repository.listBatchRunsByGroup(groupId);
  }

  // ==================== Validation ====================

  private validateBatchStrategy(strategy: string, config: Record<string, unknown>): void {
    const validStrategies = ['percentage', 'count', 'label'];
    if (!validStrategies.includes(strategy)) {
      throw new OrionError(`Invalid batch strategy: ${strategy}. Must be one of: ${validStrategies.join(', ')}`, 'VALIDATION_ERROR');
    }

    if (!config || typeof config !== 'object') {
      throw new OrionError('batch_config must be a non-null object', 'VALIDATION_ERROR');
    }
  }

  private resolveBatches(strategy: string, config: Record<string, unknown>): string[] {
    const batches = config.batches;
    if (!Array.isArray(batches) || batches.length === 0) {
      throw new OrionError('batch_config.batches must be a non-empty array', 'VALIDATION_ERROR');
    }

    return batches.map((b: unknown) => {
      if (strategy === 'percentage') {
        return `${b}%`;
      }
      if (strategy === 'count') {
        return String(b);
      }
      // label strategy
      return String(b);
    });
  }
}

// Inline OrionError to avoid circular dependency if needed
class OrionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'OrionError';
  }
}
