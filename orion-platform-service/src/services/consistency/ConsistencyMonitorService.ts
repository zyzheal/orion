// orion-platform-service/src/services/consistency/ConsistencyMonitorService.ts
import crypto from 'crypto';
import { EventEmitter } from 'events';
import pino from 'pino';
import { Pool } from 'pg';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface ConsistencyCheckConfig {
  checkIntervalMs: number;
  enableAutoRepair: boolean;
  maxRetries: number;
}

export interface ConsistencyCheckResult {
  id?: number;
  checkType: string;
  resourceType: string;
  resourceId: string;
  isConsistent: boolean;
  expectedHash?: string;
  actualHash?: string;
  detectedAt: Date;
  resolvedAt?: Date;
  resolutionAction?: string;
  metadata?: Record<string, unknown>;
}

export interface ConsistencyViolationEvent {
  checkType: string;
  resourceType: string;
  resourceId: string;
  expectedHash?: string;
  actualHash?: string;
  detectedAt: Date;
  metadata?: Record<string, unknown>;
}

export type CheckType = 'pipeline_artifact' | 'config_sync' | 'deployment_state';
export type ResourceType = 'pipeline' | 'artifact' | 'deployment' | 'config';
export type ResolutionAction = 'auto_repair' | 'manual_fix' | 'ignored' | 'pending';

const DEFAULT_CONFIG: ConsistencyCheckConfig = {
  checkIntervalMs: 60000, // 1 minute
  enableAutoRepair: false,
  maxRetries: 3,
};

export class ConsistencyMonitorService extends EventEmitter {
  private dbPool: Pool;
  private config: ConsistencyCheckConfig;
  private timer?: NodeJS.Timeout;
  private isRunning: boolean = false;
  private lastCheckTime?: Date;
  private checkCount: number = 0;
  private violationCount: number = 0;

  constructor(dbPool: Pool, config: Partial<ConsistencyCheckConfig> = {}) {
    super();
    this.dbPool = dbPool;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start periodic consistency monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[ConsistencyMonitor] Monitoring is already running');
      return;
    }

    this.isRunning = true;

    // Run initial check immediately
    await this.runConsistencyChecks();

    // Schedule periodic checks
    this.timer = setInterval(async () => {
      await this.runConsistencyChecks();
    }, this.config.checkIntervalMs);

    logger.info(`[ConsistencyMonitor] Monitoring started with interval: ${this.config.checkIntervalMs}ms`);
    this.emit('monitoring:started', { interval: this.config.checkIntervalMs });
  }

  /**
   * Stop periodic consistency monitoring
   */
  stopMonitoring(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.isRunning = false;
    logger.info('[ConsistencyMonitor] Monitoring stopped');
    this.emit('monitoring:stopped', { checkCount: this.checkCount, violationCount: this.violationCount });
  }

  /**
   * Run all consistency checks
   */
  async runConsistencyChecks(): Promise<ConsistencyCheckResult[]> {
    const results: ConsistencyCheckResult[] = [];
    this.lastCheckTime = new Date();
    this.checkCount++;

    logger.debug('[ConsistencyMonitor] Running consistency checks...');

    try {
      // Check Pipeline-Artifact consistency
      const pipelineArtifactResults = await this.checkPipelineArtifactConsistency();
      results.push(...pipelineArtifactResults);

      // Check Config sync consistency
      const configSyncResults = await this.checkConfigSyncConsistency();
      results.push(...configSyncResults);

      // Check Deployment state consistency
      const deploymentStateResults = await this.checkDeploymentStateConsistency();
      results.push(...deploymentStateResults);

      // Process results
      for (const result of results) {
        if (!result.isConsistent) {
          this.violationCount++;
          this.emit('consistency:violation', {
            checkType: result.checkType,
            resourceType: result.resourceType,
            resourceId: result.resourceId,
            expectedHash: result.expectedHash,
            actualHash: result.actualHash,
            detectedAt: result.detectedAt,
            metadata: result.metadata,
          } as ConsistencyViolationEvent);

          logger.warn(
            `[ConsistencyMonitor] Violation detected: ${result.checkType} - ${result.resourceType}/${result.resourceId}`
          );

          // Attempt auto-repair if enabled
          if (this.config.enableAutoRepair) {
            await this.attemptAutoRepair(result);
          }
        }
      }

      this.emit('check:completed', {
        timestamp: this.lastCheckTime,
        totalChecks: results.length,
        violations: results.filter(r => !r.isConsistent).length
      });

    } catch (error) {
      logger.error('[ConsistencyMonitor] Error during consistency checks:', error);
      this.emit('check:error', { error, timestamp: this.lastCheckTime });
    }

    return results;
  }

  /**
   * Check Pipeline-Artifact consistency by comparing hashes
   */
  private async checkPipelineArtifactConsistency(): Promise<ConsistencyCheckResult[]> {
    const results: ConsistencyCheckResult[] = [];

    logger.debug('[ConsistencyMonitor] Checking Pipeline-Artifact consistency...');

    try {
      // Query recent completed pipeline runs with artifact references
      const pipelineRuns = await this.dbPool.query(`
        SELECT id, status, artifact_id, updated_at, metadata
        FROM pipeline_runs
        WHERE status IN ('completed', 'succeeded')
          AND artifact_id IS NOT NULL
          AND updated_at > NOW() - INTERVAL '24 hours'
      `);

      for (const run of pipelineRuns.rows) {
        try {
          // Get artifact hash
          const artifact = await this.dbPool.query(
            `SELECT id, content_hash, metadata FROM artifacts WHERE id = $1`,
            [run.artifact_id]
          );

          if (artifact.rows.length === 0) {
            // Artifact missing - record inconsistency
            results.push({
              checkType: 'pipeline_artifact',
              resourceType: 'pipeline',
              resourceId: run.id,
              isConsistent: false,
              expectedHash: 'artifact_exists',
              actualHash: 'artifact_missing',
              detectedAt: new Date(),
              metadata: { reason: 'referenced_artifact_not_found' },
            });
            continue;
          }

          // Calculate expected hash from run status and metadata
          const expectedHash = this.computeJsonHash({
            status: run.status,
            id: run.id,
            metadata: run.metadata || {},
          });

          const actualHash = artifact.rows[0]?.content_hash;

          if (actualHash && actualHash !== expectedHash) {
            results.push({
              checkType: 'pipeline_artifact',
              resourceType: 'pipeline',
              resourceId: run.id,
              isConsistent: false,
              expectedHash,
              actualHash,
              detectedAt: new Date(),
              metadata: {
                artifactId: run.artifact_id,
                reason: 'hash_mismatch',
              },
            });
          }
        } catch (error) {
          logger.error(`[ConsistencyMonitor] Error checking pipeline ${run.id}:`, error);
        }
      }
    } catch (error) {
      logger.error('[ConsistencyMonitor] Error querying pipeline runs:', error);
    }

    return results;
  }

  /**
   * Check Config sync consistency
   */
  private async checkConfigSyncConsistency(): Promise<ConsistencyCheckResult[]> {
    const results: ConsistencyCheckResult[] = [];

    logger.debug('[ConsistencyMonitor] Checking Config sync consistency...');

    try {
      // Query configs that have been synced to compare source and target hashes
      const configSyncs = await this.dbPool.query(`
        SELECT id, config_id, source_hash, target_hash, target_environment, updated_at
        FROM config_syncs
        WHERE updated_at > NOW() - INTERVAL '24 hours'
      `);

      for (const sync of configSyncs.rows) {
        try {
          // Check if source and target hashes match
          if (sync.source_hash !== sync.target_hash) {
            results.push({
              checkType: 'config_sync',
              resourceType: 'config',
              resourceId: sync.config_id,
              isConsistent: false,
              expectedHash: sync.source_hash,
              actualHash: sync.target_hash,
              detectedAt: new Date(),
              metadata: {
                syncId: sync.id,
                targetEnvironment: sync.target_environment,
                reason: 'config_drift_detected',
              },
            });
          }

          // Also verify the current source hash matches what's stored
          const currentConfig = await this.dbPool.query(
            `SELECT id, content_hash FROM configs WHERE id = $1`,
            [sync.config_id]
          );

          if (currentConfig.rows.length > 0) {
            const currentHash = currentConfig.rows[0].content_hash;
            if (currentHash && currentHash !== sync.source_hash) {
              results.push({
                checkType: 'config_sync',
                resourceType: 'config',
                resourceId: sync.config_id,
                isConsistent: false,
                expectedHash: sync.source_hash,
                actualHash: currentHash,
                detectedAt: new Date(),
                metadata: {
                  syncId: sync.id,
                  reason: 'source_config_changed_since_sync',
                },
              });
            }
          }
        } catch (error) {
          logger.error(`[ConsistencyMonitor] Error checking config sync ${sync.id}:`, error);
        }
      }

      // Check for configs that should have sync records but don't
      const unsyncedConfigs = await this.dbPool.query(`
        SELECT c.id, c.content_hash, c.updated_at
        FROM configs c
        LEFT JOIN config_syncs cs ON c.id = cs.config_id
        WHERE c.updated_at > NOW() - INTERVAL '24 hours'
          AND cs.id IS NULL
      `);

      for (const config of unsyncedConfigs.rows) {
        results.push({
          checkType: 'config_sync',
          resourceType: 'config',
          resourceId: config.id,
          isConsistent: false,
          expectedHash: 'sync_record_exists',
          actualHash: 'no_sync_record',
          detectedAt: new Date(),
          metadata: {
            reason: 'config_not_synced',
          },
        });
      }
    } catch (error) {
      logger.error('[ConsistencyMonitor] Error querying config syncs:', error);
    }

    return results;
  }

  /**
   * Check Deployment state consistency
   */
  private async checkDeploymentStateConsistency(): Promise<ConsistencyCheckResult[]> {
    const results: ConsistencyCheckResult[] = [];

    logger.debug('[ConsistencyMonitor] Checking Deployment state consistency...');

    try {
      // Query recent deployments from database records
      const deployments = await this.dbPool.query(`
        SELECT id, name, namespace, status, expected_state, actual_state, cluster_name, updated_at
        FROM deployments
        WHERE updated_at > NOW() - INTERVAL '24 hours'
      `);

      for (const deployment of deployments.rows) {
        try {
          // Check if expected state matches actual state
          if (deployment.expected_state && deployment.actual_state) {
            const expectedStateHash = this.computeJsonHash(deployment.expected_state);
            const actualStateHash = this.computeJsonHash(deployment.actual_state);

            if (expectedStateHash !== actualStateHash) {
              results.push({
                checkType: 'deployment_state',
                resourceType: 'deployment',
                resourceId: deployment.id,
                isConsistent: false,
                expectedHash: expectedStateHash,
                actualHash: actualStateHash,
                detectedAt: new Date(),
                metadata: {
                  name: deployment.name,
                  namespace: deployment.namespace,
                  cluster: deployment.cluster_name,
                  reason: 'state_mismatch',
                },
              });
            }
          }

          // Check for deployments marked as running but with stale timestamps
          if (deployment.status === 'running') {
            const staleThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes
            if (deployment.updated_at < staleThreshold) {
              results.push({
                checkType: 'deployment_state',
                resourceType: 'deployment',
                resourceId: deployment.id,
                isConsistent: false,
                detectedAt: new Date(),
                metadata: {
                  name: deployment.name,
                  namespace: deployment.namespace,
                  cluster: deployment.cluster_name,
                  lastUpdate: deployment.updated_at,
                  reason: 'stale_deployment_status',
                },
              });
            }
          }
        } catch (error) {
          logger.error(`[ConsistencyMonitor] Error checking deployment ${deployment.id}:`, error);
        }
      }

      // Check for deployments that exist in K8s but not in our records
      // This would require actual K8s API calls in production
      // For now, we query the cluster_state table for discrepancies
      const clusterStateDiscrepancies = await this.dbPool.query(`
        SELECT cs.deployment_id, cs.resource_name, cs.namespace, cs.cluster_name, cs.recorded_state, cs.observed_state
        FROM cluster_state cs
        LEFT JOIN deployments d ON cs.deployment_id = d.id
        WHERE cs.updated_at > NOW() - INTERVAL '1 hour'
          AND cs.recorded_state IS DISTINCT FROM cs.observed_state
      `);

      for (const state of clusterStateDiscrepancies.rows) {
        results.push({
          checkType: 'deployment_state',
          resourceType: 'deployment',
          resourceId: state.deployment_id || 'unknown',
          isConsistent: false,
          expectedHash: state.recorded_state ? this.computeJsonHash(state.recorded_state) : undefined,
          actualHash: state.observed_state ? this.computeJsonHash(state.observed_state) : undefined,
          detectedAt: new Date(),
          metadata: {
            resourceName: state.resource_name,
            namespace: state.namespace,
            cluster: state.cluster_name,
            reason: 'cluster_state_drift',
          },
        });
      }
    } catch (error) {
      logger.error('[ConsistencyMonitor] Error querying deployments:', error);
    }

    return results;
  }

  /**
   * Compute SHA-256 hash for content
   */
  computeHash(data: string | Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Compute hash for JSON object (deterministic serialization)
   */
  computeJsonHash(obj: unknown): string {
    const canonicalJson = JSON.stringify(obj, Object.keys(obj as Record<string, unknown>).sort());
    return this.computeHash(canonicalJson);
  }

  /**
   * Attempt to automatically repair inconsistency
   */
  private async attemptAutoRepair(result: ConsistencyCheckResult): Promise<boolean> {
    logger.info(
      `[ConsistencyMonitor] Attempting auto-repair for ${result.resourceType}/${result.resourceId}`
    );

    try {
      switch (result.checkType) {
        case 'pipeline_artifact':
          // Would trigger artifact re-generation or re-upload
          logger.info(`[ConsistencyMonitor] Auto-repair: re-generating artifact for pipeline ${result.resourceId}`);
          break;

        case 'config_sync':
          // Would trigger config re-sync
          logger.info(`[ConsistencyMonitor] Auto-repair: re-syncing config ${result.resourceId}`);
          break;

        case 'deployment_state':
          // Would trigger deployment state reconciliation
          logger.info(`[ConsistencyMonitor] Auto-repair: reconciling deployment ${result.resourceId}`);
          break;

        default:
          logger.warn(`[ConsistencyMonitor] Unknown check type for auto-repair: ${result.checkType}`);
          return false;
      }

      // Record resolution
      result.resolvedAt = new Date();
      result.resolutionAction = 'auto_repair';

      this.emit('consistency:repaired', result);
      return true;

    } catch (error) {
      logger.error(`[ConsistencyMonitor] Auto-repair failed for ${result.resourceId}:`, error);
      result.resolutionAction = 'manual_fix';
      this.emit('consistency:repair_failed', { result, error });
      return false;
    }
  }

  /**
   * Record a consistency check result to database
   */
  async recordCheckResult(result: ConsistencyCheckResult): Promise<number> {
    // Placeholder: In production, would insert into consistency_checks table
    // const query = `
    //   INSERT INTO consistency_checks
    //   (check_type, resource_type, resource_id, expected_hash, actual_hash, is_consistent, detected_at, metadata)
    //   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    //   RETURNING id
    // `;
    logger.debug(`[ConsistencyMonitor] Recording check result: ${result.resourceType}/${result.resourceId}`);
    return Date.now(); // Return simulated ID
  }

  /**
   * Resolve a consistency violation
   */
  async resolveViolation(
    checkId: number,
    action: ResolutionAction,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    // Placeholder: Update consistency_checks record
    logger.info(`[ConsistencyMonitor] Resolving violation ${checkId} with action: ${action}`);

    this.emit('consistency:resolved', { checkId, action, metadata, resolvedAt: new Date() });
  }

  /**
   * Get monitoring statistics
   */
  getStats(): {
    isRunning: boolean;
    checkCount: number;
    violationCount: number;
    lastCheckTime?: Date;
    checkIntervalMs: number;
  } {
    return {
      isRunning: this.isRunning,
      checkCount: this.checkCount,
      violationCount: this.violationCount,
      lastCheckTime: this.lastCheckTime,
      checkIntervalMs: this.config.checkIntervalMs,
    };
  }

  /**
   * Cleanup resources on shutdown
   */
  shutdown(): void {
    this.stopMonitoring();
    this.removeAllListeners();
    logger.info('[ConsistencyMonitor] Service shutdown complete');
  }
}

export default ConsistencyMonitorService;