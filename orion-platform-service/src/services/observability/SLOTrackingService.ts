import { createLogger } from '../../utils/logger';
import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { SLODefinitionRepository, SLODefinitionEntity } from '../../repositories/SLODefinitionRepository';
import { SLIMeasurementRepository, SLIMeasurementEntity } from '../../repositories/SLIMeasurementRepository';
import { ErrorBudgetRepository, ErrorBudgetEntity } from '../../repositories/ErrorBudgetRepository';
import { OrionError, ErrorCode } from '../../errors';

const logger = createLogger('SLOTrackingService');

export interface CreateSLOInput {
  name: string;
  description?: string;
  sloType: string;
  targetValue: number;
  targetUnit: string;
  promqlQuery: string;
  windowDays?: number;
  alertThreshold?: number;
  enabled?: boolean;
}

export interface UpdateSLOInput {
  name?: string;
  description?: string;
  sloType?: string;
  targetValue?: number;
  targetUnit?: string;
  promqlQuery?: string;
  windowDays?: number;
  alertThreshold?: number;
  enabled?: boolean;
}

export interface ErrorBudgetResult {
  totalBudget: number;
  consumed: number;
  remaining: number;
  burnRate: number;
  isExhausted: boolean;
}

export interface SLODashboardItem {
  slo: SLODefinitionEntity;
  currentSLI: number | null;
  errorBudget: ErrorBudgetResult | null;
  isHealthy: boolean;
}

/**
 * SLOTrackingService - Manages SLO definitions, SLI measurements, and error budgets
 */
export class SLOTrackingService {
  constructor(
    private readonly sloRepo: SLODefinitionRepository,
    private readonly sliRepo: SLIMeasurementRepository,
    private readonly budgetRepo: ErrorBudgetRepository,
  ) {}

  // ==================== SLO Definition CRUD ====================

  async createSLO(input: CreateSLOInput): Promise<SLODefinitionEntity> {
    const tenantId = getCurrentTenantId();
    logger.info({ tenantId, name: input.name, sloType: input.sloType }, 'Creating SLO definition');

    const slo = await this.sloRepo.create({
      tenantId,
      name: input.name,
      description: input.description ?? null,
      sloType: input.sloType,
      targetValue: input.targetValue,
      targetUnit: input.targetUnit,
      promqlQuery: input.promqlQuery,
      windowDays: input.windowDays ?? 30,
      alertThreshold: input.alertThreshold ?? 80,
      enabled: input.enabled ?? true,
    });

    logger.info({ sloId: slo.id }, 'SLO definition created');
    return slo;
  }

  async getSLO(sloId: string): Promise<SLODefinitionEntity> {
    const slo = await this.sloRepo.findById(sloId);
    if (!slo) {
      throw new OrionError(`SLO definition not found: ${sloId}`, 'NOT_FOUND');
    }
    return slo;
  }

  async listSLOs(options?: { sloType?: string; enabled?: boolean }): Promise<SLODefinitionEntity[]> {
    const tenantId = getCurrentTenantId();
    if (options?.sloType) {
      return this.sloRepo.findByType(tenantId, options.sloType);
    }
    if (options?.enabled) {
      return this.sloRepo.findEnabled(tenantId);
    }
    const result = await this.sloRepo.findByTenant(tenantId);
    return result.entities;
  }

  async updateSLO(sloId: string, input: UpdateSLOInput): Promise<SLODefinitionEntity> {
    const existing = await this.sloRepo.findById(sloId);
    if (!existing) {
      throw new OrionError(`SLO definition not found: ${sloId}`, 'NOT_FOUND');
    }

    const updated = await this.sloRepo.update(sloId, input);
    if (!updated) throw new OrionError('Failed to update SLO', ErrorCode.OPERATION_FAILED);
    logger.info({ sloId }, 'SLO definition updated');
    return updated;
  }

  async deleteSLO(sloId: string): Promise<void> {
    const existing = await this.sloRepo.findById(sloId);
    if (!existing) {
      throw new OrionError(`SLO definition not found: ${sloId}`, 'NOT_FOUND');
    }

    // Delete related SLI measurements and error budgets first
    await this.sliRepo.deleteBySloId(sloId);
    await this.sloRepo.delete(sloId);
    logger.info({ sloId }, 'SLO definition deleted');
  }

  // ==================== SLI Measurement ====================

  async recordSLI(sloId: string, sliValue: number): Promise<SLIMeasurementEntity> {
    const tenantId = getCurrentTenantId();
    const slo = await this.sloRepo.findById(sloId);
    if (!slo) {
      throw new OrionError(`SLO definition not found: ${sloId}`, 'NOT_FOUND');
    }

    const measurement = await this.sliRepo.create({
      tenantId,
      sloId,
      sliValue,
    });

    logger.debug({ sloId, sliValue }, 'SLI measurement recorded');
    return measurement;
  }

  async getSLIHistory(sloId: string, limit: number = 100): Promise<SLIMeasurementEntity[]> {
    return this.sliRepo.findBySloId(sloId, limit);
  }

  async getCurrentSLI(sloId: string): Promise<number | null> {
    const latest = await this.sliRepo.findLatestBySloId(sloId);
    return latest?.sliValue ?? null;
  }

  // ==================== Error Budget ====================

  async calculateErrorBudget(sloId: string): Promise<ErrorBudgetResult> {
    const slo = await this.sloRepo.findById(sloId);
    if (!slo) {
      throw new OrionError(`SLO definition not found: ${sloId}`, 'NOT_FOUND');
    }

    const sliValues = await this.sliRepo.findBySloId(sloId, 1000);

    if (slo.windowDays <= 0 || sliValues.length === 0) {
      return { totalBudget: 0, consumed: 0, remaining: 0, burnRate: 0, isExhausted: false };
    }

    const totalMinutes = slo.windowDays * 24 * 60;
    const errorPercentage = (100 - slo.targetValue) / 100;
    const totalBudget = totalMinutes * errorPercentage;

    // consumed = SLI below target time
    const consumed = sliValues
      .filter((v) => v.sliValue < slo.targetValue / 100)
      .length * (totalMinutes / sliValues.length);

    const remaining = totalBudget - consumed;
    const burnRate = consumed / totalMinutes;

    const result: ErrorBudgetResult = {
      totalBudget,
      consumed,
      remaining: Math.max(0, remaining),
      burnRate,
      isExhausted: remaining <= 0,
    };

    // Persist calculation
    await this.budgetRepo.create({
      tenantId: slo.tenantId,
      sloId,
      totalBudget: result.totalBudget,
      consumed: result.consumed,
      remaining: result.remaining,
      burnRate: result.burnRate,
      isExhausted: result.isExhausted,
    });

    return result;
  }

  async getLatestErrorBudget(sloId: string): Promise<ErrorBudgetEntity | undefined> {
    return this.budgetRepo.findBySloId(sloId);
  }

  async getErrorBudgetHistory(sloId: string, limit: number = 30): Promise<ErrorBudgetEntity[]> {
    return this.budgetRepo.findHistoryBySloId(sloId, limit);
  }

  // ==================== Dashboard ====================

  async getDashboard(): Promise<SLODashboardItem[]> {
    const tenantId = getCurrentTenantId();
    const slos = await this.sloRepo.findEnabled(tenantId);
    const items: SLODashboardItem[] = [];

    for (const slo of slos) {
      const currentSLI = await this.getCurrentSLI(slo.id);
      const errorBudget = await this.getLatestErrorBudget(slo.id);
      const isHealthy = currentSLI !== null ? currentSLI >= slo.targetValue / 100 : true;

      items.push({
        slo,
        currentSLI,
        errorBudget: errorBudget
          ? {
              totalBudget: errorBudget.totalBudget,
              consumed: errorBudget.consumed,
              remaining: errorBudget.remaining,
              burnRate: errorBudget.burnRate ?? 0,
              isExhausted: errorBudget.isExhausted,
            }
          : null,
        isHealthy,
      });
    }

    return items;
  }
}
