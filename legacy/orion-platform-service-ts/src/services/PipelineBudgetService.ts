/**
 * PipelineBudgetService — Business logic for Pipeline Budget Management
 *
 * Core capabilities:
 * - Set/update budget for a pipeline
 * - Check if a pipeline run is allowed based on budget
 * - Track usage and auto-block when cost exceeds max
 * - Delete budget
 */

import { PipelineBudgetRepository, PipelineBudgetEntity } from '../repositories/PipelineBudgetRepository';
import { OrionError } from '../errors';

export interface PipelineBudget {
  id: string;
  pipelineId: string;
  maxCost: number;
  currentCost: number;
  currency: string;
  blocked: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetCheckResult {
  allowed: boolean;
  budget?: PipelineBudget;
  reason?: string;
}

export interface SetBudgetInput {
  pipelineId: string;
  maxCost: number;
  currency?: string;
  createdBy: string;
}

export class PipelineBudgetService {
  constructor(private repository: PipelineBudgetRepository) {}

  // ==================== Set / Create Budget ====================

  /**
   * Create or update a budget for a pipeline.
   * If budget exists, update maxCost and unblock.
   * If not, create a new budget with current_cost = 0.
   */
  async setBudget(input: SetBudgetInput): Promise<PipelineBudget> {
    const entity = await this.repository.upsert(
      input.pipelineId,
      input.maxCost,
      input.currency ?? 'USD',
      input.createdBy,
    );
    return this.toBudget(entity);
  }

  // ==================== Get Budget ====================

  /**
   * Retrieve the current budget for a pipeline.
   * Returns undefined if no budget is set.
   */
  async getBudget(pipelineId: string): Promise<PipelineBudget | undefined> {
    const entity = await this.repository.findByPipelineId(pipelineId);
    return entity ? this.toBudget(entity) : undefined;
  }

  // ==================== Check Budget ====================

  /**
   * Check whether a pipeline run is allowed based on its budget.
   *
   * Rules:
   * - No budget set => allowed
   * - Manually blocked => rejected
   * - currentCost >= maxCost => rejected
   * - Otherwise => allowed
   */
  async checkBudget(pipelineId: string): Promise<BudgetCheckResult> {
    const entity = await this.repository.findByPipelineId(pipelineId);

    // No budget means unrestricted
    if (!entity) {
      return { allowed: true };
    }

    const budget = this.toBudget(entity);

    if (budget.blocked) {
      return {
        allowed: false,
        budget,
        reason: 'Budget is blocked',
      };
    }

    if (budget.currentCost >= budget.maxCost) {
      return {
        allowed: false,
        budget,
        reason: `Budget exceeded: ${budget.currentCost} >= ${budget.maxCost} ${budget.currency}`,
      };
    }

    return { allowed: true, budget };
  }

  // ==================== Update Usage ====================

  /**
   * Increment the current_cost by costDelta.
   * Auto-blocks the budget when newCost >= maxCost.
   *
   * Returns the updated budget.
   * Throws if no budget exists for the pipeline.
   */
  async updateUsage(pipelineId: string, costDelta: number): Promise<PipelineBudget> {
    const entity = await this.repository.findByPipelineId(pipelineId);
    if (!entity) {
      throw new OrionError(`No budget set for pipeline ${pipelineId}`, 'OPERATION_FAILED')
    }

    const newCost = entity.currentCost + costDelta;
    const updated = await this.repository.updateCost(pipelineId, newCost);
    if (!updated) {
      throw new OrionError(`Failed to update budget cost for pipeline ${pipelineId}`, 'OPERATION_FAILED')
    }

    // Auto-block when cost reaches or exceeds max
    if (newCost >= entity.maxCost) {
      await this.repository.updateBlocked(pipelineId, true);
      updated.blocked = true;
    }

    return this.toBudget(updated);
  }

  // ==================== Delete Budget ====================

  /**
   * Remove the budget for a pipeline.
   * Returns true if a budget was deleted, false if none existed.
   */
  async deleteBudget(pipelineId: string): Promise<boolean> {
    return this.repository.deleteByPipelineId(pipelineId);
  }

  // ==================== Internal Helpers ====================

  private toBudget(entity: PipelineBudgetEntity): PipelineBudget {
    return {
      id: entity.id,
      pipelineId: entity.pipelineId,
      maxCost: entity.maxCost,
      currentCost: entity.currentCost,
      currency: entity.currency,
      blocked: entity.blocked,
      createdBy: entity.createdBy,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
