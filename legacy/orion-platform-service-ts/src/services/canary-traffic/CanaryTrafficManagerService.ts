import { CanaryTrafficRepository, type CanaryConfigEntity, type CanaryAnalysisEntity } from '../../repositories/CanaryTrafficRepository';
import { OrionError, ErrorCode } from '../../errors';
/**
 * Canary Traffic Manager Service - Phase 3
 *
 * Manage canary release traffic distribution
 */

export interface CanaryConfig {
  id: string;
  tenant_id: string;
  deployment_id: string;
  initial_percent: number;
  max_percent: number;
  increment_percent: number;
  increment_interval_minutes: number;
  analysis_window_minutes: number;
  success_threshold: number;
  rollback_threshold: number;
  status: 'running' | 'completed' | 'rollback' | 'paused';
  current_percent: number;
  created_at: Date;
}

export interface CanaryAnalysis {
  id: string;
  canary_id: string;
  window_start: Date;
  window_end: Date;
  stable_success_rate: number;
  canary_success_rate: number;
  stable_error_rate: number;
  canary_error_rate: number;
  recommendation: 'continue' | 'pause' | 'rollback' | 'promote';
  created_at: Date;
}

export class CanaryTrafficManagerService {

  constructor(private repo: CanaryTrafficRepository) {}

  async createCanary(input: { tenant_id: string; deployment_id: string; initial_percent?: number }): Promise<CanaryConfig> {
    const entity: CanaryConfigEntity = {
      id: `canary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tenantId: input.tenant_id,
      deploymentId: input.deployment_id,
      initialPercent: input.initial_percent || 5,
      maxPercent: 100,
      incrementPercent: 10,
      incrementIntervalMinutes: 10,
      analysisWindowMinutes: 5,
      successThreshold: 0.99,
      rollbackThreshold: 0.95,
      status: 'running',
      currentPercent: input.initial_percent || 5,
      createdAt: new Date(),
    };

    const result = await this.repo.insertConfig(entity);
    return this.mapEntityToConfig(result);
  }

  async getCanary(tenantId: string, canaryId: string): Promise<CanaryConfig | null> {
    const result = await this.repo.findConfigById(canaryId, tenantId);
    return result ? this.mapEntityToConfig(result) : null;
  }

  async analyzeCanary(
    tenantId: string,
    canaryId: string,
    _options?: { stableSuccessRate?: number; canarySuccessRate?: number }
  ): Promise<CanaryAnalysis> {
    const canary = await this.getCanary(tenantId, canaryId);
    if (!canary) throw new OrionError('Canary not found', ErrorCode.NOT_FOUND);

    const stableSuccessRate = _options?.stableSuccessRate ?? 0.99;
    const canarySuccessRate = _options?.canarySuccessRate ?? 0.98;

    let recommendation: 'continue' | 'pause' | 'rollback' | 'promote';
    if (canarySuccessRate >= canary.success_threshold) {
      recommendation = canary.current_percent >= canary.max_percent ? 'promote' : 'continue';
    } else if (canarySuccessRate < canary.rollback_threshold) {
      recommendation = 'rollback';
    } else {
      recommendation = 'pause';
    }

    const analysis = await this.repo.insertAnalysis({
      id: `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      canaryId,
      windowStart: new Date(Date.now() - 5 * 60 * 1000),
      windowEnd: new Date(),
      stableSuccessRate,
      canarySuccessRate,
      stableErrorRate: 0.01,
      canaryErrorRate: 0.02,
      recommendation,
      createdAt: new Date(),
    });

    return this.mapEntityToAnalysis(analysis);
  }

  async incrementTraffic(tenantId: string, canaryId: string): Promise<CanaryConfig> {
    const canary = await this.getCanary(tenantId, canaryId);
    if (!canary) throw new OrionError('Canary not found', ErrorCode.NOT_FOUND);

    const newPercent = Math.min(canary.current_percent + canary.increment_percent, canary.max_percent);

    const result = await this.repo.updateCurrentPercent(canaryId, tenantId, newPercent);
    if (!result) throw new OrionError('Canary not found', ErrorCode.NOT_FOUND);
    return this.mapEntityToConfig(result);
  }

  async rollbackCanary(tenantId: string, canaryId: string): Promise<CanaryConfig> {
    const result = await this.repo.updateConfigStatus(canaryId, tenantId, 'rollback', 0);
    if (!result) throw new OrionError('Canary not found', ErrorCode.NOT_FOUND);
    return this.mapEntityToConfig(result);
  }

  async promoteCanary(tenantId: string, canaryId: string): Promise<CanaryConfig> {
    const result = await this.repo.updateConfigStatus(canaryId, tenantId, 'completed', 100);
    if (!result) throw new OrionError('Canary not found', ErrorCode.NOT_FOUND);
    return this.mapEntityToConfig(result);
  }

  // ==================== Private Helpers ====================

  private mapEntityToConfig(entity: CanaryConfigEntity): CanaryConfig {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      deployment_id: entity.deploymentId,
      initial_percent: entity.initialPercent,
      max_percent: entity.maxPercent,
      increment_percent: entity.incrementPercent,
      increment_interval_minutes: entity.incrementIntervalMinutes,
      analysis_window_minutes: entity.analysisWindowMinutes,
      success_threshold: entity.successThreshold,
      rollback_threshold: entity.rollbackThreshold,
      status: entity.status,
      current_percent: entity.currentPercent,
      created_at: entity.createdAt,
    };
  }

  private mapEntityToAnalysis(entity: CanaryAnalysisEntity): CanaryAnalysis {
    return {
      id: entity.id,
      canary_id: entity.canaryId,
      window_start: entity.windowStart,
      window_end: entity.windowEnd,
      stable_success_rate: entity.stableSuccessRate,
      canary_success_rate: entity.canarySuccessRate,
      stable_error_rate: entity.stableErrorRate,
      canary_error_rate: entity.canaryErrorRate,
      recommendation: entity.recommendation,
      created_at: entity.createdAt,
    };
  }
}
