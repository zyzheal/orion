/**
 * TASK-704: Recovery Service
 *
 * Handles disaster recovery planning, point-in-time recovery,
 * recovery plan execution, and RTO/RPO tracking.
 */

import { EventEmitter } from 'events';
import {
  RecoveryPlan,
  RecoveryExecution,
  RecoveryStepExecution,
  RecoveryStatus,
  BackupRecord,
} from './types';
import { OrionError, ErrorCode } from '../../../errors';

/**
 * Recovery Service - Disaster recovery and RTO/RPO tracking
 */
export class RecoveryService extends EventEmitter {
  /** Recovery plans */
  private recoveryPlans: Map<string, RecoveryPlan> = new Map();

  /** Recovery executions */
  private executions: Map<string, RecoveryExecution> = new Map();

  /** Available backups reference */
  private backups: Map<string, BackupRecord> = new Map();

  constructor() {
    super();
  }

  // ==================== Recovery Plan Management ====================

  /**
   * Create a recovery plan
   */
  createPlan(plan: Omit<RecoveryPlan, 'createdAt' | 'updatedAt'>): RecoveryPlan {
    const now = new Date();
    const fullPlan: RecoveryPlan = {
      ...plan,
      createdAt: now,
      updatedAt: now,
    };

    // Validate RTO and RPO are positive
    if (fullPlan.rto <= 0) {
      throw new Error('RTO must be a positive number (milliseconds)');
    }
    if (fullPlan.rpo <= 0) {
      throw new Error('RPO must be a positive number (milliseconds)');
    }

    // Sort steps by order
    fullPlan.steps.sort((a, b) => a.order - b.order);

    this.recoveryPlans.set(fullPlan.id, fullPlan);
    this.emit('plan:created', fullPlan);
    return fullPlan;
  }

  /**
   * Get a recovery plan
   */
  getPlan(planId: string): RecoveryPlan | null {
    return this.recoveryPlans.get(planId) || null;
  }

  /**
   * Get all recovery plans
   */
  getAllPlans(): RecoveryPlan[] {
    return Array.from(this.recoveryPlans.values());
  }

  /**
   * Update a recovery plan
   */
  updatePlan(planId: string, updates: Partial<RecoveryPlan>): RecoveryPlan | null {
    const plan = this.recoveryPlans.get(planId);
    if (!plan) return null;

    const updated = {
      ...plan,
      ...updates,
      updatedAt: new Date(),
    };

    if (updated.steps) {
      updated.steps.sort((a, b) => a.order - b.order);
    }

    this.recoveryPlans.set(planId, updated);
    this.emit('plan:updated', updated);
    return updated;
  }

  /**
   * Delete a recovery plan
   */
  deletePlan(planId: string): boolean {
    const deleted = this.recoveryPlans.delete(planId);
    if (deleted) {
      this.emit('plan:deleted', planId);
    }
    return deleted;
  }

  /**
   * Mark a recovery plan as tested
   */
  markPlanTested(planId: string): RecoveryPlan | null {
    return this.updatePlan(planId, { lastTested: new Date() });
  }

  // ==================== Recovery Execution ====================

  /**
   * Initiate a recovery process
   */
  async initiateRecovery(
    planId: string,
    options?: {
      backupId?: string;
      targetTime?: Date;
    }
  ): Promise<RecoveryExecution> {
    const plan = this.recoveryPlans.get(planId);
    if (!plan) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Recovery plan ${planId} not found`);
    }

    if (!plan.enabled) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Recovery plan ${planId} is disabled`);
    }

    // Create recovery execution record
    const executionId = `recovery-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const stepExecutions: RecoveryStepExecution[] = plan.steps.map(step => ({
      stepOrder: step.order,
      description: step.description,
      status: 'pending',
    }));

    const execution: RecoveryExecution = {
      id: executionId,
      planId,
      planName: plan.name,
      status: 'initiated',
      targetTime: options?.targetTime,
      backupId: options?.backupId,
      stepExecutions,
      initiatedAt: new Date(),
      rtoTargetMs: plan.rto,
      rpoTargetMs: plan.rpo,
    };

    this.executions.set(executionId, execution);
    this.emit('recovery:initiated', execution);

    return execution;
  }

  /**
   * Execute a recovery plan
   */
  async executeRecoveryPlan(executionId: string): Promise<RecoveryExecution> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Recovery execution ${executionId} not found`);
    }

    if (execution.status !== 'initiated') {
      throw new OrionError(ErrorCode.NOT_FOUND, `Recovery execution ${executionId} is not in initiated state`);
    }

    const plan = this.recoveryPlans.get(execution.planId);
    if (!plan) {
      throw new Error(`Recovery plan ${execution.planId} not found`);
    }

    execution.status = 'in_progress';
    this.emit('recovery:started', execution);

    let allStepsCompleted = true;

    try {
      for (const step of plan.steps) {
        const stepExec = execution.stepExecutions.find(s => s.stepOrder === step.order);
        if (!stepExec) continue;

        // Check dependencies
        if (step.dependsOn && step.dependsOn.length > 0) {
          const depsMet = step.dependsOn.every(depOrder => {
            const depStep = execution.stepExecutions.find(s => s.stepOrder === depOrder);
            return depStep?.status === 'completed';
          });

          if (!depsMet) {
            stepExec.status = 'skipped';
            stepExec.errorMessage = 'Dependencies not met';
            continue;
          }
        }

        // Execute step
        stepExec.status = 'running';
        stepExec.startedAt = new Date();
        this.emit('recovery:step:started', { executionId, step: stepExec });

        try {
          await this.executeStep(step, execution);
          stepExec.status = 'completed';
          stepExec.completedAt = new Date();
          this.emit('recovery:step:completed', { executionId, step: stepExec });
        } catch (error: any) {
          stepExec.status = 'failed';
          stepExec.completedAt = new Date();
          stepExec.errorMessage = error.message;
          allStepsCompleted = false;
          this.emit('recovery:step:failed', { executionId, step: stepExec, error });
          break;
        }
      }
    } finally {
      // Complete the recovery
      execution.completedAt = new Date();
      execution.actualRtoMs = execution.completedAt.getTime() - execution.initiatedAt.getTime();

      // Track RTO
      this.trackRTO(execution);

      // Track RPO
      this.trackRPO(execution);

      if (allStepsCompleted) {
        execution.status = 'completed';

        // Mark plan as tested
        this.markPlanTested(execution.planId);

        this.emit('recovery:completed', execution);
      } else {
        execution.status = 'failed';
        execution.errorMessage = 'One or more recovery steps failed';
        this.emit('recovery:failed', execution);
      }
    }

    return execution;
  }

  /**
   * Execute a single recovery step (simulated)
   */
  private async executeStep(
    step: RecoveryPlan['steps'][number],
    execution: RecoveryExecution
  ): Promise<void> {
    // Simulate step execution with a short delay
    const duration = step.estimatedDurationMs || 100;
    await new Promise(resolve => setTimeout(resolve, Math.min(duration, 50)));

    // Simulate potential failure for testing
    if (step.action === 'verify' && !execution.backupId) {
      // Verify step without a backup source is ok
      return;
    }

    // All steps succeed in simulation
    return;
  }

  // ==================== Point-in-Time Recovery ====================

  /**
   * Find the best backup for point-in-time recovery
   */
  findBackupForPointInTime(
    targetTime: Date,
    backups: BackupRecord[]
  ): { backup: BackupRecord; dataLossMs: number } | null {
    // Find the most recent completed/verified backup before the target time
    const eligibleBackups = backups
      .filter(
        b =>
          (b.status === 'completed' || b.status === 'verified') &&
          b.completedAt &&
          b.completedAt <= targetTime
      )
      .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime());

    if (eligibleBackups.length === 0) return null;

    const bestBackup = eligibleBackups[0];
    const dataLossMs = targetTime.getTime() - bestBackup.completedAt!.getTime();

    return { backup: bestBackup, dataLossMs };
  }

  /**
   * Initiate point-in-time recovery
   */
  async initiatePointInTimeRecovery(
    planId: string,
    targetTime: Date,
    backups: BackupRecord[]
  ): Promise<RecoveryExecution> {
    const backupResult = this.findBackupForPointInTime(targetTime, backups);

    if (!backupResult) {
      throw new Error(`No suitable backup found for point-in-time recovery at ${targetTime.toISOString()}`);
    }

    const execution = await this.initiateRecovery(planId, {
      backupId: backupResult.backup.id,
      targetTime,
    });

    return execution;
  }

  // ==================== RTO Tracking ====================

  /**
   * Track Recovery Time Objective compliance
   */
  trackRTO(execution: RecoveryExecution): boolean {
    if (!execution.actualRtoMs) return false;

    const met = execution.actualRtoMs <= execution.rtoTargetMs;
    execution.rtoMet = met;

    this.emit('recovery:rto:tracked', {
      executionId: execution.id,
      actualMs: execution.actualRtoMs,
      targetMs: execution.rtoTargetMs,
      met,
    });

    return met;
  }

  /**
   * Track Recovery Point Objective compliance
   */
  trackRPO(execution: RecoveryExecution): boolean {
    if (!execution.targetTime || !execution.completedAt) return false;

    // RPO is the data loss window
    // Find the actual data loss based on backup time vs target time
    const backupRecord = this.backups.get(execution.backupId || '');
    let dataLossMs: number;

    if (backupRecord && backupRecord.completedAt) {
      dataLossMs = execution.targetTime.getTime() - backupRecord.completedAt.getTime();
    } else {
      // Estimate based on RPO target
      dataLossMs = execution.rpoTargetMs;
    }

    execution.actualRpoMs = dataLossMs;
    execution.rpoMet = dataLossMs <= execution.rpoTargetMs;

    this.emit('recovery:rpo:tracked', {
      executionId: execution.id,
      actualMs: execution.actualRpoMs,
      targetMs: execution.rpoTargetMs,
      met: execution.rpoMet,
    });

    return execution.rpoMet;
  }

  /**
   * Register backup records for RPO calculation
   */
  registerBackups(backups: BackupRecord[]): void {
    for (const backup of backups) {
      this.backups.set(backup.id, backup);
    }
  }

  // ==================== Execution History ====================

  /**
   * Get a recovery execution
   */
  getExecution(executionId: string): RecoveryExecution | null {
    return this.executions.get(executionId) || null;
  }

  /**
   * Get all recovery executions
   */
  getAllExecutions(): RecoveryExecution[] {
    return Array.from(this.executions.values());
  }

  /**
   * Get executions for a specific plan
   */
  getExecutionsForPlan(planId: string): RecoveryExecution[] {
    return this.getAllExecutions().filter(e => e.planId === planId);
  }

  /**
   * Get RTO/RPO statistics
   */
  getRtoRpoStats(): {
    totalExecutions: number;
    completedExecutions: number;
    rtoMetCount: number;
    rtoMissedCount: number;
    rpoMetCount: number;
    rpoMissedCount: number;
    averageRtoMs: number;
    averageRpoMs: number;
    worstRtoMs: number;
    worstRpoMs: number;
  } {
    const completed = this.getAllExecutions().filter(e => e.status === 'completed' || e.status === 'failed');

    const stats = {
      totalExecutions: this.getAllExecutions().length,
      completedExecutions: completed.length,
      rtoMetCount: completed.filter(e => e.rtoMet === true).length,
      rtoMissedCount: completed.filter(e => e.rtoMet === false).length,
      rpoMetCount: completed.filter(e => e.rpoMet === true).length,
      rpoMissedCount: completed.filter(e => e.rpoMet === false).length,
      averageRtoMs: 0,
      averageRpoMs: 0,
      worstRtoMs: 0,
      worstRpoMs: 0,
    };

    if (completed.length > 0) {
      const rtoValues = completed.filter(e => e.actualRtoMs !== undefined).map(e => e.actualRtoMs!);
      const rpoValues = completed.filter(e => e.actualRpoMs !== undefined).map(e => e.actualRpoMs!);

      if (rtoValues.length > 0) {
        stats.averageRtoMs = Math.round(rtoValues.reduce((a, b) => a + b, 0) / rtoValues.length);
        stats.worstRtoMs = Math.max(...rtoValues);
      }
      if (rpoValues.length > 0) {
        stats.averageRpoMs = Math.round(rpoValues.reduce((a, b) => a + b, 0) / rpoValues.length);
        stats.worstRpoMs = Math.max(...rpoValues);
      }
    }

    return stats;
  }

  /**
   * Rollback a recovery execution
   */
  rollbackRecovery(executionId: string): RecoveryExecution | null {
    const execution = this.executions.get(executionId);
    if (!execution) return null;

    if (execution.status !== 'in_progress' && execution.status !== 'failed') {
      return null; // Can only rollback in-progress or failed recoveries
    }

    execution.status = 'rolled_back';
    execution.completedAt = new Date();

    this.emit('recovery:rolled_back', execution);
    return execution;
  }
}
