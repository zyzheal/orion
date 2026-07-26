/**
 * DeployWindowService — manages deployment windows (maintenance/blackout periods),
 * deploy-time checks, emergency deployment requests, and calendar view.
 *
 * Uses in-memory Map storage consistent with other deploy-svc services.
 */

import crypto from 'crypto';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WindowConfig {
  id: string;
  tenantId: string;
  name: string;
  type: 'maintenance' | 'blackout';
  schedule: string; // cron expression (5-field: min hour dom month dow)
  durationMinutes: number;
  environments: string[];
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWindowInput {
  tenantId: string;
  name: string;
  type: 'maintenance' | 'blackout';
  schedule: string;
  durationMinutes: number;
  environments: string[];
  description?: string;
}

export interface DeployCheck {
  allowed: boolean;
  reason?: 'blackout' | 'no-window' | 'emergency-only';
  nextWindow?: { name: string; startsAt: Date; endsAt: Date };
  emergencyAvailable: boolean;
}

export interface EmergencyRequest {
  id: string;
  tenantId: string;
  deploymentId: string;
  reason: string;
  requestedBy: string;
  approvedBy?: string;
  status: 'pending' | 'approved' | 'rejected';
  auditLog: Array<{ action: string; by: string; at: Date; note?: string }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEmergencyInput {
  tenantId: string;
  deploymentId: string;
  reason: string;
  requestedBy: string;
}

export interface CalendarEvent {
  windowId: string;
  name: string;
  type: 'maintenance' | 'blackout';
  startsAt: Date;
  endsAt: Date;
  environments: string[];
  description?: string;
}

// ─── Cron helpers ────────────────────────────────────────────────────────────

/**
 * Minimal cron parser — supports 5-field expressions.
 * Returns the next occurrence after `after` as a Date.
 */
function nextCronOccurrence(cronExpr: string, after: Date): Date | null {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minute, hour, dom, month, dow] = parts;

  const candidates: Date[] = [];
  const base = new Date(after.getTime() + 60000); // start 1 min after
  // Search up to 7 days ahead
  for (let offset = 0; offset < 7 * 24 * 60; offset++) {
    const d = new Date(base.getTime() + offset * 60000);
    if (matchesCron(d, minute, hour, dom, month, dow)) {
      candidates.push(d);
      if (candidates.length >= 1) break;
    }
  }

  return candidates[0] ?? null;
}

function matchesCron(
  d: Date,
  minute: string,
  hour: string,
  dom: string,
  month: string,
  dow: string,
): boolean {
  if (!matchField(d.getMinutes(), minute)) return false;
  if (!matchField(d.getHours(), hour)) return false;
  if (!matchField(d.getDate(), dom)) return false;
  if (!matchField(d.getMonth() + 1, month)) return false;
  // JS: 0=Sun, cron: 0=Sun, 7=Sun
  const jsDow = d.getDay();
  if (!matchField(jsDow, dow)) return false;
  return true;
}

function matchField(value: number, expr: string): boolean {
  if (expr === '*') return true;
  // Support comma-separated values
  const parts = expr.split(',');
  for (const part of parts) {
    if (part.includes('/')) {
      const [baseRaw, stepRaw] = part.split('/');
      const step = parseInt(stepRaw, 10);
      const base = baseRaw === '*' ? 0 : parseInt(baseRaw, 10);
      if (step > 0 && value >= base && (value - base) % step === 0) return true;
    } else if (part.includes('-')) {
      const [s, e] = part.split('-').map(Number);
      if (value >= s && value <= e) return true;
    } else {
      if (value === parseInt(part, 10)) return true;
    }
  }
  return false;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class DeployWindowService {
  private windows = new Map<string, WindowConfig>();
  private emergencies = new Map<string, EmergencyRequest>();

  // ─── Window CRUD ─────────────────────────────────────────────────────────

  async createWindow(input: CreateWindowInput): Promise<WindowConfig> {
    const id = `win-${crypto.randomUUID()}`;
    const now = new Date();
    const window: WindowConfig = {
      id,
      tenantId: input.tenantId,
      name: input.name,
      type: input.type,
      schedule: input.schedule,
      durationMinutes: input.durationMinutes,
      environments: input.environments,
      description: input.description,
      createdAt: now,
      updatedAt: now,
    };
    this.windows.set(id, window);
    return window;
  }

  async listWindows(tenantId: string, type?: 'maintenance' | 'blackout'): Promise<WindowConfig[]> {
    const results: WindowConfig[] = [];
    for (const w of this.windows.values()) {
      if (w.tenantId !== tenantId) continue;
      if (type && w.type !== type) continue;
      results.push(w);
    }
    return results;
  }

  async getWindow(id: string): Promise<WindowConfig | null> {
    return this.windows.get(id) ?? null;
  }

  async updateWindow(id: string, updates: Partial<Omit<WindowConfig, 'id' | 'createdAt'>>): Promise<WindowConfig | null> {
    const existing = this.windows.get(id);
    if (!existing) return null;
    const updated: WindowConfig = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.windows.set(id, updated);
    return updated;
  }

  async deleteWindow(id: string): Promise<boolean> {
    return this.windows.delete(id);
  }

  // ─── Deploy Check ────────────────────────────────────────────────────────

  /**
   * Check whether a deployment is allowed for the given tenant + environment
   * at the current time.
   */
  async checkDeployAllowed(tenantId: string, environment: string): Promise<DeployCheck> {
    const now = new Date();
    const tenantWindows = await this.listWindows(tenantId);

    // Check for active blackout
    for (const w of tenantWindows) {
      if (w.type !== 'blackout') continue;
      if (!w.environments.includes('*') && !w.environments.includes(environment)) continue;

      const nextOccurrence = nextCronOccurrence(w.schedule, new Date(now.getTime() - w.durationMinutes * 60000));
      if (!nextOccurrence) continue;

      const windowEnd = new Date(nextOccurrence.getTime() + w.durationMinutes * 60000);
      if (now >= nextOccurrence && now <= windowEnd) {
        // Currently in blackout — check if emergency is available
        const hasApprovedEmergency = this.hasApprovedEmergency(tenantId, environment);
        return {
          allowed: hasApprovedEmergency,
          reason: hasApprovedEmergency ? undefined : 'blackout',
          emergencyAvailable: hasApprovedEmergency,
        };
      }
    }

    // Check for active maintenance window
    for (const w of tenantWindows) {
      if (w.type !== 'maintenance') continue;
      if (!w.environments.includes('*') && !w.environments.includes(environment)) continue;

      const nextOccurrence = nextCronOccurrence(w.schedule, new Date(now.getTime() - w.durationMinutes * 60000));
      if (!nextOccurrence) continue;

      const windowEnd = new Date(nextOccurrence.getTime() + w.durationMinutes * 60000);
      if (now >= nextOccurrence && now <= windowEnd) {
        return {
          allowed: true,
          emergencyAvailable: this.hasApprovedEmergency(tenantId, environment),
        };
      }
    }

    // No active window — find next maintenance window
    let nextWindow: { name: string; startsAt: Date; endsAt: Date } | undefined;
    for (const w of tenantWindows) {
      if (w.type !== 'maintenance') continue;
      if (!w.environments.includes('*') && !w.environments.includes(environment)) continue;

      const nextOcc = nextCronOccurrence(w.schedule, now);
      if (!nextOcc) continue;

      const end = new Date(nextOcc.getTime() + w.durationMinutes * 60000);
      if (!nextWindow || nextOcc < nextWindow.startsAt) {
        nextWindow = { name: w.name, startsAt: nextOcc, endsAt: end };
      }
    }

    // If there are blackout windows, deployment is emergency-only outside windows
    const hasBlackout = tenantWindows.some((w) => w.type === 'blackout' && (w.environments.includes('*') || w.environments.includes(environment)));

    return {
      allowed: !hasBlackout,
      reason: hasBlackout ? 'emergency-only' : undefined,
      nextWindow,
      emergencyAvailable: false,
    };
  }

  // ─── Calendar ────────────────────────────────────────────────────────────

  /**
   * Return calendar events between `start` and `end` for the given tenant.
   */
  async getCalendar(tenantId: string, start: Date, end: Date): Promise<CalendarEvent[]> {
    const tenantWindows = await this.listWindows(tenantId);
    const events: CalendarEvent[] = [];

    for (const w of tenantWindows) {
      let occ = nextCronOccurrence(w.schedule, new Date(start.getTime() - w.durationMinutes * 60000));
      while (occ && occ <= end) {
        const windowEnd = new Date(occ.getTime() + w.durationMinutes * 60000);
        if (windowEnd >= start) {
          events.push({
            windowId: w.id,
            name: w.name,
            type: w.type,
            startsAt: occ,
            endsAt: windowEnd,
            environments: w.environments,
            description: w.description,
          });
        }
        // Next occurrence (search from 1 min after current)
        occ = nextCronOccurrence(w.schedule, new Date(occ.getTime() + 60000));
        // Safety: stop if we go past end by more than a day
        if (occ && occ.getTime() > end.getTime() + 86400000) break;
      }
    }

    return events.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  // ─── Emergency ───────────────────────────────────────────────────────────

  async requestEmergency(input: CreateEmergencyInput): Promise<EmergencyRequest> {
    const id = `emerg-${crypto.randomUUID()}`;
    const now = new Date();
    const emergency: EmergencyRequest = {
      id,
      tenantId: input.tenantId,
      deploymentId: input.deploymentId,
      reason: input.reason,
      requestedBy: input.requestedBy,
      status: 'pending',
      auditLog: [{ action: 'created', by: input.requestedBy, at: now }],
      createdAt: now,
      updatedAt: now,
    };
    this.emergencies.set(id, emergency);
    return emergency;
  }

  async listEmergencies(tenantId: string, status?: 'pending' | 'approved' | 'rejected'): Promise<EmergencyRequest[]> {
    const results: EmergencyRequest[] = [];
    for (const e of this.emergencies.values()) {
      if (e.tenantId !== tenantId) continue;
      if (status && e.status !== status) continue;
      results.push(e);
    }
    return results;
  }

  async getEmergency(id: string): Promise<EmergencyRequest | null> {
    return this.emergencies.get(id) ?? null;
  }

  async approveEmergency(id: string, approvedBy: string, note?: string): Promise<EmergencyRequest | null> {
    const existing = this.emergencies.get(id);
    if (!existing) return null;
    if (existing.status !== 'pending') return null;

    const now = new Date();
    const updated: EmergencyRequest = {
      ...existing,
      status: 'approved',
      approvedBy,
      auditLog: [...existing.auditLog, { action: 'approved', by: approvedBy, at: now, note }],
      updatedAt: now,
    };
    this.emergencies.set(id, updated);
    return updated;
  }

  async rejectEmergency(id: string, rejectedBy: string, note?: string): Promise<EmergencyRequest | null> {
    const existing = this.emergencies.get(id);
    if (!existing) return null;
    if (existing.status !== 'pending') return null;

    const now = new Date();
    const updated: EmergencyRequest = {
      ...existing,
      status: 'rejected',
      auditLog: [...existing.auditLog, { action: 'rejected', by: rejectedBy, at: now, note }],
      updatedAt: now,
    };
    this.emergencies.set(id, updated);
    return updated;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private hasApprovedEmergency(tenantId: string, environment: string): boolean {
    for (const e of this.emergencies.values()) {
      if (e.tenantId !== tenantId) continue;
      if (e.status !== 'approved') continue;
      // Emergency is global per tenant — if approved, allows deploy to any env
      return true;
    }
    return false;
  }

  // ─── Cleanup helpers ─────────────────────────────────────────────────────

  async cleanupCompletedEmergencies(maxAgeMs: number = 3600000): Promise<number> {
    const cutoff = Date.now() - maxAgeMs;
    let cleaned = 0;
    for (const [id, e] of this.emergencies.entries()) {
      if (e.status !== 'pending' && e.updatedAt.getTime() < cutoff) {
        this.emergencies.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }
}
