/**
 * ReleaseTrainService - Release Train management service
 *
 * Provides operations for managing release trains (scheduled releases)
 * including creation, scheduling, execution, and cancellation.
 */

import { createLogger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import {
  ReleaseTrainRepository,
  ReleaseTrainEntity,
} from '../../repositories/ProductLineRepository';
import { DatabasePool } from '../database';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ==================== Input Interfaces ====================

export interface CreateReleaseInput {
  productLineId: string;
  name: string;
  schedule: string;
  targetBranch?: string;
  sourceBranch?: string;
  autoPromote?: boolean;
  approvalRequired?: boolean;
  approvers?: string[];
  preChecks?: any[];
  postActions?: any[];
}

export interface ScheduleReleaseInput {
  releaseId: string;
  scheduledTime?: Date;
}

export interface ReleaseFilter {
  productLineId?: string;
  state?: string;
  limit?: number;
}

// ==================== In-Memory Fallback ====================

const inMemoryReleases = new Map<string, ReleaseTrainEntity>();

// ==================== ReleaseTrainService ====================

export class ReleaseTrainService {
  private repository: ReleaseTrainRepository | null = null;
  private useDatabase: boolean = false;

  constructor(db?: DatabasePool) {
    if (db) {
      this.repository = new ReleaseTrainRepository(db);
      this.useDatabase = true;
    }
  }

  /**
   * Set repository after construction (for lazy initialization)
   */
  setRepository(repository: ReleaseTrainRepository): void {
    this.repository = repository;
    this.useDatabase = true;
  }

  // ==================== CRUD Operations ====================

  /**
   * Create a new release train
   */
  async createRelease(input: CreateReleaseInput): Promise<ReleaseTrainEntity> {
    const id = uuidv4();
    const now = new Date();

    if (!this.useDatabase || !this.repository) {
      // Fallback to in-memory storage
      const release: ReleaseTrainEntity = {
        id,
        productLineId: input.productLineId,
        name: input.name,
        schedule: input.schedule,
        targetBranch: input.targetBranch ?? 'production',
        sourceBranch: input.sourceBranch ?? 'main',
        autoPromote: input.autoPromote ?? false,
        approvalRequired: input.approvalRequired ?? true,
        approvers: input.approvers ?? [],
        preChecks: input.preChecks ?? [],
        postActions: input.postActions ?? [],
        lastRun: null,
        nextRun: null,
        state: 'Idle',
        lastRelease: null,
        createdAt: now,
        updatedAt: now,
      };

      inMemoryReleases.set(id, release);
      logger.info({ releaseId: id, productLineId: input.productLineId },
        '[ReleaseTrain] Release train created');
      return release;
    }

    const release = await this.repository.create({
      productLineId: input.productLineId,
      name: input.name,
      schedule: input.schedule,
      targetBranch: input.targetBranch ?? 'production',
      sourceBranch: input.sourceBranch ?? 'main',
      autoPromote: input.autoPromote ?? false,
      approvalRequired: input.approvalRequired ?? true,
      approvers: input.approvers ?? [],
      preChecks: input.preChecks ?? [],
      postActions: input.postActions ?? [],
      lastRun: null,
      nextRun: null,
      state: 'Idle',
      lastRelease: null,
      createdAt: now,
      updatedAt: now,
    });

    logger.info({ releaseId: release.id, productLineId: input.productLineId },
      '[ReleaseTrain] Release train created');
    return release;
  }

  /**
   * Get release train by ID
   */
  async getRelease(id: string): Promise<ReleaseTrainEntity | null> {
    if (!this.useDatabase || !this.repository) {
      return inMemoryReleases.get(id) || null;
    }

    const result = await this.repository.findById(id);
    return result ?? null;
  }

  /**
   * List release trains with filters
   */
  async listReleases(filter: ReleaseFilter = {}): Promise<ReleaseTrainEntity[]> {
    if (!this.useDatabase || !this.repository) {
      let results = Array.from(inMemoryReleases.values());

      if (filter.productLineId) {
        results = results.filter(r => r.productLineId === filter.productLineId);
      }
      if (filter.state) {
        results = results.filter(r => r.state === filter.state);
      }

      // Sort by creation date descending
      results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      if (filter.limit) {
        results = results.slice(0, filter.limit);
      }

      return results;
    }

    // Database implementation
    if (filter.productLineId) {
      return this.repository.findByProductLine(filter.productLineId);
    }

    if (filter.state) {
      return this.repository.findByState(filter.state);
    }

    // Return all if no filter
    return this.repository.findAll().then(r => r.entities);
  }

  /**
   * Get releases by product line
   */
  async getReleasesByProductLine(productLineId: string): Promise<ReleaseTrainEntity[]> {
    return this.listReleases({ productLineId });
  }

  // ==================== Scheduling Operations ====================

  /**
   * Schedule a release train
   */
  async scheduleRelease(input: ScheduleReleaseInput): Promise<ReleaseTrainEntity | null> {
    const release = await this.getRelease(input.releaseId);
    if (!release) {
      logger.warn({ releaseId: input.releaseId }, '[ReleaseTrain] Release not found for scheduling');
      return null;
    }

    // Calculate next run time
    const scheduledTime = input.scheduledTime || this.calculateNextRunTime(release.schedule);

    if (!this.useDatabase || !this.repository) {
      const updated: ReleaseTrainEntity = {
        ...release,
        state: 'Scheduled',
        nextRun: scheduledTime,
        updatedAt: new Date(),
      };
      inMemoryReleases.set(input.releaseId, updated);
      logger.info({ releaseId: input.releaseId, nextRun: scheduledTime },
        '[ReleaseTrain] Release scheduled');
      return updated;
    }

    const updated = await this.repository.updateState(
      input.releaseId,
      'Scheduled',
      release.lastRun ?? undefined,
      scheduledTime
    );

    if (updated) {
      logger.info({ releaseId: input.releaseId, nextRun: scheduledTime },
        '[ReleaseTrain] Release scheduled');
    }
    return updated;
  }

  /**
   * Cancel a scheduled release
   */
  async cancelRelease(releaseId: string): Promise<ReleaseTrainEntity | null> {
    const release = await this.getRelease(releaseId);
    if (!release) {
      logger.warn({ releaseId }, '[ReleaseTrain] Release not found for cancellation');
      return null;
    }

    // Can only cancel Scheduled or Idle releases
    if (release.state !== 'Scheduled' && release.state !== 'Idle') {
      logger.warn({ releaseId, currentState: release.state },
        '[ReleaseTrain] Cannot cancel release in current state');
      return release;
    }

    if (!this.useDatabase || !this.repository) {
      const updated: ReleaseTrainEntity = {
        ...release,
        state: 'Cancelled',
        nextRun: null,
        updatedAt: new Date(),
      };
      inMemoryReleases.set(releaseId, updated);
      logger.info({ releaseId }, '[ReleaseTrain] Release cancelled');
      return updated;
    }

    const updated = await this.repository.updateState(
      releaseId,
      'Cancelled',
      undefined,
      undefined
    );

    if (updated) {
      logger.info({ releaseId }, '[ReleaseTrain] Release cancelled');
    }
    return updated;
  }

  /**
   * Start a release (trigger execution)
   */
  async startRelease(releaseId: string): Promise<ReleaseTrainEntity | null> {
    const release = await this.getRelease(releaseId);
    if (!release) {
      logger.warn({ releaseId }, '[ReleaseTrain] Release not found');
      return null;
    }

    // Can only start Scheduled or Idle releases
    if (release.state !== 'Scheduled' && release.state !== 'Idle') {
      logger.warn({ releaseId, currentState: release.state },
        '[ReleaseTrain] Cannot start release in current state');
      return release;
    }

    const now = new Date();
    const nextRun = this.calculateNextRunTime(release.schedule);

    if (!this.useDatabase || !this.repository) {
      const updated: ReleaseTrainEntity = {
        ...release,
        state: 'Running',
        lastRun: now,
        nextRun,
        updatedAt: now,
      };
      inMemoryReleases.set(releaseId, updated);
      logger.info({ releaseId, lastRun: now, nextRun }, '[ReleaseTrain] Release started');
      return updated;
    }

    const updated = await this.repository.updateState(
      releaseId,
      'Running',
      now,
      nextRun
    );

    if (updated) {
      logger.info({ releaseId, lastRun: now, nextRun }, '[ReleaseTrain] Release started');
    }
    return updated;
  }

  /**
   * Complete a release
   */
  async completeRelease(releaseId: string, releaseVersion?: string): Promise<ReleaseTrainEntity | null> {
    const release = await this.getRelease(releaseId);
    if (!release) {
      logger.warn({ releaseId }, '[ReleaseTrain] Release not found');
      return null;
    }

    if (release.state !== 'Running') {
      logger.warn({ releaseId, currentState: release.state },
        '[ReleaseTrain] Cannot complete release that is not running');
      return release;
    }

    if (!this.useDatabase || !this.repository) {
      const updated: ReleaseTrainEntity = {
        ...release,
        state: 'Completed',
        lastRelease: releaseVersion || this.generateReleaseVersion(),
        updatedAt: new Date(),
      };
      inMemoryReleases.set(releaseId, updated);
      logger.info({ releaseId, releaseVersion: updated.lastRelease },
        '[ReleaseTrain] Release completed');
      return updated;
    }

    const updated = await this.repository.updateState(
      releaseId,
      'Completed',
      release.lastRun ?? undefined,
      release.nextRun ?? undefined
    );

    // Update last release version
    if (updated && releaseVersion) {
      const result = await this.repository.findById(releaseId);
      if (result) {
        const finalRelease = {
          ...result,
          lastRelease: releaseVersion,
        };
        logger.info({ releaseId, releaseVersion }, '[ReleaseTrain] Release completed');
        return finalRelease;
      }
    }

    if (updated) {
      logger.info({ releaseId }, '[ReleaseTrain] Release completed');
    }
    return updated;
  }

  /**
   * Fail a release
   */
  async failRelease(releaseId: string, error?: string): Promise<ReleaseTrainEntity | null> {
    const release = await this.getRelease(releaseId);
    if (!release) {
      logger.warn({ releaseId }, '[ReleaseTrain] Release not found');
      return null;
    }

    if (release.state !== 'Running') {
      logger.warn({ releaseId, currentState: release.state },
        '[ReleaseTrain] Cannot fail release that is not running');
      return release;
    }

    if (!this.useDatabase || !this.repository) {
      const updated: ReleaseTrainEntity = {
        ...release,
        state: 'Failed',
        updatedAt: new Date(),
      };
      inMemoryReleases.set(releaseId, updated);
      logger.error({ releaseId, error }, '[ReleaseTrain] Release failed');
      return updated;
    }

    const updated = await this.repository.updateState(
      releaseId,
      'Failed',
      release.lastRun ?? undefined,
      undefined
    );

    if (updated) {
      logger.error({ releaseId, error }, '[ReleaseTrain] Release failed');
    }
    return updated;
  }

  /**
   * Get release trains that are due for execution
   */
  async getDueReleases(): Promise<ReleaseTrainEntity[]> {
    const releases = await this.listReleases({ state: 'Scheduled' });
    const now = new Date();

    return releases.filter(release => {
      if (!release.nextRun) return false;
      return release.nextRun <= now;
    });
  }

  // ==================== Utility Methods ====================

  /**
   * Calculate next run time from cron expression
   * Note: This is a simplified implementation. In production, use a proper cron parser.
   */
  private calculateNextRunTime(schedule: string): Date {
    const now = new Date();

    // Simple cron-like schedule parsing
    // Format: "0 * * * *" (minute hour day month weekday)
    const parts = schedule.split(' ');
    if (parts.length !== 5) {
      // Default to 1 hour from now if invalid
      return new Date(now.getTime() + 60 * 60 * 1000);
    }

    const [minute] = parts;

    // If minute is *, run immediately next hour
    if (minute === '*') {
      const next = new Date(now);
      next.setMinutes(0, 0, 0);
      next.setHours(next.getHours() + 1);
      return next;
    }

    // Parse specific minute
    const minuteNum = parseInt(minute, 10);
    if (!isNaN(minuteNum)) {
      const next = new Date(now);
      next.setMinutes(minuteNum, 0, 0);
      if (next <= now) {
        next.setHours(next.getHours() + 1);
      }
      return next;
    }

    // Default: 1 hour from now
    return new Date(now.getTime() + 60 * 60 * 1000);
  }

  /**
   * Generate a release version string
   */
  private generateReleaseVersion(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
    return `v${year}.${month}.${day}.${time}`;
  }
}

export default ReleaseTrainService;