/**
 * EnvironmentExecutorService - Environment hibernation and TTL management
 *
 * Handles environment hibernation, wake-up, TTL checking, and status management.
 * Supports automatic hibernation of idle environments to save resources.
 *
 * K8s Integration:
 * - When K8s client is available, performs real scale-down/scale-up of Deployments
 * - Falls back to simulation mode when K8s is not accessible
 *
 * Uses PostgreSQL Repository pattern for persistence.
 */

import pino from 'pino';
import { EnvironmentExecutorRepository, CreateEnvironmentExecutorStateInput } from '../../repositories/EnvironmentExecutorRepository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// K8s types - imported conditionally to allow running without @kubernetes/client-node
let KubeConfig: any;
let AppsV1Api: any;
let CoreV1Api: any;
let k8sAvailable = false;

try {
  const k8s = require('@kubernetes/client-node');
  KubeConfig = k8s.KubeConfig;
  AppsV1Api = k8s.AppsV1Api;
  CoreV1Api = k8s.CoreV1Api;
  k8sAvailable = true;
} catch {
  logger.debug('[EnvironmentExecutorService] @kubernetes/client-node not available, using simulation mode');
}

export interface EnvironmentK8sConfig {
  /** K8s namespace for the environment */
  namespace?: string;
  /** Deployment name to scale */
  deploymentName: string;
  /** Label selector for finding related resources (e.g., 'app=my-env') */
  labelSelector?: string;
  /** Whether to also scale related StatefulSets */
  scaleStatefulSets?: boolean;
  /** HPA (HorizontalPodAutoscaler) name to suspend/resume */
  hpaName?: string;
}

export interface EnvironmentStatus {
  envId: string;
  tenantId: string;
  state: 'active' | 'hibernating' | 'hibernated' | 'waking' | 'error';
  lastActiveAt: Date;
  hibernatedAt?: Date;
  wakeScheduledAt?: Date;
  ttlSeconds?: number;
  lastCheckedAt: Date;
  statusMessage?: string;
  /** Previous replica count before hibernation (for wake-up restoration) */
  previousReplicas?: number;
  /** K8s configuration for this environment */
  k8sConfig?: EnvironmentK8sConfig;
  /** Number of replicas before hibernation */
  originalReplicaCount?: number;
}

export interface K8sScaleOperation {
  success: boolean;
  previousReplicas: number;
  targetReplicas: number;
  durationMs: number;
  error?: string;
  resourceType: 'Deployment' | 'StatefulSet' | 'HPA';
  resourceName: string;
}

export class EnvironmentExecutorServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'EnvironmentExecutorServiceError';
  }
}

export class EnvironmentExecutorService {
  private repository: EnvironmentExecutorRepository;
  private appsApi: any | null = null;
  private coreApi: any | null = null;
  private k8sInitialized: boolean = false;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.repository = new EnvironmentExecutorRepository(db);
    } else {
      this.repository = null as unknown as EnvironmentExecutorRepository;
    }
    this.initializeK8sClient();
  }

  /**
   * Inject a custom repository (useful for testing with mock repos)
   */
  setRepository(repo: EnvironmentExecutorRepository): void {
    this.repository = repo;
  }

  /**
   * Initialize K8s client using @kubernetes/client-node patterns.
   * Falls back gracefully if K8s is not available.
   */
  private initializeK8sClient(): void {
    if (!k8sAvailable) {
      logger.info('[EnvironmentExecutorService] K8s not available, using simulation mode');
      this.k8sInitialized = false;
      return;
    }

    try {
      const kubeConfig = new KubeConfig();
      kubeConfig.loadFromDefault();

      this.appsApi = kubeConfig.makeApiClient(AppsV1Api);
      this.coreApi = kubeConfig.makeApiClient(CoreV1Api);
      this.k8sInitialized = true;

      logger.info('[EnvironmentExecutorService] K8s client initialized successfully');
    } catch (error) {
      logger.warn(`[EnvironmentExecutorService] K8s client initialization failed: ${error}`);
      this.k8sInitialized = false;
      this.appsApi = null;
      this.coreApi = null;
    }
  }

  /**
   * Check if real K8s operations are available
   */
  isK8sAvailable(): boolean {
    return this.k8sInitialized && this.appsApi !== null;
  }

  // ==================== K8s Scale Operations ====================

  /**
   * Scale a K8s Deployment to a specific replica count
   * Returns the scale operation result with previous replica count
   */
  private async scaleDeployment(
    namespace: string,
    deploymentName: string,
    replicas: number
  ): Promise<K8sScaleOperation> {
    const startTime = Date.now();

    if (!this.isK8sAvailable() || !this.appsApi) {
      return {
        success: false,
        previousReplicas: 0,
        targetReplicas: replicas,
        durationMs: 0,
        error: 'K8s API not available',
        resourceType: 'Deployment',
        resourceName: deploymentName,
      };
    }

    try {
      // Get current deployment to read current replicas
      const deployment = await this.appsApi.readNamespacedDeployment(
        deploymentName,
        namespace
      );

      const currentReplicas = deployment?.body?.spec?.replicas ?? 1;

      if (currentReplicas === replicas) {
        logger.debug(`[EnvironmentExecutorService] ${deploymentName} already at ${replicas} replicas`);
        return {
          success: true,
          previousReplicas: currentReplicas,
          targetReplicas: replicas,
          durationMs: Date.now() - startTime,
          resourceType: 'Deployment',
          resourceName: deploymentName,
        };
      }

      // Scale the deployment
      await this.appsApi.replaceNamespacedDeploymentScale(
        deploymentName,
        namespace,
        { spec: { replicas } }
      );

      logger.info(`[EnvironmentExecutorService] Scaled ${deploymentName} from ${currentReplicas} to ${replicas} replicas in ${namespace}`);

      return {
        success: true,
        previousReplicas: currentReplicas,
        targetReplicas: replicas,
        durationMs: Date.now() - startTime,
        resourceType: 'Deployment',
        resourceName: deploymentName,
      };
    } catch (error: any) {
      logger.error(`[EnvironmentExecutorService] Failed to scale ${deploymentName}: ${error?.message || error}`);
      return {
        success: false,
        previousReplicas: 0,
        targetReplicas: replicas,
        durationMs: Date.now() - startTime,
        error: error?.message || 'Unknown error',
        resourceType: 'Deployment',
        resourceName: deploymentName,
      };
    }
  }

  /**
   * Scale a K8s StatefulSet to a specific replica count
   */
  private async scaleStatefulSet(
    namespace: string,
    statefulSetName: string,
    replicas: number
  ): Promise<K8sScaleOperation> {
    const startTime = Date.now();

    if (!this.isK8sAvailable() || !this.appsApi) {
      return {
        success: false,
        previousReplicas: 0,
        targetReplicas: replicas,
        durationMs: 0,
        error: 'K8s API not available',
        resourceType: 'StatefulSet',
        resourceName: statefulSetName,
      };
    }

    try {
      const statefulSet = await this.appsApi.readNamespacedStatefulSet(
        statefulSetName,
        namespace
      );

      const currentReplicas = statefulSet?.body?.spec?.replicas ?? 1;

      await this.appsApi.replaceNamespacedStatefulSetScale(
        statefulSetName,
        namespace,
        { spec: { replicas } }
      );

      logger.info(`[EnvironmentExecutorService] Scaled StatefulSet ${statefulSetName} from ${currentReplicas} to ${replicas} replicas`);

      return {
        success: true,
        previousReplicas: currentReplicas,
        targetReplicas: replicas,
        durationMs: Date.now() - startTime,
        resourceType: 'StatefulSet',
        resourceName: statefulSetName,
      };
    } catch (error: any) {
      logger.error(`[EnvironmentExecutorService] Failed to scale StatefulSet ${statefulSetName}: ${error?.message || error}`);
      return {
        success: false,
        previousReplicas: 0,
        targetReplicas: replicas,
        durationMs: Date.now() - startTime,
        error: error?.message || 'Unknown error',
        resourceType: 'StatefulSet',
        resourceName: statefulSetName,
      };
    }
  }

  /**
   * Wait for pods to reach desired state
   */
  private async waitForPodsReady(
    namespace: string,
    labelSelector: string,
    desiredCount: number,
    timeoutMs: number = 60000
  ): Promise<boolean> {
    if (!this.isK8sAvailable() || !this.coreApi) {
      return false;
    }

    const startTime = Date.now();
    const pollInterval = 2000; // 2 seconds

    while (Date.now() - startTime < timeoutMs) {
      try {
        const pods = await this.coreApi.listNamespacedPod({
          namespace,
          labelSelector,
        });

        const readyPods = pods.body.items.filter((pod: any) =>
          pod.status?.phase === 'Running' &&
          pod.status?.conditions?.some((c: any) => c.type === 'Ready' && c.status === 'True')
        );

        if (readyPods.length >= desiredCount) {
          logger.info(`[EnvironmentExecutorService] ${readyPods.length} pods ready for ${labelSelector}`);
          return true;
        }

        logger.debug(`[EnvironmentExecutorService] Waiting for pods: ${readyPods.length}/${desiredCount} ready`);
      } catch (error) {
        logger.warn(`[EnvironmentExecutorService] Pod check failed: ${error}`);
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    logger.warn(`[EnvironmentExecutorService] Timeout waiting for pods for ${labelSelector}`);
    return false;
  }

  /**
   * Perform real K8s scale-down for hibernation
   */
  private async k8sHibernate(k8sConfig: EnvironmentK8sConfig, namespace: string): Promise<{
    success: boolean;
    operations: K8sScaleOperation[];
    previousReplicas: number;
  }> {
    const operations: K8sScaleOperation[] = [];
    let previousReplicas = 0;

    // Scale down main deployment
    const deployResult = await this.scaleDeployment(namespace, k8sConfig.deploymentName, 0);
    operations.push(deployResult);

    if (deployResult.success) {
      previousReplicas = deployResult.previousReplicas;
    }

    // Scale down related StatefulSets if configured
    if (k8sConfig.scaleStatefulSets && k8sConfig.labelSelector) {
      try {
        // Find StatefulSets with matching labels
        const labelValue = k8sConfig.labelSelector.split('=')[1];
        if (labelValue) {
          const stsResult = await this.scaleStatefulSet(namespace, labelValue, 0);
          operations.push(stsResult);
        }
      } catch {
        logger.warn('[EnvironmentExecutorService] Failed to scale StatefulSets during hibernation');
      }
    }

    const allSuccess = operations.every(op => op.success);
    return { success: allSuccess, operations, previousReplicas };
  }

  /**
   * Perform real K8s scale-up for wake-up
   */
  private async k8sWake(
    k8sConfig: EnvironmentK8sConfig,
    namespace: string,
    targetReplicas: number
  ): Promise<{ success: boolean; operations: K8sScaleOperation[] }> {
    const operations: K8sScaleOperation[] = [];

    // Scale up main deployment
    const deployResult = await this.scaleDeployment(namespace, k8sConfig.deploymentName, targetReplicas);
    operations.push(deployResult);

    // Scale up related StatefulSets
    if (k8sConfig.scaleStatefulSets && k8sConfig.labelSelector) {
      try {
        const labelValue = k8sConfig.labelSelector.split('=')[1];
        if (labelValue) {
          const stsResult = await this.scaleStatefulSet(namespace, labelValue, targetReplicas);
          operations.push(stsResult);
        }
      } catch {
        logger.warn('[EnvironmentExecutorService] Failed to scale StatefulSets during wake-up');
      }
    }

    // Wait for pods to be ready
    if (deployResult.success && k8sConfig.labelSelector && targetReplicas > 0) {
      const podsReady = await this.waitForPodsReady(
        namespace,
        k8sConfig.labelSelector,
        targetReplicas
      );

      if (!podsReady) {
        logger.warn(`[EnvironmentExecutorService] Not all pods ready after wake-up for ${k8sConfig.deploymentName}`);
      }
    }

    const allSuccess = operations.every(op => op.success);
    return { success: allSuccess, operations };
  }

  // ==================== Hibernate Environment ====================

  /**
   * Hibernate an environment (suspend resources to save cost)
   *
   * When K8s is available: scales down Deployments/StatefulSets to 0 replicas
   * When K8s is not available: falls back to simulation mode
   */
  async hibernateEnvironment(tenantId: string, envId: string): Promise<EnvironmentStatus> {
    if (!tenantId || !envId) {
      throw new EnvironmentExecutorServiceError(
        'tenantId and envId are required',
        'INVALID_INPUT'
      );
    }

    const status = await this.getStatus(tenantId, envId);

    if (status.state === 'hibernated') {
      throw new EnvironmentExecutorServiceError(
        `Environment ${envId} is already hibernated`,
        'ALREADY_HIBERNATED'
      );
    }

    status.state = 'hibernating';
    status.statusMessage = 'Hibernation in progress';
    status.lastCheckedAt = new Date();
    await this.saveStatus(status);

    // Attempt real K8s hibernation if available and configured
    if (this.isK8sAvailable() && status.k8sConfig) {
      const namespace = status.k8sConfig.namespace || 'default';
      const result = await this.k8sHibernate(status.k8sConfig, namespace);

      if (result.success) {
        status.previousReplicas = result.previousReplicas;
        status.originalReplicaCount = result.previousReplicas;
        status.state = 'hibernated';
        status.hibernatedAt = new Date();
        status.lastActiveAt = new Date();
        status.statusMessage = `Environment hibernated (scaled ${status.k8sConfig.deploymentName} from ${result.previousReplicas} to 0)`;
      } else {
        status.state = 'error';
        status.statusMessage = `K8s hibernation failed: ${result.operations.map(o => o.error).filter(Boolean).join('; ')}`;
        await this.saveStatus(status);
        throw new EnvironmentExecutorServiceError(
          status.statusMessage,
          'K8S_HIBERNATION_FAILED'
        );
      }
    } else {
      // Fallback: simulate hibernation
      if (status.k8sConfig && !this.isK8sAvailable()) {
        logger.warn(`[EnvironmentExecutorService] K8s config present but K8s unavailable for ${envId}, using simulation`);
      }

      // Store simulated replica count
      if (!status.originalReplicaCount) {
        status.originalReplicaCount = status.previousReplicas || 3; // default 3 replicas
      }
      status.previousReplicas = status.originalReplicaCount;

      status.state = 'hibernated';
      status.hibernatedAt = new Date();
      status.lastActiveAt = new Date();
      status.statusMessage = 'Environment hibernated successfully (simulation mode)';
    }

    await this.saveStatus(status);
    return status;
  }

  // ==================== Wake Environment ====================

  /**
   * Wake up a hibernated environment
   *
   * When K8s is available: scales up Deployments/StatefulSets to previous replica count
   * When K8s is not available: falls back to simulation mode
   */
  async wakeEnvironment(tenantId: string, envId: string): Promise<EnvironmentStatus> {
    if (!tenantId || !envId) {
      throw new EnvironmentExecutorServiceError(
        'tenantId and envId are required',
        'INVALID_INPUT'
      );
    }

    const status = await this.getStatus(tenantId, envId);

    if (status.state !== 'hibernated') {
      throw new EnvironmentExecutorServiceError(
        `Environment ${envId} is not hibernated (current state: ${status.state})`,
        'NOT_HIBERNATED'
      );
    }

    status.state = 'waking';
    status.statusMessage = 'Waking up environment';
    status.lastCheckedAt = new Date();
    await this.saveStatus(status);

    // Determine target replica count (restore to previous or use default)
    const targetReplicas = status.previousReplicas || 3;

    // Attempt real K8s wake-up if available and configured
    if (this.isK8sAvailable() && status.k8sConfig) {
      const namespace = status.k8sConfig.namespace || 'default';
      const result = await this.k8sWake(status.k8sConfig, namespace, targetReplicas);

      if (result.success) {
        status.state = 'active';
        status.hibernatedAt = undefined;
        status.lastActiveAt = new Date();
        status.statusMessage = `Environment woke up (scaled ${status.k8sConfig.deploymentName} to ${targetReplicas} replicas)`;
      } else {
        status.state = 'error';
        status.statusMessage = `K8s wake-up failed: ${result.operations.map(o => o.error).filter(Boolean).join('; ')}`;
        await this.saveStatus(status);
        throw new EnvironmentExecutorServiceError(
          status.statusMessage,
          'K8S_WAKE_FAILED'
        );
      }
    } else {
      // Fallback: simulate wake-up
      if (status.k8sConfig && !this.isK8sAvailable()) {
        logger.warn(`[EnvironmentExecutorService] K8s config present but K8s unavailable for ${envId}, using simulation`);
      }

      status.state = 'active';
      status.hibernatedAt = undefined;
      status.lastActiveAt = new Date();
      status.statusMessage = `Environment woke up successfully (simulation mode, target: ${targetReplicas} replicas)`;
    }

    await this.saveStatus(status);
    return status;
  }

  // ==================== TTL Check ====================

  /**
   * Check TTL for all environments in a tenant and auto-hibernate idle ones
   * Returns list of environments that were hibernated
   */
  async checkTTLAndHibernate(tenantId: string): Promise<EnvironmentStatus[]> {
    if (!tenantId) {
      throw new EnvironmentExecutorServiceError('tenantId is required', 'INVALID_INPUT');
    }

    const hibernated: EnvironmentStatus[] = [];
    const now = new Date();

    const activeStatuses = await this.repository.findActiveByTenant(tenantId);

    for (const entity of activeStatuses) {
      const status = this.entityToDomain(entity);

      // Skip if no TTL configured
      if (!status.ttlSeconds) {
        continue;
      }

      const idleDuration = now.getTime() - status.lastActiveAt.getTime();
      const ttlMs = status.ttlSeconds * 1000;

      if (idleDuration > ttlMs) {
        try {
          const result = await this.hibernateEnvironment(tenantId, status.envId);
          hibernated.push(result);
        } catch {
          status.state = 'error';
          status.statusMessage = `Auto-hibernate failed: exceeded TTL of ${status.ttlSeconds}s`;
          status.lastCheckedAt = now;
          await this.saveStatus(status);
        }
      }
    }

    return hibernated;
  }

  // ==================== Environment Status ====================

  /**
   * Get status for a specific environment
   */
  async getEnvironmentStatus(
    tenantId: string,
    envId: string
  ): Promise<EnvironmentStatus> {
    if (!tenantId || !envId) {
      throw new EnvironmentExecutorServiceError(
        'tenantId and envId are required',
        'INVALID_INPUT'
      );
    }

    return this.getStatus(tenantId, envId);
  }

  /**
   * Get all environment statuses for a tenant
   */
  async getAllEnvironmentStatuses(tenantId: string): Promise<EnvironmentStatus[]> {
    const entities = await this.repository.findByTenant(tenantId);
    return entities.map(e => this.entityToDomain(e));
  }

  /**
   * Set or update TTL for an environment
   */
  async setEnvironmentTTL(
    tenantId: string,
    envId: string,
    ttlSeconds: number
  ): Promise<EnvironmentStatus> {
    if (!tenantId || !envId) {
      throw new EnvironmentExecutorServiceError(
        'tenantId and envId are required',
        'INVALID_INPUT'
      );
    }
    if (ttlSeconds < 0) {
      throw new EnvironmentExecutorServiceError(
        'ttlSeconds must be non-negative',
        'INVALID_INPUT'
      );
    }

    const status = await this.getStatus(tenantId, envId);
    status.ttlSeconds = ttlSeconds;
    status.lastCheckedAt = new Date();
    await this.saveStatus(status);
    return status;
  }

  /**
   * Configure K8s settings for an environment (namespace, deployment, etc.)
   * This enables real K8s scale-down/scale-up operations for hibernation.
   */
  async configureK8s(
    tenantId: string,
    envId: string,
    k8sConfig: EnvironmentK8sConfig
  ): Promise<EnvironmentStatus> {
    if (!tenantId || !envId) {
      throw new EnvironmentExecutorServiceError(
        'tenantId and envId are required',
        'INVALID_INPUT'
      );
    }
    if (!k8sConfig.deploymentName) {
      throw new EnvironmentExecutorServiceError(
        'deploymentName is required in k8sConfig',
        'INVALID_INPUT'
      );
    }

    const status = await this.getStatus(tenantId, envId);
    status.k8sConfig = k8sConfig;
    status.lastCheckedAt = new Date();

    // Verify K8s connectivity if trying to configure
    if (this.isK8sAvailable()) {
      status.statusMessage = `K8s configured: ${k8sConfig.deploymentName} in ${k8sConfig.namespace || 'default'}`;
      logger.info(`[EnvironmentExecutorService] K8s configured for ${envId}: ${k8sConfig.deploymentName}`);
    } else {
      status.statusMessage = `K8s config stored but K8s client unavailable (will use simulation)`;
      logger.warn(`[EnvironmentExecutorService] K8s config stored for ${envId} but client unavailable`);
    }

    await this.saveStatus(status);
    return status;
  }

  /**
   * Get K8s scale operation history for an environment
   * Returns the current replica state and previous state
   */
  async getK8sScaleInfo(
    tenantId: string,
    envId: string
  ): Promise<{
    currentReplicas: number;
    previousReplicas?: number;
    originalReplicaCount?: number;
    k8sConfig?: EnvironmentK8sConfig;
    k8sAvailable: boolean;
  }> {
    if (!tenantId || !envId) {
      throw new EnvironmentExecutorServiceError(
        'tenantId and envId are required',
        'INVALID_INPUT'
      );
    }

    const status = await this.getStatus(tenantId, envId);
    return {
      currentReplicas: status.state === 'hibernated' ? 0 : (status.previousReplicas || 1),
      previousReplicas: status.previousReplicas,
      originalReplicaCount: status.originalReplicaCount,
      k8sConfig: status.k8sConfig,
      k8sAvailable: this.isK8sAvailable(),
    };
  }

  /**
   * Record activity for an environment (resets idle timer)
   */
  async recordActivity(tenantId: string, envId: string): Promise<EnvironmentStatus> {
    if (!tenantId || !envId) {
      throw new EnvironmentExecutorServiceError(
        'tenantId and envId are required',
        'INVALID_INPUT'
      );
    }

    const status = await this.getStatus(tenantId, envId);
    status.lastActiveAt = new Date();
    status.lastCheckedAt = new Date();
    if (status.state === 'hibernated') {
      status.state = 'waking';
      status.hibernatedAt = undefined;
      status.statusMessage = 'Activity detected, waking up';
    }
    await this.saveStatus(status);
    return status;
  }

  // ==================== Internal Helpers ====================

  /**
   * Get or create a status entry for the given tenant+environment
   */
  private async getStatus(tenantId: string, envId: string): Promise<EnvironmentStatus> {
    const existing = await this.repository.findByTenantAndEnv(tenantId, envId);
    if (existing) {
      return this.entityToDomain(existing);
    }

    // Create default status for unknown environment
    const now = new Date();
    const input: CreateEnvironmentExecutorStateInput = {
      id: `env-state-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      envId,
      tenantId,
      state: 'active',
      lastActiveAt: now,
      lastCheckedAt: now,
      statusMessage: 'Environment initialized',
    };

    const entity = await this.repository.upsert(input);
    return this.entityToDomain(entity);
  }

  /**
   * Persist status to the repository
   */
  private async saveStatus(status: EnvironmentStatus): Promise<void> {
    const input: CreateEnvironmentExecutorStateInput & {
      hibernatedAt?: Date;
      wakeScheduledAt?: Date;
    } = {
      id: `env-state-${status.envId}-${status.tenantId}`,
      envId: status.envId,
      tenantId: status.tenantId,
      state: status.state,
      lastActiveAt: status.lastActiveAt,
      hibernatedAt: status.hibernatedAt,
      wakeScheduledAt: status.wakeScheduledAt,
      ttlSeconds: status.ttlSeconds,
      lastCheckedAt: status.lastCheckedAt,
      statusMessage: status.statusMessage,
      previousReplicas: status.previousReplicas,
      originalReplicaCount: status.originalReplicaCount,
      k8sNamespace: status.k8sConfig?.namespace,
      k8sDeploymentName: status.k8sConfig?.deploymentName,
      k8sLabelSelector: status.k8sConfig?.labelSelector,
      k8sScaleStatefulSets: status.k8sConfig?.scaleStatefulSets,
      k8sHpaName: status.k8sConfig?.hpaName,
    };

    await this.repository.upsert(input);
  }

  /**
   * Convert repository entity to domain model
   */
  private entityToDomain(entity: any): EnvironmentStatus {
    const k8sConfig: EnvironmentK8sConfig | undefined = entity.k8sDeploymentName
      ? {
          namespace: entity.k8sNamespace,
          deploymentName: entity.k8sDeploymentName,
          labelSelector: entity.k8sLabelSelector,
          scaleStatefulSets: entity.k8sScaleStatefulSets,
          hpaName: entity.k8sHpaName,
        }
      : undefined;

    return {
      envId: entity.envId,
      tenantId: entity.tenantId,
      state: entity.state,
      lastActiveAt: entity.lastActiveAt,
      hibernatedAt: entity.hibernatedAt,
      wakeScheduledAt: entity.wakeScheduledAt,
      ttlSeconds: entity.ttlSeconds,
      lastCheckedAt: entity.lastCheckedAt,
      statusMessage: entity.statusMessage,
      previousReplicas: entity.previousReplicas,
      originalReplicaCount: entity.originalReplicaCount,
      k8sConfig,
    };
  }
}
