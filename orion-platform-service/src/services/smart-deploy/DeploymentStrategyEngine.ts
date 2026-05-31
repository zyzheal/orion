/**
 * Deployment Strategy Engine
 *
 * Executes different deployment strategies (Blue-Green, Canary, Rolling, Recreate)
 * with traffic management and health verification support.
 *
 * Persisted via PostgreSQL Repository pattern.
 *
 * TASK-701: Smart Deployment (智能部署)
 */

import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import { OrionError } from '../../errors';
import { DeploymentTrafficStateRepository, DeploymentTrafficStateEntity } from '../../repositories/DeploymentTrafficStateRepository';

const logger = pino({ name: 'LDeployment-LStrategy-LEngine' });
import {
  DeploymentStrategyConfig,
  DeploymentStrategyType,
  DeploymentStage,
  DeploymentStep,
  DeploymentStageStatus,
  DeploymentStepStatus,
  HealthCheckConfig,
  IEventPublisher,
  DeployEvents,
} from './types';

/**
 * Traffic state for deployment instances
 */
interface TrafficState {
  /** Active (old) instance traffic percentage */
  activePercentage: number;
  /** New instance traffic percentage */
  newPercentage: number;
  /** Whether traffic switch is complete */
  switched: boolean;
}

function entityToTrafficState(entity: DeploymentTrafficStateEntity): TrafficState {
  return {
    activePercentage: entity.activePercent,
    newPercentage: entity.newPercent,
    switched: entity.switched,
  };
}

/**
 * Deployment strategy execution engine
 */
export class DeploymentStrategyEngine {
  private eventPublisher?: IEventPublisher;
  private trafficRepo?: DeploymentTrafficStateRepository;
  private defaultTenantId: string;

  constructor(options?: {
    eventPublisher?: IEventPublisher;
    db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };
    tenantId?: string;
  }) {
    this.eventPublisher = options?.eventPublisher;
    this.defaultTenantId = options?.tenantId ?? 'default';
    if (options?.db) {
      this.trafficRepo = new DeploymentTrafficStateRepository(options.db);
    }
  }

  /**
   * Execute the deployment strategy
   */
  async executeStrategy(
    strategyType: DeploymentStrategyType,
    config: DeploymentStrategyConfig,
    appName: string,
    version: string,
    environment: string,
    healthCheckConfig?: HealthCheckConfig
  ): Promise<{ stages: DeploymentStage[]; success: boolean }> {
    switch (strategyType) {
      case 'blue-green':
        return this.executeBlueGreen(
          config,
          appName,
          version,
          environment,
          healthCheckConfig
        );
      case 'canary':
        return this.executeCanary(
          config,
          appName,
          version,
          environment,
          healthCheckConfig
        );
      case 'rolling':
        return this.executeRolling(
          config,
          appName,
          version,
          environment,
          healthCheckConfig
        );
      case 'recreate':
        return this.executeRecreate(
          config,
          appName,
          version,
          environment,
          healthCheckConfig
        );
      default:
        throw new OrionError('NOT_FOUND', `Unknown deployment strategy: ${strategyType}`)
    }
  }

  /**
   * Blue-Green Deployment Strategy
   *
   * Deploy to a new environment (green), verify health, then switch all traffic
   * from the old environment (blue) to the new one.
   */
  private async executeBlueGreen(
    config: DeploymentStrategyConfig,
    appName: string,
    version: string,
    environment: string,
    healthCheckConfig?: HealthCheckConfig
  ): Promise<{ stages: DeploymentStage[]; success: boolean }> {
    const stages: DeploymentStage[] = [];

    // Stage 1: Deploy to green environment
    const deployStage = this.createStage('deploy-green', [
      this.createStep('provision-green-environment'),
      this.createStep('deploy-new-version'),
      this.createStep('wait-for-ready'),
    ]);
    stages.push(deployStage);

    await this.executeStageSteps(deployStage);
    if (deployStage.status === 'failed') {
      return { stages, success: false };
    }

    // Stage 2: Health check on green
    const healthStage = this.createStage('health-check-green', [
      this.createStep('run-health-checks'),
      this.createStep('verify-connectivity'),
    ]);
    stages.push(healthStage);

    await this.executeStageSteps(healthStage);
    if (healthStage.status === 'failed') {
      return { stages, success: false };
    }

    // Stage 3: Switch traffic
    const switchStage = this.createStage('switch-traffic', [
      this.createStep('update-load-balancer'),
      this.createStep('verify-traffic-routing'),
    ]);
    stages.push(switchStage);

    // Update traffic state
    await this.saveTrafficState(appName, environment, {
      activePercentage: 0,
      newPercentage: 100,
      switched: true,
    }, 'blue-green');

    await this.executeStageSteps(switchStage);
    if (switchStage.status === 'failed') {
      return { stages, success: false };
    }

    // Publish traffic switched event
    await this.publishEvent(DeployEvents.TRAFFIC_SWITCHED, {
      appName,
      version,
      environment,
      strategy: 'blue-green',
      trafficPercentage: 100,
    });

    // Stage 4: Post-switch verification
    const verifyStage = this.createStage('post-switch-verification', [
      this.createStep('verify-endpoint-health'),
      this.createStep('check-error-rates'),
    ]);
    stages.push(verifyStage);

    await this.executeStageSteps(verifyStage);

    return { stages, success: verifyStage.status !== 'failed' };
  }

  /**
   * Canary Deployment Strategy
   *
   * Gradually shift traffic from old to new version in steps,
   * verifying health at each step.
   */
  private async executeCanary(
    config: DeploymentStrategyConfig,
    appName: string,
    version: string,
    environment: string,
    healthCheckConfig?: HealthCheckConfig
  ): Promise<{ stages: DeploymentStage[]; success: boolean }> {
    const stages: DeploymentStage[] = [];
    const canarySteps = config.canarySteps || [10, 50, 100];

    // Stage 1: Deploy canary instances
    const deployStage = this.createStage('deploy-canary', [
      this.createStep('deploy-canary-instances'),
      this.createStep('route-initial-traffic', `Route ${canarySteps[0]}% traffic`),
    ]);
    stages.push(deployStage);

    // Initialize traffic state
    await this.saveTrafficState(appName, environment, {
      activePercentage: 100 - canarySteps[0],
      newPercentage: canarySteps[0],
      switched: false,
    }, 'canary');

    await this.executeStageSteps(deployStage);
    if (deployStage.status === 'failed') {
      return { stages, success: false };
    }

    // Publish initial canary event
    await this.publishEvent(DeployEvents.TRAFFIC_SWITCHED, {
      appName,
      version,
      environment,
      strategy: 'canary',
      trafficPercentage: canarySteps[0],
      step: 1,
    });

    // Stage 2+: Gradual promotion
    for (let i = 1; i < canarySteps.length; i++) {
      const percentage = canarySteps[i];
      const previousPercentage = canarySteps[i - 1];

      const promotionStage = this.createStage(`canary-promotion-${i + 1}`, [
        this.createStep('verify-canary-health', `Verify health at ${previousPercentage}%`),
        this.createStep('increase-traffic', `Increase to ${percentage}%`),
        this.createStep('monitor-metrics', `Monitor at ${percentage}% traffic`),
      ]);
      stages.push(promotionStage);

      // Update traffic state
      await this.saveTrafficState(appName, environment, {
        activePercentage: 100 - percentage,
        newPercentage: percentage,
        switched: percentage === 100,
      }, 'canary');

      await this.executeStageSteps(promotionStage);
      if (promotionStage.status === 'failed') {
        return { stages, success: false };
      }

      // Publish promotion event
      await this.publishEvent(DeployEvents.CANARY_PROMOTED, {
        appName,
        version,
        environment,
        strategy: 'canary',
        trafficPercentage: percentage,
        step: i + 1,
        totalSteps: canarySteps.length,
      });
    }

    // Final verification stage
    const finalStage = this.createStage('final-verification', [
      this.createStep('full-health-check'),
      this.createStep('metric-comparison'),
    ]);
    stages.push(finalStage);

    await this.executeStageSteps(finalStage);

    return { stages, success: finalStage.status !== 'failed' };
  }

  /**
   * Rolling Deployment Strategy
   *
   * Replace instances one-by-one (or in batches), ensuring
   * service availability throughout the process.
   */
  private async executeRolling(
    config: DeploymentStrategyConfig,
    appName: string,
    version: string,
    environment: string,
    healthCheckConfig?: HealthCheckConfig
  ): Promise<{ stages: DeploymentStage[]; success: boolean }> {
    const stages: DeploymentStage[] = [];
    const maxUnavailable = config.maxUnavailable || 1;
    const replicas = 3; // Default, would come from CMDB in production

    // Stage 1: Pre-deployment check
    const preStage = this.createStage('pre-deployment-check', [
      this.createStep('validate-configuration'),
      this.createStep('check-cluster-capacity'),
      this.createStep('verify-image-availability'),
    ]);
    stages.push(preStage);

    await this.executeStageSteps(preStage);
    if (preStage.status === 'failed') {
      return { stages, success: false };
    }

    // Stage 2: Rolling update (instance by instance)
    const rollingStage = this.createStage('rolling-update', []);
    const totalBatches = Math.ceil(replicas / maxUnavailable);

    for (let batch = 0; batch < totalBatches; batch++) {
      const startInstance = batch * maxUnavailable;
      const endInstance = Math.min(startInstance + maxUnavailable, replicas);

      // Add steps for this batch
      rollingStage.steps.push(
        this.createStep(
          `replace-instances-batch-${batch + 1}`,
          `Replace instances ${startInstance + 1}-${endInstance} of ${replicas}`
        )
      );
      rollingStage.steps.push(
        this.createStep(
          `health-check-batch-${batch + 1}`,
          `Verify health of batch ${batch + 1}`
        )
      );
    }

    stages.push(rollingStage);

    // Execute rolling update steps
    rollingStage.status = 'running';
    rollingStage.startedAt = new Date();

    for (const step of rollingStage.steps) {
      step.status = 'running';
      step.startedAt = new Date();

      try {
        // Simulate instance replacement and health check
        await this.simulateStepExecution(step);
        step.status = 'completed';
        step.completedAt = new Date();
      } catch (error: any) {
        step.status = 'failed';
        step.error = error.message;
        step.completedAt = new Date();
        rollingStage.status = 'failed';
        rollingStage.error = error.message;
        rollingStage.completedAt = new Date();
        return { stages, success: false };
      }
    }

    rollingStage.status = 'completed';
    rollingStage.completedAt = new Date();

    // Stage 3: Post-deployment verification
    const postStage = this.createStage('post-deployment-verification', [
      this.createStep('verify-all-instances'),
      this.createStep('check-service-endpoints'),
      this.createStep('validate-traffic-distribution'),
    ]);
    stages.push(postStage);

    await this.executeStageSteps(postStage);

    // Update traffic state to fully switched
    await this.saveTrafficState(appName, environment, {
      activePercentage: 0,
      newPercentage: 100,
      switched: true,
    }, 'rolling');

    return { stages, success: postStage.status !== 'failed' };
  }

  /**
   * Recreate Deployment Strategy
   *
   * Stop all old instances, then start new ones.
   * Simple but causes downtime during the transition.
   */
  private async executeRecreate(
    config: DeploymentStrategyConfig,
    appName: string,
    version: string,
    environment: string,
    healthCheckConfig?: HealthCheckConfig
  ): Promise<{ stages: DeploymentStage[]; success: boolean }> {
    const stages: DeploymentStage[] = [];

    // Stage 1: Scale down old version
    const scaleDownStage = this.createStage('scale-down-old-version', [
      this.createStep('drain-connections'),
      this.createStep('stop-old-instances'),
      this.createStep('verify-scaling-complete'),
    ]);
    stages.push(scaleDownStage);

    await this.executeStageSteps(scaleDownStage);
    if (scaleDownStage.status === 'failed') {
      return { stages, success: false };
    }

    // Stage 2: Deploy new version
    const deployStage = this.createStage('deploy-new-version', [
      this.createStep('pull-new-image'),
      this.createStep('create-new-instances'),
      this.createStep('wait-for-ready'),
    ]);
    stages.push(deployStage);

    await this.executeStageSteps(deployStage);
    if (deployStage.status === 'failed') {
      return { stages, success: false };
    }

    // Stage 3: Health verification
    const healthStage = this.createStage('health-verification', [
      this.createStep('run-health-checks'),
      this.createStep('verify-connectivity'),
    ]);
    stages.push(healthStage);

    await this.executeStageSteps(healthStage);
    if (healthStage.status === 'failed') {
      return { stages, success: false };
    }

    // Update traffic state
    await this.saveTrafficState(appName, environment, {
      activePercentage: 0,
      newPercentage: 100,
      switched: true,
    }, 'recreate');

    return { stages, success: true };
  }

  /**
   * Switch traffic from old to new deployment
   */
  async switchTraffic(
    appName: string,
    environment: string,
    newPercentage: number = 100
  ): Promise<{ success: boolean; trafficState: TrafficState }> {
    const newState: TrafficState = {
      activePercentage: 100 - newPercentage,
      newPercentage,
      switched: newPercentage === 100,
    };

    await this.saveTrafficState(appName, environment, newState);

    return { success: true, trafficState: newState };
  }

  /**
   * Verify health of deployed instances
   */
  async verifyHealth(
    appName: string,
    version: string,
    environment: string,
    healthCheckConfig?: HealthCheckConfig
  ): Promise<{ healthy: boolean; checks: any[] }> {
    const config = healthCheckConfig || {
      endpoint: `/api/health`,
      expectedStatus: 200,
      timeoutMs: 5000,
      retries: 3,
      retryIntervalMs: 2000,
    };

    const checks: any[] = [];
    let allHealthy = true;

    // Simulate health check execution
    const endpoint = config.endpoint || `/api/health`;
    const retries = config.retries || 3;

    for (let i = 0; i < retries; i++) {
      try {
        // In production, this would make actual HTTP requests
        checks.push({
          id: uuidv4(),
          endpoint,
          passed: true,
          statusCode: config.expectedStatus || 200,
          responseTimeMs: Math.floor(Math.random() * 100) + 10,
          retries: i,
          checkedAt: new Date(),
        });
        allHealthy = true;
        break;
      } catch (error: any) {
        checks.push({
          id: uuidv4(),
          endpoint,
          passed: false,
          error: error.message,
          retries: i,
          checkedAt: new Date(),
        });
        allHealthy = false;
      }
    }

    return { healthy: allHealthy, checks };
  }

  /**
   * Rollback traffic to previous version
   */
  async rollbackTraffic(
    appName: string,
    environment: string
  ): Promise<{ success: boolean; trafficState: TrafficState }> {
    // Revert traffic to 100% old version
    const revertedState: TrafficState = {
      activePercentage: 100,
      newPercentage: 0,
      switched: false,
    };

    await this.saveTrafficState(appName, environment, revertedState);

    return { success: true, trafficState: revertedState };
  }

  /**
   * Get current traffic state
   */
  async getTrafficState(
    appName: string,
    environment: string
  ): Promise<TrafficState | undefined> {
    if (!this.trafficRepo) return undefined;
    const entity = await this.trafficRepo.findByAppAndEnvironment(appName, environment, this.defaultTenantId);
    return entity ? entityToTrafficState(entity) : undefined;
  }

  // ==================== Private Helper Methods ====================

  /**
   * Save traffic state to repository
   */
  private async saveTrafficState(
    appName: string,
    environment: string,
    state: TrafficState,
    strategy?: string
  ): Promise<void> {
    if (!this.trafficRepo) return;
    const id = `${appName}-${environment}`;
    await this.trafficRepo.upsertByAppEnvironment(
      id,
      this.defaultTenantId,
      appName,
      environment,
      {
        activePercent: state.activePercentage,
        newPercent: state.newPercentage,
        switched: state.switched,
        strategy,
      }
    );
  }

  /**
   * Create a deployment stage
   */
  private createStage(name: string, steps: DeploymentStep[]): DeploymentStage {
    return {
      name,
      status: 'pending',
      steps,
    };
  }

  /**
   * Create a deployment step
   */
  private createStep(name: string, message?: string): DeploymentStep {
    return {
      name,
      status: 'pending',
      message,
    };
  }

  /**
   * Execute all steps in a stage sequentially
   */
  private async executeStageSteps(stage: DeploymentStage): Promise<void> {
    stage.status = 'running';
    stage.startedAt = new Date();

    for (const step of stage.steps) {
      step.status = 'running';
      step.startedAt = new Date();

      try {
        await this.simulateStepExecution(step);
        step.status = 'completed';
        step.completedAt = new Date();
      } catch (error: any) {
        step.status = 'failed';
        step.error = error.message;
        step.completedAt = new Date();
        stage.status = 'failed';
        stage.error = error.message;
        stage.completedAt = new Date();
        return;
      }
    }

    stage.status = 'completed';
    stage.completedAt = new Date();
  }

  /**
   * Simulate step execution (in production, this would execute actual deployment operations)
   */
  private async simulateStepExecution(step: DeploymentStep): Promise<void> {
    // Simulate async operation with small delay
    await new Promise((resolve) =>
      setTimeout(resolve, Math.floor(Math.random() * 50) + 10)
    );
  }

  /**
   * Publish deployment event
   */
  private async publishEvent(type: string, data: any): Promise<void> {
    if (this.eventPublisher) {
      try {
        await this.eventPublisher.publish(type, data, {
          source: 'orion-smart-deploy',
        });
      } catch (error) {
        logger.warn(
          `[DeploymentStrategyEngine] Failed to publish event ${type}:`,
          error
        );
      }
    }
  }
}
