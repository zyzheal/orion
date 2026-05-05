/**
 * Deployment Window Service - Phase 1
 *
 * Manage deployment time windows and blackout periods
 */

import { DatabasePool } from '../database';

export interface DeploymentWindow {
  id: string;
  tenant_id: string;
  name: string;
  environment: string;
  start_time: string;  // HH:mm format
  end_time: string;
  days: string[];      // ['mon', 'tue', 'wed', 'thu', 'fri']
  timezone: string;
  blocking: boolean;
  created_at: Date;
}

export interface BlackoutPeriod {
  id: string;
  tenant_id: string;
  name: string;
  start_at: Date;
  end_at: Date;
  reason: string;
  created_by: string | null;
  created_at: Date;
}

export class DeploymentWindowService {
  private pool: DatabasePool;

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  async createWindow(input: { tenant_id: string; name: string; environment: string; start_time: string; end_time: string; days?: string[]; timezone?: string; blocking?: boolean }): Promise<DeploymentWindow> {
    const result = await this.pool.query(
      `INSERT INTO deployment_windows 
        (tenant_id, name, environment, start_time, end_time, days, timezone, blocking)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [input.tenant_id, input.name, input.environment, input.start_time, input.end_time, input.days || ['mon', 'tue', 'wed', 'thu', 'fri'], input.timezone || 'UTC', input.blocking ?? true]
    );
    return result.rows[0];
  }

  async listWindows(tenantId: string, environment?: string): Promise<DeploymentWindow[]> {
    let query = 'SELECT * FROM deployment_windows WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    if (environment) {
      query += ' AND environment = $2';
      params.push(environment);
    }
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async checkDeploymentAllowed(tenantId: string, environment: string, scheduledTime?: Date): Promise<{ allowed: boolean; reason?: string; nextWindow?: Date }> {
    const windows = await this.listWindows(tenantId, environment);
    const now = scheduledTime || new Date();

    for (const window of windows) {
      if (this.isWithinWindow(window, now)) {
        return { allowed: true };
      }
    }

    // Find next available window
    const nextWindow = this.findNextWindow(windows, now);
    return { allowed: false, reason: 'Outside deployment window', nextWindow };
  }

  async createBlackout(input: { tenant_id: string; name: string; start_at: Date; end_at: Date; reason: string; created_by?: string }): Promise<BlackoutPeriod> {
    const result = await this.pool.query(
      `INSERT INTO blackout_periods 
        (tenant_id, name, start_at, end_at, reason, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [input.tenant_id, input.name, input.start_at, input.end_at, input.reason, input.created_by || null]
    );
    return result.rows[0];
  }

  async checkBlackout(tenantId: string, scheduledTime?: Date): Promise<{ blocked: boolean; blackout?: BlackoutPeriod }> {
    const now = scheduledTime || new Date();
    const result = await this.pool.query(
      `SELECT * FROM blackout_periods 
       WHERE tenant_id = $1 AND start_at <= $2 AND end_at >= $2`,
      [tenantId, now]
    );
    const blackout = result.rows[0];
    return { blocked: !!blackout, blackout };
  }

  private isWithinWindow(window: DeploymentWindow, time: Date): boolean {
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const currentDay = dayNames[time.getDay()];
    if (!window.days.includes(currentDay)) return false;

    const currentTime = time.toTimeString().slice(0, 5);
    return currentTime >= window.start_time && currentTime <= window.end_time;
  }

  private findNextWindow(windows: DeploymentWindow[], fromTime: Date): Date | undefined {
    // Simplified - find next day with valid window
    const next = new Date(fromTime);
    next.setDate(next.getDate() + 1);
    return next;
  }
}