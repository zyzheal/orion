/**
 * Smart Deploy Service
 *
 * Main orchestration service for intelligent deployments.
 * Integrates risk assessment, strategy selection, workflow execution,
 * and event publishing.
 *
 * TASK-701: Smart Deployment (智能部署)
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Deployment,
  DeployConfig,
  DeploymentStatus,
  DeploymentStrategyType,
  RollbackInfo,
  HistoryQuery,
  HistoryQueryResponse,
  DeploymentMetrics,
  AuditTrailEntry,
  IEventPublisher,
  DeployEvents,
} from './types';
import { DeploymentWorkflow } from './DeploymentWorkflow';
import { DeploymentHistoryService } from './DeploymentHistoryService';
import { RollbackService } from './RollbackService';
import { DeploymentVerifier } from './DeploymentVerifier';
import { RollbackEntity } from '../repositories/RollbackRepository';

/**
 * Convert RollbackEntity to RollbackInfo domain type
 */
function toRollbackInfo(entity: RollbackEntity): RollbackInfo {
  return {
    id: entity.id,
    deploymentId: entity.deploymentId,
    reason: entity.reason ?? 'unknown',
    triggeredBy: entity.triggeredBy ?? 'system',
    status: entity.status as RollbackInfo['status'],
    targetVersion: entity.targetVersion ?? undefined,
    startedAt: entity.startedAt,
    completedAt: entity.completedAt ?? undefined,
    error: entity.errorMessage ?? undefined,
  };
}

/**
 * Risk assessment interface (from TASK-401 Risk Assessment)
 */
interface RiskAssessmentResult {
  riskScore: number;
  riskLevel: string;
  recommendations: Array<{ type: string; message: string }>;
}

/**
 * Smart deployment service - main entry point
 */
export class SmartDeployService {
  private workflow: DeploymentWorkflow;
  private historyService: DeploymentHistoryService;
  private rollbackService: RollbackService;
  private verifier: DeploymentVerifier;
  private eventPublisher?: IEventPublisher;
  private riskAssessmentFn?: (
    appName: string,
    version: string,
    environment: string
  ) => Promise<RiskAssessmentResult>;

  constructor(options?: {
    eventPublisher?: IEventPublisher;
    workflow?: DeploymentWorkflow;
    historyService?: DeploymentHistoryService;
    rollbackService?: RollbackService;
    verifier?: DeploymentVerifier;
    riskAssessmentFn?: (
      appName: string,
      version: string,
      environment: string
    ) => Promise<RiskAssessmentResult>;
    db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };
  }) {
    this.eventPublisher = options?.eventPublisher;
    this.historyService =
      options?.historyService || (options?.db ? new DeploymentHistoryService(options.db) : new DeploymentHistoryService({ query: async () => ({ rows: [], rowCount: 0 }) }));
    this.rollbackService =
      options?.rollbackService ||
      new RollbackService({ eventPublisher: options?.eventPublisher, db: options?.db ?? { query: async () => ({ rows: [], rowCount: 0 }) } });
    this.verifier = options?.verifier || new DeploymentVerifier();
    this.riskAssessmentFn = options?.riskAssessmentFn;

    this.workflow =
      options?.workflow ||
      new DeploymentWorkflow({
        eventPublisher: options?.eventPublisher,
        historyService: this.historyService,
        rollbackService: this.rollbackService,
        verifier: this.verifier,
        db: options?.db,
      });
  }

  /**
   * Deploy an application with intelligent strategy selection
   */
  async deploy(config: DeployConfig): Promise<Deployment> {
    // Enrich config with risk assessment
    const enrichedConfig = await this.enrichWithRiskAssessment(config);

    // Select optimal strategy based on risk
    const strategy = this.selectStrategy(enrichedConfig);
    enrichedConfig.strategy = strategy;

    // Execute deployment workflow
    const deployment = await this.workflow.startDeployment(enrichedConfig);

    return deployment;
  }

  /**
   * Get deployment status
   */
  async getStatus(deploymentId: string): Promise<Deployment | null> {
    return this.historyService.getDeployment(deploymentId);
  }

  /**
   * Get deployment history
   */
  async getHistory(query: HistoryQuery = {}): Promise<HistoryQueryResponse> {
    return this.historyService.getHistory(query);
  }

  /**
   * Get deployment metrics
   */
  async getMetrics(filters?: {
    appName?: string;
    environment?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<DeploymentMetrics> {
    return this.historyService.getMetrics(filters);
  }

  /**
   * Get audit trail for a deployment
   */
  async getAuditTrail(deploymentId: string): Promise<AuditTrailEntry[]> {
    return this.historyService.getAuditTrail(deploymentId);
  }

  /**
   * Trigger a rollback
   */
  async rollback(
    deploymentId: string,
    reason: string,
    triggeredBy: string,
    targetVersion?: string
  ): Promise<{ deployment: Deployment; rollback: RollbackInfo }> {
    const deployment = await this.historyService.getDeployment(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment '${deploymentId}' not found`);
    }

    // Trigger rollback
    const rollbackInfo = await this.rollbackService.triggerRollback(
      deployment,
      reason,
      triggeredBy,
      targetVersion
    );

    // Execute rollback
    const result = await this.rollbackService.executeRollback(
      deployment,
      rollbackInfo
    );

    // Update deployment in history
    await this.historyService.updateDeployment(deploymentId, {
      status: result.deployment.status,
      rollbackInfo: result.deployment.rollbackInfo,
      error: result.deployment.error,
      completedAt: result.deployment.completedAt,
      updatedAt: result.deployment.updatedAt,
    });

    // Publish rollback event
    if (result.rollback.status === 'completed') {
      await this.publishEvent(DeployEvents.DEPLOYMENT_ROLLED_BACK, {
        deploymentId,
        rollbackId: rollbackInfo.id,
        reason,
        triggeredBy,
        targetVersion: targetVersion || result.rollback.targetVersion,
      });
    }

    return { deployment: result.deployment, rollback: toRollbackInfo(result.rollback) };
  }

  /**
   * Get rollback history for a deployment
   */
  async getRollbackHistory(deploymentId: string): Promise<RollbackInfo[]> {
    const entities = await this.rollbackService.getRollbackHistory(deploymentId);
    return entities.map(toRollbackInfo);
  }

  /**
   * Cancel a pending or in-progress deployment
   */
  async cancelDeployment(
    deploymentId: string,
    cancelledBy: string
  ): Promise<Deployment> {
    const deployment = await this.historyService.getDeployment(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment '${deploymentId}' not found`);
    }

    const cancellableStatuses: DeploymentStatus[] = [
      'pending',
      'preparing',
      'deploying',
    ];

    if (!cancellableStatuses.includes(deployment.status)) {
      throw new Error(
        `Cannot cancel deployment in '${deployment.status}' state`
      );
    }

    deployment.status = 'cancelled';
    deployment.completedAt = new Date();
    deployment.updatedAt = new Date();

    await this.historyService.updateDeployment(deploymentId, {
      status: deployment.status,
      completedAt: deployment.completedAt,
      updatedAt: deployment.updatedAt,
    });

    await this.publishEvent(DeployEvents.DEPLOYMENT_CANCELLED, {
      deploymentId,
      cancelledBy,
      previousStatus: deployment.status,
    });

    return deployment;
  }

  /**
   * Get deployment by app name
   */
  async getByAppName(appName: string): Promise<Deployment[]> {
    return this.historyService.getByAppName(appName);
  }

  /**
   * Get latest deployment for an app in an environment
   */
  async getLatestDeployment(
    appName: string,
    environment: string
  ): Promise<Deployment | null> {
    return this.historyService.getLatestDeployment(appName, environment);
  }

  /**
   * Verify a deployment
   */
  async verifyDeployment(deploymentId: string) {
    return this.workflow.verifyDeployment(deploymentId);
  }

  // ==================== Private Methods ====================

  /**
   * Enrich deployment config with risk assessment
   */
  private async enrichWithRiskAssessment(
    config: DeployConfig
  ): Promise<DeployConfig> {
    if (!this.riskAssessmentFn) {
      return config;
    }

    try {
      const riskResult = await this.riskAssessmentFn(
        config.appName,
        config.version,
        config.environment
      );

      config.riskAssessmentId = uuidv4();

      return config;
    } catch (error) {
      console.warn(
        `[SmartDeployService] Risk assessment failed, proceeding without it:`,
        error
      );
      return config;
    }
  }

  /**
   * Select optimal deployment strategy based on risk assessment and config
   *
   * Strategy selection logic:
   - High risk (critical/production) -> Blue-Green (safe, instant rollback)
   - Medium risk -> Canary (gradual exposure)
   - Low risk / dev environment -> Rolling (efficient)
   - Development/Testing -> Recreate (simple, fast)
   */
  private selectStrategy(config: DeployConfig): DeploymentStrategyType {
    // If strategy is explicitly specified, use it
    if (config.strategy) {
      return config.strategy;
    }

    // Select based on environment
    const env = config.environment.toLowerCase();

    if (env === 'prod' || env === 'production') {
      // Production: prefer blue-green for safety
      return 'blue-green';
    }

    if (env === 'staging' || env === 'pre-prod') {
      // Staging: canary to validate before production
      return 'canary';
    }

    if (env === 'dev' || env === 'development') {
      // Dev: recreate for speed
      return 'recreate';
    }

    // Default: rolling for balance of safety and efficiency
    return 'rolling';
  }

  /**
   * Publish event
   */
  private async publishEvent(type: string, data: any): Promise<void> {
    if (this.eventPublisher) {
      try {
        await this.eventPublisher.publish(type, data, {
          source: 'orion-smart-deploy',
        });
      } catch (error) {
        console.warn(
          `[SmartDeployService] Failed to publish event ${type}:`,
          error
        );
      }
    }
  }
}
