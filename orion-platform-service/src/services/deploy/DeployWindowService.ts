/**
 * DeployWindowService - Business logic for Deploy Window management
 *
 * Handles CRUD operations and time-window checking for deployment windows.
 * Uses parser-cron to evaluate cron expressions against current time.
 */

import {
  DeployWindowRepository,
  DeployWindow,
  CreateDeployWindowInput,
  UpdateDeployWindowInput,
} from './DeployWindowRepository';

export interface ListDeployWindowsOptions {
  page?: number;
  limit?: number;
  tenantId?: string;
  environmentId?: string;
  status?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class DeployWindowServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'DeployWindowServiceError';
  }
}

export class DeployWindowService {
  private repository: DeployWindowRepository;

  constructor(repository: DeployWindowRepository) {
    this.repository = repository;
  }

  // ==================== Deploy Window CRUD ====================

  /**
   * Get deploy window by ID
   */
  async getWindow(id: string): Promise<DeployWindow> {
    const window = await this.repository.findById(id);
    if (!window) {
      throw new DeployWindowServiceError(`Deploy window not found: ${id}`, 'WINDOW_NOT_FOUND');
    }
    return window;
  }

  /**
   * List deploy windows with pagination
   */
  async listWindows(options: ListDeployWindowsOptions = {}): Promise<PaginatedResult<DeployWindow>> {
    const { page = 1, limit = 20, tenantId, environmentId, status } = options;
    const offset = (page - 1) * limit;

    const [windows, total] = await Promise.all([
      this.repository.findAll({ tenantId, environmentId, status, limit, offset }),
      this.repository.count({ tenantId, environmentId, status }),
    ]);

    return {
      data: windows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create a new deploy window
   */
  async createWindow(input: CreateDeployWindowInput): Promise<DeployWindow> {
    if (!input.cron_expression) {
      throw new DeployWindowServiceError('cron_expression is required', 'VALIDATION_ERROR');
    }
    if (!input.name) {
      throw new DeployWindowServiceError('name is required', 'VALIDATION_ERROR');
    }
    if (!input.created_by) {
      throw new DeployWindowServiceError('created_by is required', 'VALIDATION_ERROR');
    }

    return this.repository.create(input);
  }

  /**
   * Update a deploy window
   */
  async updateWindow(id: string, input: UpdateDeployWindowInput): Promise<DeployWindow> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new DeployWindowServiceError(`Deploy window not found: ${id}`, 'WINDOW_NOT_FOUND');
    }

    const updated = await this.repository.update(id, input);
    if (!updated) {
      throw new DeployWindowServiceError(`Failed to update deploy window: ${id}`, 'UPDATE_ERROR');
    }
    return updated;
  }

  /**
   * Delete a deploy window (soft delete)
   */
  async deleteWindow(id: string): Promise<DeployWindow> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new DeployWindowServiceError(`Deploy window not found: ${id}`, 'WINDOW_NOT_FOUND');
    }

    const deleted = await this.repository.softDelete(id);
    if (!deleted) {
      throw new DeployWindowServiceError(`Failed to delete deploy window: ${id}`, 'DELETE_ERROR');
    }
    return deleted;
  }

  // ==================== Window Time Checking ====================

  /**
   * Check if current time is within an active deployment window
   *
   * Evaluates the cron expression for each active window and checks if
   * the current time (or provided date) falls within the window's duration.
   */
  async checkWindowActive(
    tenantId: string,
    environmentId: string,
    date?: Date
  ): Promise<{
    isActive: boolean;
    matchedWindows: DeployWindow[];
    nextWindow: DeployWindow | null;
    message: string;
  }> {
    const checkDate = date || new Date();
    const activeWindows = await this.repository.getActiveWindows(tenantId, environmentId);

    if (activeWindows.length === 0) {
      return {
        isActive: true, // No windows configured means deployments are always allowed
        matchedWindows: [],
        nextWindow: null,
        message: 'No deploy windows configured. Deployments are always allowed.',
      };
    }

    const matchedWindows: DeployWindow[] = [];

    for (const window of activeWindows) {
      const isWithinWindow = this.isDateInWindow(checkDate, window);
      if (isWithinWindow) {
        matchedWindows.push(window);
      }
    }

    // Get upcoming windows
    const nextWindows = await this.getNextWindows(tenantId, environmentId, 5);
    const nextWindow = nextWindows.length > 0 ? nextWindows[0] : null;

    if (matchedWindows.length > 0) {
      return {
        isActive: true,
        matchedWindows,
        nextWindow,
        message: `Currently within ${matchedWindows.length} active deploy window(s): ${matchedWindows.map(w => w.name).join(', ')}`,
      };
    }

    return {
      isActive: false,
      matchedWindows: [],
      nextWindow,
      message: nextWindow
        ? `Not within a deploy window. Next window: ${nextWindow.name}`
        : 'Not within a deploy window. No upcoming windows found.',
    };
  }

  /**
   * Get upcoming deploy windows
   *
   * Returns active windows sorted by when they will next trigger.
   * Since cron evaluation is complex, we return the active windows
   * ordered by creation time (most recent first).
   */
  async getNextWindows(
    tenantId: string,
    environmentId: string,
    limit: number = 10
  ): Promise<DeployWindow[]> {
    const windows = await this.repository.findAll({
      tenantId,
      environmentId,
      status: 'active',
      limit,
    });
    return windows;
  }

  // ==================== Internal Helpers ====================

  /**
   * Check if a given date falls within a deploy window's active period
   *
   * Uses a simplified cron matching approach:
   * - Parse cron expression (minute hour day-of-month month day-of-week)
   * - Check if current date matches the cron schedule
   * - Check if current time is within the window's duration from the trigger time
   */
  private isDateInWindow(date: Date, window: DeployWindow): boolean {
    try {
      const cronParts = window.cron_expression.trim().split(/\s+/);
      if (cronParts.length < 5 || cronParts.length > 6) {
        // Invalid cron, skip this window
        return false;
      }

      const minuteField = cronParts[0];
      const hourField = cronParts[1];
      const dayOfMonthField = cronParts[2];
      const monthField = cronParts[3];
      const dayOfWeekField = cronParts[4];

      // Convert date to UTC for consistent comparison
      const utcMinutes = date.getUTCMinutes();
      const utcHours = date.getUTCHours();
      const utcDayOfMonth = date.getUTCDate();
      const utcMonth = date.getUTCMonth() + 1; // JavaScript months are 0-indexed
      const utcDayOfWeek = date.getUTCDay(); // 0 = Sunday

      const matchesMinute = this.matchCronField(minuteField, utcMinutes, 0, 59);
      const matchesHour = this.matchCronField(hourField, utcHours, 0, 23);
      const matchesDayOfMonth = this.matchCronField(dayOfMonthField, utcDayOfMonth, 1, 31);
      const matchesMonth = this.matchCronField(monthField, utcMonth, 1, 12);
      const matchesDayOfWeek = this.matchCronField(dayOfWeekField, utcDayOfWeek, 0, 6);

      const isTriggerTime =
        matchesMinute && matchesHour && matchesDayOfMonth && matchesMonth && matchesDayOfWeek;

      if (isTriggerTime) {
        return true;
      }

      // Check if we are within the duration window from the last trigger
      const durationMinutes = window.duration_minutes || 60;
      const triggerTime = this.getLastTriggerTime(date, window.cron_expression);
      if (triggerTime) {
        const diffMs = date.getTime() - triggerTime.getTime();
        const diffMinutes = diffMs / (1000 * 60);
        return diffMinutes >= 0 && diffMinutes <= durationMinutes;
      }

      return false;
    } catch {
      // If cron parsing fails, consider the window inactive
      return false;
    }
  }

  /**
   * Match a cron field against a value
   */
  private matchCronField(field: string, value: number, min: number, max: number): boolean {
    // Wildcard matches everything
    if (field === '*') {
      return true;
    }

    // Handle comma-separated values
    if (field.includes(',')) {
      const values = field.split(',');
      return values.some(v => this.matchCronField(v, value, min, max));
    }

    // Handle ranges
    if (field.includes('-')) {
      const [startStr, endStr] = field.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        return value >= start && value <= end;
      }
    }

    // Handle step values
    if (field.includes('/')) {
      const [baseStr, stepStr] = field.split('/');
      const step = parseInt(stepStr, 10);
      const base = baseStr === '*' ? min : parseInt(baseStr, 10);
      if (!isNaN(step) && step > 0) {
        return value >= base && (value - base) % step === 0;
      }
    }

    // Exact match
    const numValue = parseInt(field, 10);
    if (!isNaN(numValue)) {
      return value === numValue;
    }

    return false;
  }

  /**
   * Calculate the last trigger time before a given date based on cron expression
   */
  private getLastTriggerTime(date: Date, cronExpression: string): Date | null {
    const cronParts = cronExpression.trim().split(/\s+/);
    if (cronParts.length < 5) {
      return null;
    }

    const minuteField = cronParts[0];
    const hourField = cronParts[1];

    // For simple cron expressions (exact minute/hour), calculate the trigger time
    const minute = this.extractExactValue(minuteField);
    const hour = this.extractExactValue(hourField);

    if (minute !== null && hour !== null) {
      const triggerTime = new Date(date);
      triggerTime.setUTCHours(hour, minute, 0, 0);

      // If the trigger time is in the future, go back one occurrence
      if (triggerTime.getTime() > date.getTime()) {
        // Go back to previous day's trigger
        triggerTime.setUTCDate(triggerTime.getUTCDate() - 1);
      }

      return triggerTime;
    }

    return null;
  }

  /**
   * Extract an exact numeric value from a cron field (not *, range, step, or list)
   */
  private extractExactValue(field: string): number | null {
    if (field === '*' || field.includes(',') || field.includes('-') || field.includes('/')) {
      return null;
    }
    const num = parseInt(field, 10);
    return isNaN(num) ? null : num;
  }
}
