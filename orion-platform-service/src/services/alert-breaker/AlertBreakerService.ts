import pino from 'pino';
import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { OrionError } from '../../errors';
import {
  AlertBreakerRuleRepository,
  AlertBreakerRuleEntity,
  AlertBreakerStateRepository,
  AlertBreakerStateEntity,
  BreakerConfig,
} from './AlertBreakerRepository';

const logger = pino({ name: 'AlertBreakerService' });

export interface CreateBreakerRuleInput {
  name: string;
  description?: string;
  ruleType: AlertBreakerRuleEntity['ruleType'];
  matchConditions: Record<string, unknown>;
  config: BreakerConfig;
  enabled?: boolean;
}

export interface UpdateBreakerRuleInput {
  name?: string;
  description?: string;
  ruleType?: AlertBreakerRuleEntity['ruleType'];
  matchConditions?: Record<string, unknown>;
  config?: BreakerConfig;
  enabled?: boolean;
}

export interface AlertEvaluationInput {
  fingerprint: string;
  labels: Record<string, string>;
  severity: string;
  timestamp: Date;
}

export interface AlertEvaluationResult {
  allowed: boolean;
  reason?: string;
  matchedRuleId?: string;
}

/**
 * AlertBreakerService - Evaluates alerts against breaker rules (dedup, suppress, throttle)
 */
export class AlertBreakerService {
  constructor(
    private readonly ruleRepo: AlertBreakerRuleRepository,
    private readonly stateRepo: AlertBreakerStateRepository,
  ) {}

  // ==================== Rule CRUD ====================

  async createRule(input: CreateBreakerRuleInput): Promise<AlertBreakerRuleEntity> {
    const tenantId = getCurrentTenantId();
    logger.info({ tenantId, name: input.name, ruleType: input.ruleType }, 'Creating breaker rule');

    const rule = await this.ruleRepo.create({
      tenantId,
      name: input.name,
      description: input.description ?? null,
      ruleType: input.ruleType,
      matchConditions: JSON.stringify(input.matchConditions),
      config: JSON.stringify(input.config),
      enabled: input.enabled ?? true,
      createdBy: null,
    });

    logger.info({ ruleId: rule.id }, 'Breaker rule created');
    return rule;
  }

  async getRule(id: string): Promise<AlertBreakerRuleEntity> {
    const rule = await this.ruleRepo.findById(id);
    if (!rule) {
      throw new OrionError(`Breaker rule not found: ${id}`, 'NOT_FOUND');
    }
    return rule;
  }

  async listRules(options?: { ruleType?: AlertBreakerRuleEntity['ruleType'] }): Promise<AlertBreakerRuleEntity[]> {
    const tenantId = getCurrentTenantId();
    if (options?.ruleType) {
      return this.ruleRepo.findByType(tenantId, options.ruleType);
    }
    const result = await this.ruleRepo.findByTenant(tenantId);
    return result.entities;
  }

  async updateRule(id: string, input: UpdateBreakerRuleInput): Promise<AlertBreakerRuleEntity> {
    const existing = await this.ruleRepo.findById(id);
    if (!existing) {
      throw new OrionError(`Breaker rule not found: ${id}`, 'NOT_FOUND');
    }

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.ruleType !== undefined) updateData.ruleType = input.ruleType;
    if (input.matchConditions !== undefined) updateData.matchConditions = JSON.stringify(input.matchConditions);
    if (input.config !== undefined) updateData.config = JSON.stringify(input.config);
    if (input.enabled !== undefined) updateData.enabled = input.enabled;

    const updated = await this.ruleRepo.update(id, updateData);
    logger.info({ ruleId: id }, 'Breaker rule updated');
    return updated;
  }

  async deleteRule(id: string): Promise<void> {
    const existing = await this.ruleRepo.findById(id);
    if (!existing) {
      throw new OrionError(`Breaker rule not found: ${id}`, 'NOT_FOUND');
    }
    // Clean up associated states
    const states = await this.stateRepo.findByRuleId(id);
    for (const state of states) {
      await this.stateRepo.delete(state.id);
    }
    await this.ruleRepo.delete(id);
    logger.info({ ruleId: id }, 'Breaker rule deleted');
  }

  // ==================== Alert Evaluation ====================

  /**
   * Evaluate an alert against all enabled breaker rules.
   * Returns whether the alert should be allowed through.
   */
  async evaluateAlert(alert: AlertEvaluationInput): Promise<AlertEvaluationResult> {
    const tenantId = getCurrentTenantId();
    const rules = await this.ruleRepo.findEnabled(tenantId);

    for (const rule of rules) {
      if (!this.matchesAlert(alert, rule.matchConditions)) {
        continue;
      }

      switch (rule.ruleType) {
        case 'dedup': {
          const isDup = await this.evaluateDedup(rule, alert);
          if (isDup) {
            return { allowed: false, reason: 'Duplicate alert suppressed', matchedRuleId: rule.id };
          }
          break;
        }
        case 'suppress': {
          const isSuppressed = this.evaluateSuppress(rule.config);
          if (isSuppressed) {
            await this.recordState(rule.id, alert.fingerprint, tenantId, 'open');
            return { allowed: false, reason: 'Alert suppressed by time window', matchedRuleId: rule.id };
          }
          break;
        }
        case 'throttle': {
          const isThrottled = await this.evaluateThrottle(rule, alert, tenantId);
          if (isThrottled) {
            return { allowed: false, reason: 'Alert throttled', matchedRuleId: rule.id };
          }
          break;
        }
      }
    }

    return { allowed: true };
  }

  // ==================== Breaker State ====================

  async getActiveStates(): Promise<AlertBreakerStateEntity[]> {
    const tenantId = getCurrentTenantId();
    return this.stateRepo.findActiveByTenant(tenantId);
  }

  async getStatesByRule(ruleId: string): Promise<AlertBreakerStateEntity[]> {
    return this.stateRepo.findByRuleId(ruleId);
  }

  async resetState(stateId: string): Promise<void> {
    const state = await this.stateRepo.findById(stateId);
    if (!state) {
      throw new OrionError(`Breaker state not found: ${stateId}`, 'NOT_FOUND');
    }
    await this.stateRepo.update(stateId, { state: 'closed', suppressedUntil: null, hitCount: 0 });
    logger.info({ stateId }, 'Breaker state reset');
  }

  // ==================== Private Evaluation Helpers ====================

  private matchesAlert(alert: AlertEvaluationInput, matchConditions: Record<string, unknown>): boolean {
    for (const [key, expectedValue] of Object.entries(matchConditions)) {
      const alertValue = alert.labels[key] ?? (alert as any)[key];
      if (expectedValue instanceof RegExp) {
        if (typeof alertValue !== 'string' || !expectedValue.test(alertValue)) return false;
      } else if (alertValue !== expectedValue) {
        return false;
      }
    }
    return true;
  }

  private async evaluateDedup(rule: AlertBreakerRuleEntity, alert: AlertEvaluationInput): Promise<boolean> {
    const windowMinutes = rule.config.dedupWindowMinutes ?? 5;
    const existing = await this.stateRepo.findByRuleAndFingerprint(rule.id, alert.fingerprint);

    if (existing && existing.lastHitAt) {
      const elapsed = (Date.now() - new Date(existing.lastHitAt).getTime()) / 60000;
      if (elapsed < windowMinutes) {
        // Update hit count
        await this.stateRepo.update(existing.id, {
          hitCount: existing.hitCount + 1,
          lastHitAt: new Date(),
        });
        return true;
      }
    }

    // Record this hit
    await this.recordState(rule.id, alert.fingerprint, getCurrentTenantId(), 'closed');
    return false;
  }

  private evaluateSuppress(config: BreakerConfig): boolean {
    if (!config.suppressStart || !config.suppressEnd) return false;

    const now = new Date();
    const timezone = config.suppressTimezone ?? 'UTC';

    // Get current hour:minute in the specified timezone
    const formatter = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
      hour12: false,
    });
    const currentTime = formatter.format(now);

    const start = config.suppressStart;
    const end = config.suppressEnd;

    // Handle overnight windows (e.g., 22:00 - 06:00)
    if (start <= end) {
      return currentTime >= start && currentTime <= end;
    }
    return currentTime >= start || currentTime <= end;
  }

  private async evaluateThrottle(rule: AlertBreakerRuleEntity, alert: AlertEvaluationInput, tenantId: string): Promise<boolean> {
    const maxCount = rule.config.throttleMaxCount ?? 10;
    const intervalMinutes = rule.config.throttleIntervalMinutes ?? 5;

    const existing = await this.stateRepo.findByRuleAndFingerprint(rule.id, alert.fingerprint);

    if (existing && existing.lastHitAt) {
      const elapsed = (Date.now() - new Date(existing.lastHitAt).getTime()) / 60000;
      if (elapsed < intervalMinutes && existing.hitCount >= maxCount) {
        return true;
      }
      // Reset if interval passed
      if (elapsed >= intervalMinutes) {
        await this.stateRepo.update(existing.id, { hitCount: 1, lastHitAt: new Date(), state: 'closed' });
        return false;
      }
      // Increment
      await this.stateRepo.update(existing.id, {
        hitCount: existing.hitCount + 1,
        lastHitAt: new Date(),
      });
      return false;
    }

    await this.recordState(rule.id, alert.fingerprint, tenantId, 'closed');
    return false;
  }

  private async recordState(ruleId: string, fingerprint: string, tenantId: string, state: 'open' | 'half-open' | 'closed'): Promise<void> {
    const existing = await this.stateRepo.findByRuleAndFingerprint(ruleId, fingerprint);
    if (existing) {
      await this.stateRepo.update(existing.id, {
        state,
        lastHitAt: new Date(),
        hitCount: existing.hitCount + 1,
      });
    } else {
      await this.stateRepo.create({
        tenantId,
        ruleId,
        alertFingerprint: fingerprint,
        state,
        suppressedUntil: null,
        hitCount: 1,
        lastHitAt: new Date(),
      });
    }
  }
}
