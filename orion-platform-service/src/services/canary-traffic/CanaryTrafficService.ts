/**
 * CanaryTrafficService - Canary deployment and traffic management
 *
 * Provides operations for managing canary deployments, traffic splitting,
 * promotion, and rollback.
 */

import pino from 'pino';
import {
  TrafficConfigRepository,
  TrafficConfigEntity,
  TrafficHistoryRepository,
  TrafficHistoryEntity,
} from '../../repositories/TrafficManagerRepository';
import { DatabasePool } from '../database';
import { OrionError, ErrorCode } from '../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ==================== Input Interfaces ====================

export interface CreateCanaryInput {
  tenant_id: string;
  deployment_id: string;
  service_name: string;
  canary_version: string;
  baseline_version: string;
  initial_percent?: number;
  max_percent?: number;
}

export interface TrafficRules {
  canary_id: string;
  strategy: string;
  baseline_weight?: number;
  canary_weight?: number;
  baseline_destination?: string;
  canary_destination?: string;
  host?: string;
  namespace?: string;
}

export interface TrafficSplitConfig {
  percent: number;
  baseline?: string;
  canary?: string;
}

// In-memory storage for canary deployments (when DB not available)
const canaryDeployments = new Map<string, any>();

// ==================== CanaryTrafficService ====================

export class CanaryTrafficService {
  private configRepo: TrafficConfigRepository | null = null;
  private historyRepo: TrafficHistoryRepository | null = null;

  constructor(db?: DatabasePool) {
    if (db) {
      this.configRepo = new TrafficConfigRepository(db);
      this.historyRepo = new TrafficHistoryRepository(db);
    }
  }

  /**
   * Set repositories after construction (for lazy initialization)
   */
  setRepositories(configRepo: TrafficConfigRepository, historyRepo: TrafficHistoryRepository): void {
    this.configRepo = configRepo;
    this.historyRepo = historyRepo;
  }

  // ==================== Traffic Rules Operations ====================

  /**
   * Set traffic rules for a canary deployment
   */
  async setTrafficRules(rules: TrafficRules): Promise<TrafficConfigEntity> {
    if (!this.configRepo) {
      const mockId = this.generateId();
      const config: TrafficConfigEntity = {
        id: mockId,
        canary_id: rules.canary_id,
        strategy: rules.strategy || 'weighted',
        host: rules.host || null,
        namespace: rules.namespace || 'default',
        upstream_name: null,
        phase: 'initial',
        baseline_weight: rules.baseline_weight ?? 90,
        canary_weight: rules.canary_weight ?? 10,
        baseline_destination: rules.baseline_destination || null,
        baseline_subset: null,
        canary_destination: rules.canary_destination || null,
        canary_subset: null,
        servers: [],
        created_at: new Date(),
        updated_at: new Date(),
      };

      canaryDeployments.set(rules.canary_id, config);
      return config;
    }

    const existing = await this.configRepo.findByCanaryId(rules.canary_id);
    if (existing) {
      return this.configRepo.update(rules.canary_id, {
        strategy: rules.strategy,
        baseline_weight: rules.baseline_weight,
        canary_weight: rules.canary_weight,
        baseline_destination: rules.baseline_destination,
        canary_destination: rules.canary_destination,
        host: rules.host,
        namespace: rules.namespace,
      } as any);
    }

    const config = await this.configRepo.upsertConfig({
      id: this.generateId(),
      canary_id: rules.canary_id,
      strategy: rules.strategy || 'weighted',
      host: rules.host,
      namespace: rules.namespace,
      baseline_weight: rules.baseline_weight,
      canary_weight: rules.canary_weight,
      baseline_destination: rules.baseline_destination,
      canary_destination: rules.canary_destination,
    });

    logger.info({ canaryId: rules.canary_id, strategy: rules.strategy }, '[CanaryTraffic] Traffic rules set');
    return config;
  }

  /**
   * Get traffic config by canary ID
   */
  async getTrafficConfig(id: string): Promise<TrafficConfigEntity | null> {
    if (!this.configRepo) {
      return canaryDeployments.get(id) || null;
    }

    const result = await this.configRepo.findByCanaryId(id);
    return result !== undefined ? result : null;
  }

  /**
   * Get traffic config by canary ID (alias)
   */
  async getTrafficConfigByCanaryId(canaryId: string): Promise<TrafficConfigEntity | null> {
    return this.getTrafficConfig(canaryId);
  }

  /**
   * Update traffic for a canary deployment
   */
  async updateTraffic(id: string, rules: Partial<TrafficRules>): Promise<TrafficConfigEntity | null> {
    const current = await this.getTrafficConfig(id);
    if (!current) {
      return null;
    }

    return this.setTrafficRules({
      canary_id: id,
      strategy: rules.strategy ?? current.strategy,
      baseline_weight: rules.baseline_weight ?? current.baseline_weight ?? 0,
      canary_weight: rules.canary_weight ?? current.canary_weight ?? 0,
      baseline_destination: rules.baseline_destination ?? current.baseline_destination ?? undefined,
      canary_destination: rules.canary_destination ?? current.canary_destination ?? undefined,
      host: rules.host ?? current.host ?? undefined,
      namespace: rules.namespace ?? current.namespace ?? undefined,
    });
  }

  /**
   * Delete traffic config
   */
  async deleteTraffic(id: string): Promise<boolean> {
    if (!this.configRepo) {
      canaryDeployments.delete(id);
      return true;
    }

    const deleted = await this.configRepo.delete(id);
    if (deleted) {
      logger.info({ canaryId: id }, '[CanaryTraffic] Traffic config deleted');
    }
    return deleted;
  }

  // ==================== Canary Deployment CRUD ====================

  /**
   * Create a canary deployment
   */
  async createCanaryDeployment(tenantId: string, input: CreateCanaryInput): Promise<any> {
    const deploymentId = input.deployment_id || this.generateId();
    const canaryId = `canary-${deploymentId}`;

    // Store in memory or update config
    await this.setTrafficRules({
      canary_id: canaryId,
      strategy: 'weighted',
      baseline_weight: 100 - (input.initial_percent ?? 10),
      canary_weight: input.initial_percent ?? 10,
    });

    const deployment = {
      id: canaryId,
      tenantId,
      deploymentId,
      serviceName: input.service_name,
      canaryVersion: input.canary_version,
      baselineVersion: input.baseline_version,
      initialPercent: input.initial_percent ?? 10,
      maxPercent: input.max_percent ?? 100,
      currentPercent: input.initial_percent ?? 10,
      status: 'deploying',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    canaryDeployments.set(canaryId, { ...canaryDeployments.get(canaryId), deployment });
    logger.info({ canaryId, serviceName: input.service_name }, '[CanaryTraffic] Canary deployment created');

    return deployment;
  }

  /**
   * List canary deployments
   */
  async listCanaryDeployments(tenantId: string, status?: string): Promise<any[]> {
    if (!this.configRepo) {
      const deployments = Array.from(canaryDeployments.values())
        .filter((d: any) => d.deployment && d.deployment.tenantId === tenantId)
        .map((d: any) => d.deployment);

      if (status) {
        return deployments.filter((d: any) => d.status === status);
      }
      return deployments;
    }

    const result = await this.configRepo.findAll();
    // Filter by tenant - would need tenant_id in config in real implementation
    return result.entities.map(c => ({
      id: c.canary_id,
      strategy: c.strategy,
      baselineWeight: c.baseline_weight,
      canaryWeight: c.canary_weight,
      status: c.phase,
    }));
  }

  /**
   * Get canary deployment by ID
   */
  async getCanaryDeployment(canaryId: string): Promise<any | null> {
    if (!this.configRepo) {
      const stored = canaryDeployments.get(canaryId);
      return stored?.deployment || null;
    }

    const config = await this.configRepo.findByCanaryId(canaryId);
    if (!config) {
      return null;
    }

    return {
      id: config.canary_id,
      strategy: config.strategy,
      baselineWeight: config.baseline_weight,
      canaryWeight: config.canary_weight,
      status: config.phase,
      createdAt: config.created_at,
    };
  }

  /**
   * Promote canary to production
   */
  async promoteCanary(canaryId: string): Promise<any> {
    const deployment = await this.getCanaryDeployment(canaryId);
    if (!deployment) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Canary deployment ${canaryId} not found`);
    }

    // Update traffic to 100% canary
    await this.updateTraffic(canaryId, {
      canary_id: canaryId,
      strategy: 'weighted',
      canary_weight: 100,
      baseline_weight: 0,
    });

    const promoted = {
      ...deployment,
      status: 'promoted',
      promotedAt: new Date(),
      updatedAt: new Date(),
    };

    canaryDeployments.set(canaryId, { ...canaryDeployments.get(canaryId), deployment: promoted });
    logger.info({ canaryId }, '[CanaryTraffic] Canary promoted to production');

    return promoted;
  }

  /**
   * Rollback canary deployment
   */
  async rollbackCanary(canaryId: string): Promise<any> {
    const deployment = await this.getCanaryDeployment(canaryId);
    if (!deployment) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Canary deployment ${canaryId} not found`);
    }

    // Update traffic to 100% baseline
    await this.updateTraffic(canaryId, {
      canary_id: canaryId,
      strategy: 'weighted',
      canary_weight: 0,
      baseline_weight: 100,
    });

    const rolledback = {
      ...deployment,
      status: 'rolled_back',
      rolledBackAt: new Date(),
      updatedAt: new Date(),
    };

    canaryDeployments.set(canaryId, { ...canaryDeployments.get(canaryId), deployment: rolledback });
    logger.info({ canaryId }, '[CanaryTraffic] Canary rolled back');

    return rolledback;
  }

  // ==================== History ====================

  /**
   * Get traffic history
   */
  async getTrafficHistory(canaryId: string): Promise<TrafficHistoryEntity[]> {
    if (!this.historyRepo) {
      return [];
    }

    return this.historyRepo.findByCanaryId(canaryId);
  }

  // ==================== Utility Methods ====================

  private generateId(): string {
    return `canary-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

export default CanaryTrafficService;