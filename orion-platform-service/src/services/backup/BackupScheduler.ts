/**
 * TASK-704: Backup Scheduler
 *
 * Manages backup plan scheduling, execution triggers, and retention
 * policy enforcement. Supports cron-like scheduling for full,
 * incremental, and differential backups.
 */

import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';
import { OrionError, ErrorCode } from '../../errors';
import { BackupPlanRepository, BackupPlanEntity } from '../../repositories/BackupPlanRepository';
import {
  BackupPlan,
  BackupRecord,
  BackupStatus,
  BackupType,
  BackupSourceType,
  RetentionPolicy,
  BackupSchedule,
} from './types';

const logger = pino({ name: 'LBackup-LScheduler' });

/**
 * Parse a cron expression and calculate the next run time.
 * Supports basic 5-field cron: minute hour dayOfMonth month dayOfWeek
 * This is a simplified parser for common patterns.
 */
export function getNextCronTime(cronExpression: string, fromDate: Date = new Date()): Date {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new OrionError(`Invalid cron expression: ${cronExpression}. Expected 5 fields.`, ErrorCode.NOT_FOUND);
  }

  const [minuteStr, hourStr, dayOfMonthStr, monthStr, dayOfWeekStr] = parts;

  const next = new Date(fromDate.getTime());
  next.setSeconds(0);
  next.setMilliseconds(0);
  // Start checking from the next minute
  next.setMinutes(next.getMinutes() + 1);

  const maxIterations = 525960; // ~1 year of minutes
  let iterations = 0;

  while (iterations < maxIterations) {
    const month = next.getMonth() + 1; // 1-12
    const dayOfMonth = next.getDate();
    const dayOfWeek = next.getDay(); // 0-6 (Sun-Sat)
    const hour = next.getHours();
    const minute = next.getMinutes();

    if (
      matchesField(minute, minuteStr) &&
      matchesField(hour, hourStr) &&
      matchesField(dayOfMonth, dayOfMonthStr) &&
      matchesField(month, monthStr) &&
      matchesField(dayOfWeek, dayOfWeekStr)
    ) {
      return next;
    }

    next.setMinutes(next.getMinutes() + 1);
    iterations++;
  }

  throw new OrionError(`Could not find next cron time for: ${cronExpression}`, ErrorCode.NOT_FOUND);
}

/**
 * Check if a value matches a cron field
 */
function matchesField(value: number, field: string): boolean {
  // Wildcard
  if (field === '*') return true;

  // List: 1,3,5
  if (field.includes(',')) {
    return field.split(',').some(f => matchesField(value, f.trim()));
  }

  // Range: 1-5
  if (field.includes('-')) {
    const [start, end] = field.split('-').map(Number);
    return value >= start && value <= end;
  }

  // Step: */5 or 1-10/2
  if (field.includes('/')) {
    const [range, step] = field.split('/');
    const stepVal = parseInt(step);
    if (range === '*') {
      return value % stepVal === 0;
    }
    const [start, end] = range.split('-').map(Number);
    return value >= start && value <= end && (value - start) % stepVal === 0;
  }

  // Single value
  return value === parseInt(field);
}

/**
 * Backup Scheduler - Manages backup plans and scheduling
 */
export class BackupScheduler extends EventEmitter {
  /** Registered backup plans - migrated to repository */
  private plans: Map<string, BackupPlan> = new Map(); // in-memory cache
  private planRepository?: BackupPlanRepository;

  /** Next scheduled execution times */
  private nextExecutions: Map<string, Date> = new Map();

  /** Schedule timer */
  private scheduleTimer?: NodeJS.Timeout;

  /** Whether the scheduler is running */
  private isRunning: boolean = false;

  /** Check interval */
  private checkIntervalMs: number = 60000; // 1 minute default

  /** Callback to execute a backup */
  public onExecuteBackup?: (plan: BackupPlan) => Promise<BackupRecord>;

  constructor(checkIntervalMsOrOptions?: number | { checkIntervalMs?: number; db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> } }) {
    super();
    if (typeof checkIntervalMsOrOptions === 'number') {
      this.checkIntervalMs = checkIntervalMsOrOptions;
    } else if (checkIntervalMsOrOptions) {
      if (checkIntervalMsOrOptions.checkIntervalMs) {
        this.checkIntervalMs = checkIntervalMsOrOptions.checkIntervalMs;
      }
      if (checkIntervalMsOrOptions.db) {
        this.planRepository = new BackupPlanRepository(checkIntervalMsOrOptions.db);
      }
    }
  }

  // ==================== Plan Management ====================

  /**
   * Create a new backup plan
   */
  async createPlan(plan: Omit<BackupPlan, 'createdAt' | 'updatedAt'>): Promise<BackupPlan> {
    const now = new Date();
    const fullPlan: BackupPlan = {
      ...plan,
      createdAt: now,
      updatedAt: now,
    };

    this.plans.set(fullPlan.id, fullPlan);

    // Persist to repository
    if (this.planRepository) {
      try {
        await this.planRepository.create({
          id: fullPlan.id,
          name: fullPlan.name,
          description: fullPlan.description || null,
          sourceType: fullPlan.sources?.[0] || 'unknown',
          backupType: fullPlan.type,
          enabled: fullPlan.enabled,
          schedule: fullPlan.schedule as any,
          retention: fullPlan.retention as any,
          storageConfig: {},
        });
      } catch (err) {
        logger.warn(`[BackupScheduler] Failed to persist plan to repository:`, err);
      }
    }

    // Calculate next execution time
    if (fullPlan.enabled) {
      try {
        const nextTime = getNextCronTime(fullPlan.schedule.cronExpression);
        this.nextExecutions.set(fullPlan.id, nextTime);
      } catch (error) {
        logger.warn(`[BackupScheduler] Invalid cron expression for plan ${fullPlan.id}:`, error);
      }
    }

    this.emit('plan:created', fullPlan);
    return fullPlan;
  }

  /**
   * Get a backup plan by ID
   */
  getPlan(planId: string): BackupPlan | null {
    return this.plans.get(planId) || null;
  }

  /**
   * Get all backup plans
   */
  getAllPlans(): BackupPlan[] {
    return Array.from(this.plans.values());
  }

  /**
   * Get enabled backup plans
   */
  getEnabledPlans(): BackupPlan[] {
    return this.getAllPlans().filter(p => p.enabled);
  }

  /**
   * Update a backup plan
   */
  async updatePlan(planId: string, updates: Partial<BackupPlan>): Promise<BackupPlan | null> {
    const plan = this.plans.get(planId);
    if (!plan) return null;

    const updated = {
      ...plan,
      ...updates,
      updatedAt: new Date(),
    };

    this.plans.set(planId, updated);

    // Persist to repository
    if (this.planRepository) {
      try {
        const entity = await this.planRepository.findById(planId);
        if (entity) {
          await this.planRepository.update(entity.id, {
            name: updated.name,
            description: updated.description || null,
            sourceType: updated.sources?.[0] || 'unknown',
            backupType: updated.type,
            enabled: updated.enabled,
            schedule: updated.schedule as any,
            retention: updated.retention as any,
          });
        }
      } catch (err) {
        logger.warn(`[BackupScheduler] Failed to persist plan update to repository:`, err);
      }
    }

    // Recalculate next execution if schedule changed or enabled status changed
    if (updates.schedule || updates.enabled !== undefined) {
      if (updated.enabled) {
        try {
          const nextTime = getNextCronTime(updated.schedule.cronExpression);
          this.nextExecutions.set(planId, nextTime);
        } catch (error) {
          logger.warn(`[BackupScheduler] Invalid cron expression for plan ${planId}:`, error);
        }
      } else {
        this.nextExecutions.delete(planId);
      }
    }

    this.emit('plan:updated', updated);
    return updated;
  }

  /**
   * Delete a backup plan
   */
  async deletePlan(planId: string): Promise<boolean> {
    const deleted = this.plans.delete(planId);
    this.nextExecutions.delete(planId);

    // Persist to repository
    if (deleted && this.planRepository) {
      try {
        const entity = await this.planRepository.findById(planId);
        if (entity) {
          await this.planRepository.delete(entity.id);
        }
      } catch (err) {
        logger.warn(`[BackupScheduler] Failed to delete plan from repository:`, err);
      }
    }

    if (deleted) {
      this.emit('plan:deleted', planId);
    }
    return deleted;
  }

  /**
   * Toggle a plan's enabled status
   */
  async togglePlan(planId: string, enabled: boolean): Promise<BackupPlan | null> {
    // Persist toggle to repository
    if (this.planRepository) {
      try {
        await this.planRepository.toggleEnabled(planId, enabled);
      } catch (err) {
        logger.warn(`[BackupScheduler] Failed to toggle plan in repository:`, err);
      }
    }
    return this.updatePlan(planId, { enabled });
  }

  // ==================== Scheduling ====================

  /**
   * Start the schedule checker
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.runScheduleCheck();
    logger.info('[BackupScheduler] Started');
    this.emit('started');
  }

  /**
   * Stop the schedule checker
   */
  stop(): void {
    this.isRunning = false;
    if (this.scheduleTimer) {
      clearTimeout(this.scheduleTimer);
      this.scheduleTimer = undefined;
    }
    logger.info('[BackupScheduler] Stopped');
    this.emit('stopped');
  }

  /**
   * Check if the scheduler is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Run the schedule check loop
   */
  private runScheduleCheck(): void {
    if (!this.isRunning) return;

    try {
      this.checkSchedules();
    } catch (error) {
      logger.error('[BackupScheduler] Schedule check error:', error);
    }

    this.scheduleTimer = setTimeout(
      () => this.runScheduleCheck(),
      this.checkIntervalMs
    );
  }

  /**
   * Check all enabled plans for due executions
   */
  private async checkSchedules(): Promise<void> {
    const now = new Date();

    for (const [planId, nextTime] of this.nextExecutions.entries()) {
      if (now >= nextTime) {
        const plan = this.plans.get(planId);
        if (plan && plan.enabled) {
          await this.triggerBackup(planId);
        }
      }
    }
  }

  /**
   * Trigger a backup for a plan (manual or scheduled)
   */
  async triggerBackup(planId: string): Promise<BackupRecord | null> {
    const plan = this.plans.get(planId);
    if (!plan) {
      logger.warn(`[BackupScheduler] Plan ${planId} not found`);
      return null;
    }

    if (!plan.enabled) {
      logger.warn(`[BackupScheduler] Plan ${planId} is disabled`);
      return null;
    }

    if (!this.onExecuteBackup) {
      logger.warn('[BackupScheduler] No backup executor configured');
      return null;
    }

    try {
      this.emit('backup:triggered', planId);

      const record = await this.onExecuteBackup(plan);

      // Calculate next execution time
      try {
        const nextTime = getNextCronTime(plan.schedule.cronExpression, new Date());
        this.nextExecutions.set(planId, nextTime);
      } catch (error) {
        logger.warn(`[BackupScheduler] Failed to calculate next time for plan ${planId}:`, error);
      }

      this.emit('backup:completed', record);
      return record;
    } catch (error) {
      logger.error(`[BackupScheduler] Backup execution failed for plan ${planId}:`, error);
      this.emit('backup:failed', { planId, error });

      // Still calculate next execution even on failure
      try {
        const nextTime = getNextCronTime(plan.schedule.cronExpression, new Date());
        this.nextExecutions.set(planId, nextTime);
      } catch {
        // Ignore
      }

      return null;
    }
  }

  // ==================== Next Backup Time ====================

  /**
   * Get the next backup time for a plan
   */
  getNextBackupTime(planId: string): Date | null {
    return this.nextExecutions.get(planId) || null;
  }

  /**
   * Get all next backup times
   */
  getAllNextBackupTimes(): Map<string, Date> {
    return new Map(this.nextExecutions);
  }

  // ==================== Retention Policy ====================

  /**
   * Enforce retention policy for a plan
   * Returns the list of backup IDs that should be deleted
   */
  enforceRetention(
    plan: BackupPlan,
    backups: BackupRecord[]
  ): string[] {
    const planBackups = backups
      .filter(b => b.planId === plan.id && b.status !== 'deleted')
      .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime());

    const toDelete: string[] = [];
    const { maxBackups, maxAgeMs, minBackups } = plan.retention;

    if (maxBackups !== undefined && planBackups.length > maxBackups) {
      // Keep minBackups, delete the rest
      const keepCount = Math.max(minBackups || 0, 0);
      const excessCount = planBackups.length - maxBackups;

      for (let i = 0; i < excessCount && (planBackups.length - i - 1) >= keepCount; i++) {
        const idx = planBackups.length - 1 - i;
        if (idx >= 0) {
          toDelete.push(planBackups[idx].id);
        }
      }
    }

    if (maxAgeMs !== undefined) {
      const cutoffTime = new Date(Date.now() - maxAgeMs);
      for (const backup of planBackups) {
        if (
          backup.completedAt &&
          backup.completedAt < cutoffTime &&
          !toDelete.includes(backup.id)
        ) {
          // Only delete if we have more than minBackups
          const remaining = planBackups.filter(
            b => !toDelete.includes(b.id) && b.id !== backup.id
          );
          if (remaining.length > (minBackups || 1)) {
            toDelete.push(backup.id);
          }
        }
      }
    }

    if (toDelete.length > 0) {
      this.emit('retention:enforced', { planId: plan.id, deletedIds: toDelete });
    }

    return toDelete;
  }

  /**
   * Get schedule information for a plan
   */
  getScheduleInfo(planId: string): {
    planId: string;
    planName: string;
    schedule: BackupSchedule;
    nextRun: Date | null;
    enabled: boolean;
  } | null {
    const plan = this.plans.get(planId);
    if (!plan) return null;

    return {
      planId: plan.id,
      planName: plan.name,
      schedule: plan.schedule,
      nextRun: this.nextExecutions.get(planId) || null,
      enabled: plan.enabled,
    };
  }

  /**
   * Get all schedule information
   */
  getAllScheduleInfo(): Array<{
    planId: string;
    planName: string;
    schedule: BackupSchedule;
    nextRun: Date | null;
    enabled: boolean;
  }> {
    return this.getAllPlans().map(plan => ({
      planId: plan.id,
      planName: plan.name,
      schedule: plan.schedule,
      nextRun: this.nextExecutions.get(plan.id) || null,
      enabled: plan.enabled,
    }));
  }
}
