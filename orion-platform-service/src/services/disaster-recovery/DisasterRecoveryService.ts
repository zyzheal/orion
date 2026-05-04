// orion-platform-service/src/services/disaster-recovery/DisasterRecoveryService.ts
import { EventEmitter } from 'events';
import pino from 'pino';
import type { DatabasePool } from '../database';
import { FailoverExecutor, failoverExecutor } from './FailoverExecutor';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface DisasterRecoveryConfig {
  id?: number;
  componentType: string;
  primaryCluster: string;
  standbyCluster: string;
  replicationMode: 'async' | 'semi_sync' | 'sync';
  rtoTargetSeconds: number;
  rpoTargetSeconds: number;
  healthCheckIntervalSeconds: number;
  failoverThreshold: number;
  enabled: boolean;
  status: string;
  metadata?: Record<string, unknown>;
}

export interface DisasterRecoveryEvent {
  id?: number;
  eventType: 'health_check' | 'failover_start' | 'failover_complete' | 'rollback' | 'test_drill';
  componentType: string;
  configId: number;
  triggeredAt: Date;
  completedAt?: Date;
  success: boolean;
  triggerReason?: string;
  rtoActualSeconds?: number;
  rpoActualSeconds?: number;
  dataLossDetected: boolean;
  rollbackPerformed: boolean;
  affectedServices?: string[];
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface HealthCheckResult {
  configId: number;
  targetCluster: string;
  isHealthy: boolean;
  responseTimeMs: number;
  details: Record<string, unknown>;
}

export interface FailoverResult {
  success: boolean;
  componentType: string;
  rtoActualSeconds: number;
  rpoActualSeconds: number;
  dataLossDetected: boolean;
  errorMessage?: string;
}

export type ComponentType = 'database' | 'api_gateway' | 'platform_service' | 'frontend' | 'ai_service';

const DEFAULT_RTO_TARGET = 600; // 10 minutes
const DEFAULT_RPO_TARGET = 300; // 5 minutes
const MAX_RTO_THRESHOLD = 600;  // RTO must be < 10 min
const MAX_RPO_THRESHOLD = 300;  // RPO must be < 5 min

export class DisasterRecoveryService extends EventEmitter {
  private configs: Map<string, DisasterRecoveryConfig> = new Map();
  private healthCheckTimers: Map<string, NodeJS.Timeout> = new Map();
  private consecutiveFailures: Map<string, number> = new Map();
  private isRunning: boolean = false;
  private failoverInProgress: boolean = false;
  private dbPool: DatabasePool | null = null;

  constructor(dbPool?: DatabasePool) {
    super();
    this.dbPool = dbPool || null;
  }

  /**
   * Initialize DR configuration from database
   */
  async initialize(): Promise<void> {
    logger.info('[DisasterRecovery] Initializing service...');

    // Load configurations from database
    await this.loadConfigurationsFromDatabase();

    // Start health check monitoring for each enabled config
    for (const [componentType, config] of this.configs.entries()) {
      if (config.enabled) {
        this.startHealthCheckMonitoring(componentType);
      }
    }

    this.isRunning = true;
    this.emit('service:initialized', { configCount: this.configs.size });

    logger.info(`[DisasterRecovery] Service initialized with ${this.configs.size} configurations`);
  }

  /**
   * Load DR configurations from database
   */
  private async loadConfigurationsFromDatabase(): Promise<void> {
    // Placeholder: In production, would query disaster_recovery_config table
    // const query = `
    //   SELECT * FROM disaster_recovery_config WHERE enabled = true
    // `;
    // const results = await db.query(query);
    // for (const row of results) {
    //   this.configs.set(row.component_type, row);
    // }

    logger.debug('[DisasterRecovery] Loaded configurations from database');
  }

  /**
   * Register a new DR configuration
   */
  async registerConfiguration(config: DisasterRecoveryConfig): Promise<number> {
    // Validate RTO/RPO targets
    if (config.rtoTargetSeconds > MAX_RTO_THRESHOLD) {
      throw new Error(`RTO target exceeds maximum: ${config.rtoTargetSeconds}s > ${MAX_RTO_THRESHOLD}s`);
    }
    if (config.rpoTargetSeconds > MAX_RPO_THRESHOLD) {
      throw new Error(`RPO target exceeds maximum: ${config.rpoTargetSeconds}s > ${MAX_RPO_THRESHOLD}s`);
    }

    // Placeholder: Insert into database
    const configId = Date.now();
    config.id = configId;
    config.status = 'configured';

    this.configs.set(config.componentType, config);

    // Start health monitoring if enabled
    if (config.enabled) {
      this.startHealthCheckMonitoring(config.componentType);
    }

    this.emit('config:registered', { componentType: config.componentType, configId });

    logger.info(
      `[DisasterRecovery] Configuration registered: ${config.componentType} RTO=${config.rtoTargetSeconds}s RPO=${config.rpoTargetSeconds}s`
    );

    return configId;
  }

  /**
   * Start health check monitoring for a component
   */
  private startHealthCheckMonitoring(componentType: string): void {
    const config = this.configs.get(componentType);
    if (!config) {
      logger.warn(`[DisasterRecovery] No configuration found for ${componentType}`);
      return;
    }

    // Clear existing timer if any
    const existingTimer = this.healthCheckTimers.get(componentType);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    // Start periodic health checks
    const timer = setInterval(async () => {
      await this.performHealthCheck(componentType);
    }, config.healthCheckIntervalSeconds * 1000);

    this.healthCheckTimers.set(componentType, timer);
    logger.info(
      `[DisasterRecovery] Health monitoring started for ${componentType} (interval: ${config.healthCheckIntervalSeconds}s)`
    );
  }

  /**
   * Stop health check monitoring for a component
   */
  stopHealthCheckMonitoring(componentType: string): void {
    const timer = this.healthCheckTimers.get(componentType);
    if (timer) {
      clearInterval(timer);
      this.healthCheckTimers.delete(componentType);
      logger.info(`[DisasterRecovery] Health monitoring stopped for ${componentType}`);
    }
  }

  /**
   * Perform health check on primary cluster
   */
  async performHealthCheck(componentType: string): Promise<HealthCheckResult> {
    const config = this.configs.get(componentType);
    if (!config) {
      throw new Error(`Configuration not found: ${componentType}`);
    }

    const startTime = Date.now();
    let isHealthy = false;
    let details: Record<string, unknown> = {};

    logger.debug(`[DisasterRecovery] Performing health check for ${componentType}...`);

    try {
      // Placeholder: In production, would perform actual health check
      // based on component type (HTTP endpoint, database connection, etc.)
      isHealthy = await this.checkClusterHealth(config.primaryCluster, componentType);

      const responseTimeMs = Date.now() - startTime;
      details = {
        cluster: config.primaryCluster,
        responseTimeMs,
        timestamp: new Date().toISOString(),
      };

      // Update consecutive failure counter
      if (isHealthy) {
        this.consecutiveFailures.set(componentType, 0);
      } else {
        const failures = (this.consecutiveFailures.get(componentType) || 0) + 1;
        this.consecutiveFailures.set(componentType, failures);

        logger.warn(
          `[DisasterRecovery] Health check failed for ${componentType} (${failures}/${config.failoverThreshold})`
        );

        // Check if failover threshold reached
        if (failures >= config.failoverThreshold && !this.failoverInProgress) {
          logger.warn(`[DisasterRecovery] Failover threshold reached for ${componentType}`);
          await this.triggerFailover(componentType, 'health_failure');
        }
      }

      // Record health check event
      await this.recordHealthCheckEvent(config.id!, isHealthy, responseTimeMs, details);

      this.emit('health:check', {
        componentType,
        isHealthy,
        responseTimeMs,
        consecutiveFailures: this.consecutiveFailures.get(componentType) || 0,
      });

    } catch (error) {
      logger.error(`[DisasterRecovery] Health check error for ${componentType}:`, error);

      const failures = (this.consecutiveFailures.get(componentType) || 0) + 1;
      this.consecutiveFailures.set(componentType, failures);

      details = {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };

      this.emit('health:error', { componentType, error, consecutiveFailures: failures });
    }

    return {
      configId: config.id!,
      targetCluster: config.primaryCluster,
      isHealthy,
      responseTimeMs: Date.now() - startTime,
      details,
    };
  }

  /**
   * Check cluster health based on component type
   */
  private async checkClusterHealth(cluster: string, componentType: string): Promise<boolean> {
    logger.debug(`[DisasterRecovery] Checking health for ${componentType} at ${cluster}`);

    const HEALTH_CHECK_TIMEOUT_MS = 5000;

    try {
      switch (componentType) {
        case 'database':
          return await this.checkDatabaseHealth(cluster, HEALTH_CHECK_TIMEOUT_MS);

        case 'api_gateway':
        case 'platform_service':
        case 'frontend':
          return await this.checkHttpHealth(cluster, HEALTH_CHECK_TIMEOUT_MS);

        case 'ai_service':
          return await this.checkAIServiceHealth(cluster, HEALTH_CHECK_TIMEOUT_MS);

        default:
          logger.warn(`[DisasterRecovery] Unknown component type: ${componentType}`);
          return false;
      }
    } catch (error) {
      logger.error(`[DisasterRecovery] Health check failed for ${cluster}:`, error);
      return false;
    }
  }

  /**
   * Check database health using connection pool or direct query
   */
  private async checkDatabaseHealth(cluster: string, timeoutMs: number): Promise<boolean> {
    try {
      // If we have a database pool, use it to check health
      if (this.dbPool) {
        const healthResult = await this.withTimeout(
          this.dbPool.checkHealth(),
          timeoutMs,
          'Database health check timeout'
        );
        return healthResult.status === 'up';
      }

      // Fallback: Try to execute a simple query via HTTP endpoint if cluster is a URL
      if (cluster.startsWith('http://') || cluster.startsWith('https://')) {
        return await this.checkHttpHealth(cluster, timeoutMs);
      }

      // If no pool and no URL, we cannot verify - log warning and return false
      logger.warn('[DisasterRecovery] No database pool configured and cluster is not an HTTP URL');
      return false;
    } catch (error) {
      logger.error(`[DisasterRecovery] Database health check error:`, error);
      return false;
    }
  }

  /**
   * Check HTTP health endpoint
   */
  private async checkHttpHealth(cluster: string, timeoutMs: number): Promise<boolean> {
    try {
      const healthUrl = cluster.endsWith('/healthz') ? cluster : `${cluster}/healthz`;

      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(timeoutMs),
      });

      return response.ok;
    } catch (error) {
      logger.error(`[DisasterRecovery] HTTP health check error for ${cluster}:`, error);
      return false;
    }
  }

  /**
   * Check AI service health endpoint
   */
  private async checkAIServiceHealth(cluster: string, timeoutMs: number): Promise<boolean> {
    try {
      // AI service typically exposes /healthz or /v1/models endpoint
      const healthUrl = cluster.endsWith('/healthz') ? cluster : `${cluster}/healthz`;

      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(timeoutMs),
      });

      return response.ok;
    } catch (error) {
      logger.error(`[DisasterRecovery] AI service health check error for ${cluster}:`, error);
      return false;
    }
  }

  /**
   * Wrap a promise with a timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      return result;
    } finally {
      clearTimeout(timeoutId!);
    }
  }

  /**
   * Trigger failover to standby cluster
   */
  async triggerFailover(componentType: string, reason: string): Promise<FailoverResult> {
    const config = this.configs.get(componentType);
    if (!config) {
      throw new Error(`Configuration not found: ${componentType}`);
    }

    if (this.failoverInProgress) {
      logger.warn(`[DisasterRecovery] Failover already in progress, skipping for ${componentType}`);
      return {
        success: false,
        componentType,
        rtoActualSeconds: 0,
        rpoActualSeconds: 0,
        dataLossDetected: false,
        errorMessage: 'Failover already in progress',
      };
    }

    this.failoverInProgress = true;
    const startTime = Date.now();

    logger.info(`[DisasterRecovery] Triggering failover for ${componentType} reason=${reason}`);
    this.emit('failover:triggered', { componentType, reason, timestamp: new Date() });

    // Record failover start event
    const startEventId = await this.recordFailoverEvent({
      eventType: 'failover_start',
      componentType,
      configId: config.id!,
      triggeredAt: new Date(),
      success: false,
      triggerReason: reason,
      dataLossDetected: false,
      rollbackPerformed: false,
    });

    let success = false;
    let dataLossDetected = false;
    let errorMessage: string | undefined;

    try {
      // Step 1: Stop accepting new requests on primary
      logger.info(`[DisasterRecovery] Step 1: Stopping traffic to primary cluster`);
      await this.stopTrafficToPrimary(componentType);

      // Step 2: Verify standby is ready
      logger.info(`[DisasterRecovery] Step 2: Verifying standby cluster readiness`);
      const standbyReady = await this.verifyStandbyReady(componentType);
      if (!standbyReady) {
        throw new Error('Standby cluster is not ready');
      }

      // Step 3: Switch traffic to standby
      logger.info(`[DisasterRecovery] Step 3: Switching traffic to standby cluster`);
      await this.switchTrafficToStandby(componentType);

      // Step 4: Verify services are operational
      logger.info(`[DisasterRecovery] Step 4: Verifying services on standby`);
      const servicesOk = await this.verifyStandbyServices(componentType);
      if (!servicesOk) {
        throw new Error('Services on standby cluster are not operational');
      }

      // Step 5: Check for data loss
      logger.info(`[DisasterRecovery] Step 5: Checking for data loss`);
      dataLossDetected = await this.checkForDataLoss(componentType);

      success = true;
      this.consecutiveFailures.set(componentType, 0);

      logger.info(`[DisasterRecovery] Failover completed successfully for ${componentType}`);

    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[DisasterRecovery] Failover failed for ${componentType}:`, error);

      // Attempt rollback
      try {
        logger.info(`[DisasterRecovery] Attempting rollback...`);
        await this.rollbackFailover(componentType);
        logger.info(`[DisasterRecovery] Rollback completed`);
      } catch (rollbackError) {
        logger.error(`[DisasterRecovery] Rollback failed:`, rollbackError);
        errorMessage += ` | Rollback failed: ${rollbackError instanceof Error ? rollbackError.message : 'Unknown'}`;
      }
    }

    const endTime = Date.now();
    const rtoActualSeconds = Math.round((endTime - startTime) / 1000);

    // Calculate RPO (placeholder - would check replication lag)
    const rpoActualSeconds = await this.calculateRPO(componentType);

    // Record failover complete event
    await this.updateFailoverEvent(startEventId, {
      completedAt: new Date(),
      success,
      rtoActualSeconds,
      rpoActualSeconds,
      dataLossDetected,
      errorMessage,
    });

    this.failoverInProgress = false;

    // Validate RTO/RPO against targets
    const rtoValid = await this.validateRTO(rtoActualSeconds, config.rtoTargetSeconds);
    const rpoValid = await this.validateRPO(rpoActualSeconds, config.rpoTargetSeconds);

    if (!rtoValid) {
      logger.warn(
        `[DisasterRecovery] RTO validation failed: ${rtoActualSeconds}s > ${config.rtoTargetSeconds}s`
      );
      this.emit('rto:exceeded', { componentType, actual: rtoActualSeconds, target: config.rtoTargetSeconds });
    }

    if (!rpoValid) {
      logger.warn(
        `[DisasterRecovery] RPO validation failed: ${rpoActualSeconds}s > ${config.rpoTargetSeconds}s`
      );
      this.emit('rpo:exceeded', { componentType, actual: rpoActualSeconds, target: config.rpoTargetSeconds });
    }

    this.emit('failover:completed', {
      componentType,
      success,
      rtoActualSeconds,
      rpoActualSeconds,
      dataLossDetected,
    });

    return {
      success,
      componentType,
      rtoActualSeconds,
      rpoActualSeconds,
      dataLossDetected,
      errorMessage,
    };
  }

  /**
   * Stop traffic to primary cluster
   */
  private async stopTrafficToPrimary(componentType: string): Promise<void> {
    const config = this.configs.get(componentType);
    if (!config) return;

    const executorConfig = this.getFailoverConfig(componentType, config);

    if (failoverExecutor.isAvailable()) {
      const result = await failoverExecutor.stopTrafficToPrimary(executorConfig);
      if (!result.success) {
        throw new Error(`Failed to stop traffic: ${result.error}`);
      }
      logger.info(`[DisasterRecovery] Traffic stopped to primary for ${componentType} in ${result.durationMs}ms`);
    } else {
      logger.warn(`[DisasterRecovery] Failover executor not available, skipping traffic stop for ${componentType}`);
    }
  }

  /**
   * Verify standby cluster is ready
   */
  private async verifyStandbyReady(componentType: string): Promise<boolean> {
    const config = this.configs.get(componentType);
    if (!config) return false;

    // First check health via HTTP/database
    const healthOk = await this.checkClusterHealth(config.standbyCluster, componentType);
    if (!healthOk) {
      logger.warn(`[DisasterRecovery] Standby health check failed for ${componentType}`);
      return false;
    }

    // If K8s available, verify pods are ready
    const executorConfig = this.getFailoverConfig(componentType, config);
    const standbyServiceName = this.getStandbyServiceName(componentType, config);

    if (failoverExecutor.isAvailable()) {
      return await failoverExecutor.verifyPodsReady(executorConfig, standbyServiceName, 1);
    }

    return healthOk;
  }

  /**
   * Switch traffic to standby cluster
   */
  private async switchTrafficToStandby(componentType: string): Promise<void> {
    const config = this.configs.get(componentType);
    if (!config) return;

    const executorConfig = this.getFailoverConfig(componentType, config);
    const standbyServiceName = this.getStandbyServiceName(componentType, config);

    if (failoverExecutor.isAvailable()) {
      const result = await failoverExecutor.switchTrafficToStandby(executorConfig, standbyServiceName);
      if (!result.success) {
        throw new Error(`Failed to switch traffic: ${result.error}`);
      }
      logger.info(`[DisasterRecovery] Traffic switched to standby for ${componentType} in ${result.durationMs}ms`);

      // Update ingress if configured
      if (executorConfig.ingressName) {
        const ingressResult = await failoverExecutor.updateIngress(executorConfig, standbyServiceName);
        if (!ingressResult.success) {
          logger.warn(`[DisasterRecovery] Ingress update failed: ${ingressResult.error}`);
        }
      }
    } else {
      logger.warn(`[DisasterRecovery] Failover executor not available, skipping traffic switch for ${componentType}`);
    }
  }

  /**
   * Verify services on standby are operational
   */
  private async verifyStandbyServices(componentType: string): Promise<boolean> {
    const config = this.configs.get(componentType);
    if (!config) return false;

    // Check cluster health
    const healthOk = await this.checkClusterHealth(config.standbyCluster, componentType);
    if (!healthOk) {
      return false;
    }

    // Verify pods ready via K8s
    const executorConfig = this.getFailoverConfig(componentType, config);
    const standbyServiceName = this.getStandbyServiceName(componentType, config);

    if (failoverExecutor.isAvailable()) {
      return await failoverExecutor.verifyPodsReady(executorConfig, standbyServiceName, 2);
    }

    return true;
  }

  /**
   * Check for data loss during failover
   */
  private async checkForDataLoss(componentType: string): Promise<boolean> {
    // Check replication lag from database
    if (componentType === 'database' && this.dbPool) {
      try {
        const result = await this.dbPool.query(
          `SELECT pg_is_in_recovery(), pg_last_xact_replay_timestamp()`
        );

        const inRecovery = result.rows[0]?.pg_is_in_recovery;
        const replayTimestamp = result.rows[0]?.pg_last_xact_replay_timestamp;

        // If standby is still in recovery mode and replay is delayed
        if (inRecovery && replayTimestamp) {
          const lagMs = Date.now() - new Date(replayTimestamp).getTime();
          // Consider data loss if lag > 5 seconds
          return lagMs > 5000;
        }
      } catch (error) {
        logger.warn(`[DisasterRecovery] Could not check replication status: ${error}`);
      }
    }

    return false;
  }

  /**
   * Calculate RPO based on replication state
   */
  private async calculateRPO(componentType: string): Promise<number> {
    if (componentType === 'database' && this.dbPool) {
      try {
        const result = await this.dbPool.query(
          `SELECT
            CASE
              WHEN pg_is_in_recovery() THEN
                EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))
              ELSE 0
            END as replication_lag_seconds`
        );

        return Math.round(result.rows[0]?.replication_lag_seconds || 0);
      } catch (error) {
        logger.warn(`[DisasterRecovery] Could not calculate RPO: ${error}`);
      }
    }

    return 0;
  }

  /**
   * Rollback failed failover
   */
  private async rollbackFailover(componentType: string): Promise<void> {
    const config = this.configs.get(componentType);
    if (!config) return;

    const executorConfig = this.getFailoverConfig(componentType, config);
    const primaryServiceName = executorConfig.serviceName;

    if (failoverExecutor.isAvailable()) {
      const results = await failoverExecutor.rollback(executorConfig, primaryServiceName);
      const failedSteps = results.filter(r => !r.success);

      if (failedSteps.length > 0) {
        throw new Error(`Rollback failed: ${failedSteps.map(s => s.error).join(', ')}`);
      }

      logger.info(`[DisasterRecovery] Rollback completed for ${componentType}`);
    } else {
      logger.warn(`[DisasterRecovery] Failover executor not available, skipping rollback for ${componentType}`);
    }
  }

  /**
   * Switch traffic back to primary cluster
   */
  private async switchTrafficToPrimary(componentType: string): Promise<void> {
    const config = this.configs.get(componentType);
    if (!config) return;

    const executorConfig = this.getFailoverConfig(componentType, config);
    const primaryServiceName = executorConfig.serviceName;

    if (failoverExecutor.isAvailable()) {
      const result = await failoverExecutor.switchTrafficToStandby(executorConfig, primaryServiceName);
      if (!result.success) {
        throw new Error(`Failed to switch back to primary: ${result.error}`);
      }
      logger.info(`[DisasterRecovery] Traffic switched back to primary for ${componentType}`);
    }
  }

  /**
   * Get failover executor config from DR config
   */
  private getFailoverConfig(_componentType: string, config: DisasterRecoveryConfig): {
    namespace: string;
    serviceName: string;
    ingressName?: string;
  } {
    const namespace = process.env.K8S_NAMESPACE || 'orion';
    const serviceName = (config.metadata?.serviceName as string) || 'orion-service';
    const ingressName = (config.metadata?.ingressName as string) || undefined;

    return {
      namespace,
      serviceName,
      ingressName,
    };
  }

  /**
   * Get standby service name from DR config
   */
  private getStandbyServiceName(componentType: string, config: DisasterRecoveryConfig): string {
    return (config.metadata?.standbyServiceName as string) || `orion-${componentType}-standby`;
  }

  /**
   * Validate RTO meets target (< 10 minutes)
   */
  async validateRTO(actualSeconds: number, targetSeconds: number): Promise<boolean> {
    const isValid = actualSeconds <= targetSeconds && actualSeconds <= MAX_RTO_THRESHOLD;

    if (!isValid) {
      logger.warn(
        `[DisasterRecovery] RTO validation: ${actualSeconds}s exceeds target ${targetSeconds}s (max ${MAX_RTO_THRESHOLD}s)`
      );
    }

    return isValid;
  }

  /**
   * Validate RPO meets target (< 5 minutes)
   */
  async validateRPO(actualSeconds: number, targetSeconds: number): Promise<boolean> {
    const isValid = actualSeconds <= targetSeconds && actualSeconds <= MAX_RPO_THRESHOLD;

    if (!isValid) {
      logger.warn(
        `[DisasterRecovery] RPO validation: ${actualSeconds}s exceeds target ${targetSeconds}s (max ${MAX_RPO_THRESHOLD}s)`
      );
    }

    return isValid;
  }

  /**
   * Run a disaster recovery drill (test failover)
   */
  async runDrill(componentType: string): Promise<FailoverResult> {
    logger.info(`[DisasterRecovery] Running DR drill for ${componentType}`);

    const result = await this.triggerFailover(componentType, 'scheduled_drill');

    // Record drill event
    await this.recordFailoverEvent({
      eventType: 'test_drill',
      componentType,
      configId: this.configs.get(componentType)?.id!,
      triggeredAt: new Date(),
      completedAt: new Date(),
      success: result.success,
      triggerReason: 'scheduled_drill',
      rtoActualSeconds: result.rtoActualSeconds,
      rpoActualSeconds: result.rpoActualSeconds,
      dataLossDetected: result.dataLossDetected,
      rollbackPerformed: true,
    });

    return result;
  }

  /**
   * Record health check event
   */
  private async recordHealthCheckEvent(
    configId: number,
    isHealthy: boolean,
    responseTimeMs: number,
    details: Record<string, unknown>
  ): Promise<number> {
    // Placeholder: Insert into disaster_recovery_health_checks table
    logger.debug(`[DisasterRecovery] Recording health check event: config=${configId} healthy=${isHealthy}`);
    return Date.now();
  }

  /**
   * Record failover event
   */
  private async recordFailoverEvent(event: Partial<DisasterRecoveryEvent>): Promise<number> {
    // Placeholder: Insert into disaster_recovery_events table
    logger.debug(`[DisasterRecovery] Recording failover event: ${event.eventType}`);
    return Date.now();
  }

  /**
   * Update failover event
   */
  private async updateFailoverEvent(
    eventId: number,
    updates: Partial<DisasterRecoveryEvent>
  ): Promise<void> {
    // Placeholder: Update disaster_recovery_events table
    logger.debug(`[DisasterRecovery] Updating failover event ${eventId}`);
  }

  /**
   * Get current status for a component
   */
  getStatus(componentType: string): {
    config: DisasterRecoveryConfig | null;
    consecutiveFailures: number;
    failoverInProgress: boolean;
  } {
    return {
      config: this.configs.get(componentType) || null,
      consecutiveFailures: this.consecutiveFailures.get(componentType) || 0,
      failoverInProgress: this.failoverInProgress,
    };
  }

  /**
   * Get all registered configurations
   */
  getAllConfigurations(): DisasterRecoveryConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Shutdown service
   */
  shutdown(): void {
    // Stop all health check timers
    for (const componentType of this.healthCheckTimers.keys()) {
      this.stopHealthCheckMonitoring(componentType);
    }

    this.isRunning = false;
    this.removeAllListeners();

    logger.info('[DisasterRecovery] Service shutdown complete');
  }
}

export default DisasterRecoveryService;