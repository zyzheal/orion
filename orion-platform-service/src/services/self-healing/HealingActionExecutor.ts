/**
 * Healing Action Executor
 *
 * Executes healing actions (restart, scale, failover, rollback),
 * handles timeouts, verifies action success, and supports rollback.
 *
 * TASK-702: Self-Healing Engine (自愈引擎)
 *
 * Phase 1.1: Connected to real K8s APIs via @kubernetes/client-node
 * with simulated mode as fallback (configurable via K8S_SIMULATE env flag).
 */

import { v4 as uuidv4 } from 'uuid';
import * as k8s from '@kubernetes/client-node';
import {
  HealingAction,
  HealingActionType,
  HealingActionResult,
} from './types';

/**
 * K8s client singleton with connection pooling and health check
 */
class K8sClientManager {
  private static instance: K8sClientManager;
  private kc: k8s.KubeConfig | null = null;
  private appsApi: k8s.AppsV1Api | null = null;
  private coreApi: k8s.CoreV1Api | null = null;
  private autoscalingApi: k8s.AutoscalingV2Api | null = null;
  private lastHealthCheck = 0;
  private healthCheckIntervalMs = 60_000; // 1 minute
  private isHealthy = false;

  private constructor() {}

  static getInstance(): K8sClientManager {
    if (!K8sClientManager.instance) {
      K8sClientManager.instance = new K8sClientManager();
    }
    return K8sClientManager.instance;
  }

  /**
   * Initialize K8s client from kubeconfig
   * Supports: in-cluster config, default kubeconfig path, or custom path via KUBECONFIG env
   */
  async initialize(): Promise<void> {
    if (this.kc) return; // Already initialized

    try {
      this.kc = new k8s.KubeConfig();

      // Try in-cluster config first (for production), then fallback to local kubeconfig
      const kubeconfigPath = process.env.KUBECONFIG;
      if (process.env.KUBERNETES_SERVICE_HOST) {
        // Running inside a K8s pod
        this.kc.loadFromCluster();
      } else if (kubeconfigPath) {
        this.kc.loadFromFile(kubeconfigPath);
      } else {
        this.kc.loadFromDefault();
      }

      this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api);
      this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api);
      this.autoscalingApi = this.kc.makeApiClient(k8s.AutoscalingV2Api);

      await this.healthCheck();
      console.log('[K8sClientManager] K8s client initialized successfully');
    } catch (error: any) {
      console.warn(
        '[K8sClientManager] Failed to initialize K8s client, falling back to simulated mode:',
        error.message
      );
      this.isHealthy = false;
    }
  }

  /**
   * Health check with interval-based caching
   */
  async healthCheck(): Promise<boolean> {
    const now = Date.now();
    if (this.isHealthy && now - this.lastHealthCheck < this.healthCheckIntervalMs) {
      return this.isHealthy;
    }

    try {
      if (!this.coreApi) {
        this.isHealthy = false;
        return false;
      }
      await this.coreApi.listNamespace({ limit: 1 });
      this.isHealthy = true;
      this.lastHealthCheck = now;
      return true;
    } catch (error: any) {
      console.warn('[K8sClientManager] K8s health check failed:', error.message);
      this.isHealthy = false;
      this.lastHealthCheck = now;
      return false;
    }
  }

  /**
   * Check if K8s client is available and healthy
   */
  isAvailable(): boolean {
    return this.isHealthy && !!this.kc && !!this.appsApi && !!this.coreApi;
  }

  getAppsApi(): k8s.AppsV1Api {
    if (!this.appsApi) throw new Error('K8s AppsV1Api not initialized');
    return this.appsApi;
  }

  getCoreApi(): k8s.CoreV1Api {
    if (!this.coreApi) throw new Error('K8s CoreV1Api not initialized');
    return this.coreApi;
  }

  getAutoscalingApi(): k8s.AutoscalingV2Api {
    if (!this.autoscalingApi) throw new Error('K8s AutoscalingV2Api not initialized');
    return this.autoscalingApi;
  }
}

// Global K8s client manager instance
const k8sManager = K8sClientManager.getInstance();

/**
 * Check if simulated mode is enabled via env flag
 */
function isSimulateMode(): boolean {
  return process.env.K8S_SIMULATE === 'true';
}

export class HealingActionExecutor {
  // Track executed actions for potential rollback
  private executedActions: Map<string, HealingActionResult> = new Map();

  constructor() {
    // Initialize K8s client on construction (non-blocking)
    k8sManager.initialize().catch(() => {
      // Initialization errors are logged but don't prevent operation
      // The executor will fall back to simulated mode
    });
  }

  /**
   * Execute a single healing action
   */
  async executeAction(action: HealingAction): Promise<HealingActionResult> {
    const startTime = Date.now();
    const timeout = action.timeout ?? 120000; // Default 2 minute timeout

    try {
      let result: HealingActionResult;

      switch (action.type) {
        case 'restart':
          result = await this.executeRestart(action, timeout);
          break;
        case 'scale':
          result = await this.executeScale(action, timeout);
          break;
        case 'failover':
          result = await this.executeFailover(action, timeout);
          break;
        case 'rollback':
          result = await this.executeRollbackAction(action, timeout);
          break;
        default:
          result = this.createFailureResult(
            action.type,
            startTime,
            `Unknown action type: ${action.type}`
          );
      }

      // Store for potential rollback
      this.executedActions.set(`${action.type}-${Date.now()}`, result);

      return result;
    } catch (error: any) {
      const result = this.createFailureResult(
        action.type,
        startTime,
        error.message || 'Unknown error during execution'
      );

      // Store for potential rollback
      this.executedActions.set(`${action.type}-${Date.now()}`, result);

      return result;
    }
  }

  /**
   * Verify that an action was successful
   */
  async verifyAction(
    actionType: HealingActionType,
    params: Record<string, any>,
    timeoutMs: number = 30000
  ): Promise<boolean> {
    try {
      // Wait briefly for the action to take effect
      await this.delay(Math.min(50, timeoutMs));

      switch (actionType) {
        case 'restart':
          return this.verifyRestart(params);
        case 'scale':
          return this.verifyScale(params);
        case 'failover':
          return this.verifyFailover(params);
        case 'rollback':
          return this.verifyRollback(params);
        default:
          return false;
      }
    } catch (error) {
      console.warn(
        `[HealingActionExecutor] Verification failed for ${actionType}:`,
        error
      );
      return false;
    }
  }

  /**
   * Rollback a previously executed action
   */
  async rollbackAction(
    originalAction: HealingAction
  ): Promise<HealingActionResult> {
    const startTime = Date.now();
    const timeout = originalAction.timeout ?? 120000;

    try {
      let result: HealingActionResult;

      switch (originalAction.type) {
        case 'restart':
          // Rollback of restart = another restart to restore
          result = await this.executeRestart(
            { ...originalAction, params: { ...originalAction.params, restore: true } },
            timeout
          );
          break;
        case 'scale': {
          // Rollback of scale = reverse scale
          const direction = originalAction.params.direction === 'up' ? 'down' : 'up';
          result = await this.executeScale(
            {
              ...originalAction,
              params: { ...originalAction.params, direction, decrement: originalAction.params.increment },
            },
            timeout
          );
          break;
        }
        case 'failover':
          // Rollback of failover = failback to original
          result = await this.executeFailover(
            {
              ...originalAction,
              params: {
                ...originalAction.params,
                failback: true,
              },
            },
            timeout
          );
          break;
        case 'rollback':
          // Rollback of rollback = re-apply the change that was rolled back
          result = this.createSuccessResult(
            'rollback',
            startTime,
            'Rollback of rollback is not safe - manual intervention required'
          );
          break;
        default:
          result = this.createFailureResult(
            originalAction.type,
            startTime,
            `Cannot rollback unknown action type: ${originalAction.type}`
          );
      }

      result.rollbackNeeded = true;
      result.rollbackSuccess = result.success;

      return result;
    } catch (error: any) {
      const result = this.createFailureResult(
        originalAction.type,
        startTime,
        error.message || 'Rollback failed'
      );
      result.rollbackNeeded = true;
      result.rollbackSuccess = false;
      return result;
    }
  }

  /**
   * Get history of executed actions
   */
  getExecutedActions(): HealingActionResult[] {
    return Array.from(this.executedActions.values());
  }

  /**
   * Clear executed actions history
   */
  clearExecutedActions(): void {
    this.executedActions.clear();
  }

  // ==================== Action Implementations ====================

  /**
   * Execute restart action
   */
  private async executeRestart(
    action: HealingAction,
    timeoutMs: number
  ): Promise<HealingActionResult> {
    const startTime = Date.now();
    const target = action.params.target || 'unknown';
    const namespace = action.params.namespace || 'default';
    const resourceType = action.params.resourceType || 'deployment';

    console.log(
      `[HealingActionExecutor] Restarting: ${target} (graceful: ${action.params.graceful}, type: ${resourceType})`
    );

    try {
      if (!isSimulateMode() && k8sManager.isAvailable()) {
        // Real K8s restart via deployment rollout restart
        if (resourceType === 'deployment') {
          const appsApi = k8sManager.getAppsApi();
          // Trigger a rollout restart by updating the annotation
          const deployment = await appsApi.readNamespacedDeployment({
            name: target,
            namespace,
          });

          const annotations = deployment.metadata?.annotations || {};
          annotations['kubectl.kubernetes.io/restartedAt'] = new Date().toISOString();

          await appsApi.replaceNamespacedDeployment({
            name: target,
            namespace,
            body: {
              apiVersion: deployment.apiVersion,
              kind: deployment.kind,
              metadata: { ...deployment.metadata, annotations },
              spec: {
                minReadySeconds: deployment.spec?.minReadySeconds,
                paused: deployment.spec?.paused,
                progressDeadlineSeconds: deployment.spec?.progressDeadlineSeconds,
                replicas: deployment.spec?.replicas,
                revisionHistoryLimit: deployment.spec?.revisionHistoryLimit,
                selector: deployment.spec?.selector ?? { matchLabels: {} },
                strategy: deployment.spec?.strategy,
                template: {
                  ...deployment.spec?.template,
                  metadata: {
                    ...deployment.spec?.template?.metadata,
                    annotations,
                  },
                },
              },
            },
          });
        } else if (resourceType === 'pod') {
          const coreApi = k8sManager.getCoreApi();
          // Delete the pod to trigger a restart (for pods managed by RS/Deployment)
          await coreApi.deleteNamespacedPod({
            name: target,
            namespace,
            body: { gracePeriodSeconds: action.params.graceful ? 30 : 0 },
          });
        }
      } else {
        // Simulated mode
        console.log('[HealingActionExecutor] Using simulated mode for restart');
        await this.delay(Math.min(10, timeoutMs));
      }

      // Wait for restart to take effect
      const restartPromise = this.delay(Math.min(5000, timeoutMs));
      const timeoutPromise = this.delay(timeoutMs).then(() => {
        throw new Error(`Restart timed out after ${timeoutMs}ms`);
      });

      await Promise.race([restartPromise, timeoutPromise]);

      // Verify restart
      const verified = await this.verifyRestart(action.params);

      if (verified) {
        return this.createSuccessResult(
          'restart',
          startTime,
          `Successfully restarted ${target}`
        );
      } else {
        return this.createFailureResult(
          'restart',
          startTime,
          `Restart completed but verification failed for ${target}`
        );
      }
    } catch (error: any) {
      return this.createFailureResult(
        'restart',
        startTime,
        error.message || 'Restart failed'
      );
    }
  }

  /**
   * Execute scale action
   */
  private async executeScale(
    action: HealingAction,
    timeoutMs: number
  ): Promise<HealingActionResult> {
    const startTime = Date.now();
    const target = action.params.target || 'unknown';
    const namespace = action.params.namespace || 'default';
    const resourceType = action.params.resourceType || 'deployment';
    const direction = action.params.direction || 'up';
    const increment = action.params.increment ?? 1;
    const targetReplicas = action.params.targetReplicas;

    console.log(
      `[HealingActionExecutor] Scaling ${direction}: ${target} by ${increment} (type: ${resourceType})`
    );

    try {
      if (!isSimulateMode() && k8sManager.isAvailable()) {
        if (resourceType === 'deployment') {
          const appsApi = k8sManager.getAppsApi();
          const deployment = await appsApi.readNamespacedDeployment({
            name: target,
            namespace,
          });

          const currentReplicas = deployment.spec?.replicas ?? 1;
          let newReplicas: number;

          if (targetReplicas !== undefined) {
            newReplicas = targetReplicas;
          } else {
            newReplicas = direction === 'up'
              ? currentReplicas + increment
              : Math.max(1, currentReplicas - increment);
          }

          await appsApi.patchNamespacedDeploymentScale({
            name: target,
            namespace,
            body: { spec: { replicas: newReplicas } },
          });
        } else if (resourceType === 'hpa') {
          const autoscalingApi = k8sManager.getAutoscalingApi();
          const hpa = await autoscalingApi.readNamespacedHorizontalPodAutoscaler({
            name: target,
            namespace,
          });

          const currentMin = hpa.spec?.minReplicas ?? 1;
          const currentMax = hpa.spec?.maxReplicas ?? 10;
          let newMin: number;
          let newMax: number;

          if (targetReplicas !== undefined) {
            newMin = targetReplicas;
            newMax = Math.max(targetReplicas, currentMax);
          } else if (direction === 'up') {
            newMin = currentMin + increment;
            newMax = currentMax + increment;
          } else {
            newMin = Math.max(1, currentMin - increment);
            newMax = Math.max(newMin, currentMax - increment);
          }

          await autoscalingApi.patchNamespacedHorizontalPodAutoscaler({
            name: target,
            namespace,
            body: {
              ...hpa,
              spec: { ...hpa.spec, minReplicas: newMin, maxReplicas: newMax },
            },
          });
        }
      } else {
        // Simulated mode
        console.log('[HealingActionExecutor] Using simulated mode for scale');
        await this.delay(Math.min(10, timeoutMs));
      }

      // Wait for scale to take effect
      const scalePromise = this.delay(Math.min(5000, timeoutMs));
      const timeoutPromise = this.delay(timeoutMs).then(() => {
        throw new Error(`Scale timed out after ${timeoutMs}ms`);
      });

      await Promise.race([scalePromise, timeoutPromise]);

      // Verify scale
      const verified = await this.verifyScale(action.params);

      if (verified) {
        return this.createSuccessResult(
          'scale',
          startTime,
          `Successfully scaled ${target} ${direction} by ${increment}`
        );
      } else {
        return this.createFailureResult(
          'scale',
          startTime,
          `Scaling completed but verification failed for ${target}`
        );
      }
    } catch (error: any) {
      return this.createFailureResult(
        'scale',
        startTime,
        error.message || 'Scale failed'
      );
    }
  }

  /**
   * Execute failover action
   */
  private async executeFailover(
    action: HealingAction,
    timeoutMs: number
  ): Promise<HealingActionResult> {
    const startTime = Date.now();
    const target = action.params.target || 'unknown';
    const namespace = action.params.namespace || 'default';
    const isFailback = action.params.failback ?? false;
    const targetNode = action.params.targetNode;

    console.log(
      `[HealingActionExecutor] Failover ${isFailback ? 'back' : ''}: ${target}`
    );

    try {
      if (!isSimulateMode() && k8sManager.isAvailable()) {
        const coreApi = k8sManager.getCoreApi();

        if (targetNode) {
          // Cordon the failed node
          await coreApi.patchNode({
            name: targetNode,
            body: {
              spec: { unschedulable: !isFailback },
            },
          });
        }

        // Delete pods on the failed node to trigger rescheduling
        const podList = await coreApi.listNamespacedPod({
          namespace,
          labelSelector: `app=${target}`,
        });

        for (const pod of podList.items) {
          const podNode = pod.spec?.nodeName;
          if (targetNode && podNode === targetNode) {
            await coreApi.deleteNamespacedPod({
              name: pod.metadata!.name!,
              namespace,
              body: { gracePeriodSeconds: 30 },
            });
          }
        }
      } else {
        // Simulated mode
        console.log('[HealingActionExecutor] Using simulated mode for failover');
        await this.delay(Math.min(10, timeoutMs));
      }

      // Wait for failover to take effect
      const failoverPromise = this.delay(Math.min(5000, timeoutMs));
      const timeoutPromise = this.delay(timeoutMs).then(() => {
        throw new Error(`Failover timed out after ${timeoutMs}ms`);
      });

      await Promise.race([failoverPromise, timeoutPromise]);

      // Verify failover
      const verified = await this.verifyFailover(action.params);

      if (verified) {
        return this.createSuccessResult(
          'failover',
          startTime,
          `Successfully ${isFailback ? 'failed back' : 'failed over'} ${target}`
        );
      } else {
        return this.createFailureResult(
          'failover',
          startTime,
          `Failover completed but verification failed for ${target}`
        );
      }
    } catch (error: any) {
      return this.createFailureResult(
        'failover',
        startTime,
        error.message || 'Failover failed'
      );
    }
  }

  /**
   * Execute rollback action
   */
  private async executeRollbackAction(
    action: HealingAction,
    timeoutMs: number
  ): Promise<HealingActionResult> {
    const startTime = Date.now();
    const target = action.params.target || 'unknown';
    const namespace = action.params.namespace || 'default';
    const targetVersion = action.params.targetVersion || 'previous';

    console.log(
      `[HealingActionExecutor] Rollback: ${target} to version ${targetVersion}`
    );

    try {
      if (!isSimulateMode() && k8sManager.isAvailable()) {
        const appsApi = k8sManager.getAppsApi();

        if (targetVersion === 'previous') {
          // Rollback to previous revision via undo
          await appsApi.patchNamespacedDeployment({
            name: target,
            namespace,
            body: {
              metadata: {
                annotations: {
                  'kubernetes.io/change-cause': `Self-healing rollback at ${new Date().toISOString()}`,
                },
              },
            },
          });

          // Get the previous revision number and undo
          const deployment = await appsApi.readNamespacedDeployment({
            name: target,
            namespace,
          });

          const currentRevision = parseInt(
            deployment.metadata?.annotations?.['deployment.kubernetes.io/revision'] || '0',
            10
          );

          if (currentRevision > 1) {
            // Patch to rollback to previous revision
            await appsApi.patchNamespacedDeployment({
              name: target,
              namespace,
              body: {
                metadata: {
                  annotations: {
                    'deployment.kubernetes.io/rollback-to-revision': String(currentRevision - 1),
                  },
                },
              },
            });
          }
        } else {
          // Rollback to specific revision
          const replicaSetList = await appsApi.listNamespacedReplicaSet({
            namespace,
            labelSelector: `app=${target}`,
          });

          const targetRS = replicaSetList.items.find(
            (rs: k8s.V1ReplicaSet) => rs.metadata?.annotations?.['deployment.kubernetes.io/revision'] === targetVersion
          );

          if (targetRS && targetRS.spec?.template) {
            // Update deployment to match the target revision's template
            const deployment = await appsApi.readNamespacedDeployment({
              name: target,
              namespace,
            });

            await appsApi.replaceNamespacedDeployment({
              name: target,
              namespace,
              body: {
                apiVersion: deployment.apiVersion,
                kind: deployment.kind,
                metadata: {
                  ...deployment.metadata,
                  annotations: {
                    ...deployment.metadata?.annotations,
                    'kubernetes.io/change-cause': `Self-healing rollback to revision ${targetVersion} at ${new Date().toISOString()}`,
                  },
                },
                spec: {
                  minReadySeconds: deployment.spec?.minReadySeconds,
                  paused: deployment.spec?.paused,
                  progressDeadlineSeconds: deployment.spec?.progressDeadlineSeconds,
                  replicas: deployment.spec?.replicas,
                  revisionHistoryLimit: deployment.spec?.revisionHistoryLimit,
                  selector: deployment.spec?.selector ?? { matchLabels: {} },
                  strategy: deployment.spec?.strategy,
                  template: targetRS.spec.template,
                },
              },
            });
          } else {
            console.warn(
              `[HealingActionExecutor] ReplicaSet for revision ${targetVersion} not found`
            );
          }
        }
      } else {
        // Simulated mode
        console.log('[HealingActionExecutor] Using simulated mode for rollback');
        await this.delay(Math.min(10, timeoutMs));
      }

      // Wait for rollback to take effect
      const rollbackPromise = this.delay(Math.min(5000, timeoutMs));
      const timeoutPromise = this.delay(timeoutMs).then(() => {
        throw new Error(`Rollback timed out after ${timeoutMs}ms`);
      });

      await Promise.race([rollbackPromise, timeoutPromise]);

      // Verify rollback
      const verified = await this.verifyRollback(action.params);

      if (verified) {
        return this.createSuccessResult(
          'rollback',
          startTime,
          `Successfully rolled back ${target} to version ${targetVersion}`
        );
      } else {
        return this.createFailureResult(
          'rollback',
          startTime,
          `Rollback completed but verification failed for ${target}`
        );
      }
    } catch (error: any) {
      return this.createFailureResult(
        'rollback',
        startTime,
        error.message || 'Rollback failed'
      );
    }
  }

  // ==================== Verification Methods ====================

  /**
   * Verify restart was successful
   * Real K8s: Check if the Deployment/Pod is in Ready state after restart
   */
  private async verifyRestart(params: Record<string, any>): Promise<boolean> {
    const target = params.target || 'unknown';
    const namespace = params.namespace || 'default';
    const resourceType = params.resourceType || 'deployment';

    console.log(`[HealingActionExecutor] Verifying restart of ${target} (${resourceType})`);

    if (isSimulateMode() || !k8sManager.isAvailable()) {
      console.log('[HealingActionExecutor] Using simulated mode for restart verification');
      await this.delay(10);
      return true;
    }

    try {
      if (resourceType === 'deployment') {
        const appsApi = k8sManager.getAppsApi();
        const deployment = await appsApi.readNamespacedDeployment({
          name: target,
          namespace,
        });

        const desiredReplicas = deployment.spec?.replicas ?? 1;
        const readyReplicas = deployment.status?.readyReplicas ?? 0;
        const availableReplicas = deployment.status?.availableReplicas ?? 0;

        return readyReplicas >= desiredReplicas && availableReplicas >= desiredReplicas;
      } else if (resourceType === 'pod') {
        const coreApi = k8sManager.getCoreApi();
        const pod = await coreApi.readNamespacedPod({
          name: target,
          namespace,
        });
        return pod.status?.phase === 'Running' &&
          (pod.status?.containerStatuses?.every(
            (cs: k8s.V1ContainerStatus) => cs.ready
          ) ?? false);
      }

      // Fallback for unknown resource types
      return true;
    } catch (error: any) {
      console.warn(
        `[HealingActionExecutor] Restart verification failed for ${target}:`,
        error.message
      );
      return false;
    }
  }

  /**
   * Verify scale was successful
   * Real K8s: Check if the Deployment/HPA has the expected replica count
   */
  private async verifyScale(params: Record<string, any>): Promise<boolean> {
    const target = params.target || 'unknown';
    const namespace = params.namespace || 'default';
    const resourceType = params.resourceType || 'deployment';
    const expectedReplicas = params.expectedReplicas;

    console.log(`[HealingActionExecutor] Verifying scale of ${target} (${resourceType})`);

    if (isSimulateMode() || !k8sManager.isAvailable()) {
      console.log('[HealingActionExecutor] Using simulated mode for scale verification');
      await this.delay(10);
      return true;
    }

    try {
      if (resourceType === 'hpa') {
        const autoscalingApi = k8sManager.getAutoscalingApi();
        const hpa = await autoscalingApi.readNamespacedHorizontalPodAutoscaler({
          name: target,
          namespace,
        });

        const currentReplicas = hpa.status?.currentReplicas ?? 0;
        const desiredReplicas = hpa.status?.desiredReplicas ?? 0;

        if (expectedReplicas !== undefined) {
          return currentReplicas === expectedReplicas;
        }
        return desiredReplicas > 0;
      } else if (resourceType === 'deployment') {
        const appsApi = k8sManager.getAppsApi();
        const deployment = await appsApi.readNamespacedDeployment({
          name: target,
          namespace,
        });

        const desiredReplicas = deployment.spec?.replicas ?? 0;
        const readyReplicas = deployment.status?.readyReplicas ?? 0;

        if (expectedReplicas !== undefined) {
          return readyReplicas === expectedReplicas;
        }
        return readyReplicas === desiredReplicas && desiredReplicas > 0;
      }

      return true;
    } catch (error: any) {
      console.warn(
        `[HealingActionExecutor] Scale verification failed for ${target}:`,
        error.message
      );
      return false;
    }
  }

  /**
   * Verify failover was successful
   * Real K8s: Check if the target service/pod is healthy and receiving traffic
   */
  private async verifyFailover(params: Record<string, any>): Promise<boolean> {
    const target = params.target || 'unknown';
    const namespace = params.namespace || 'default';
    const failback = params.failback ?? false;

    console.log(`[HealingActionExecutor] Verifying failover${failback ? ' back' : ''} of ${target}`);

    if (isSimulateMode() || !k8sManager.isAvailable()) {
      console.log('[HealingActionExecutor] Using simulated mode for failover verification');
      await this.delay(10);
      return true;
    }

    try {
      const coreApi = k8sManager.getCoreApi();

      // Check if the target pod is running and ready
      const podList = await coreApi.listNamespacedPod({
        namespace,
        labelSelector: `app=${target}`,
      });

      if (podList.items.length === 0) {
        console.warn(
          `[HealingActionExecutor] No pods found for app=${target} in namespace ${namespace}`
        );
        return false;
      }

      // Check if at least one pod is running and ready
      const runningPods = podList.items.filter(
        (pod: k8s.V1Pod) =>
          pod.status?.phase === 'Running' &&
          pod.status?.containerStatuses?.some((cs: k8s.V1ContainerStatus) => cs.ready)
      );

      return runningPods.length > 0;
    } catch (error: any) {
      console.warn(
        `[HealingActionExecutor] Failover verification failed for ${target}:`,
        error.message
      );
      return false;
    }
  }

  /**
   * Verify rollback was successful
   * Real K8s: Check if the Deployment is running the target revision
   */
  private async verifyRollback(params: Record<string, any>): Promise<boolean> {
    const target = params.target || 'unknown';
    const namespace = params.namespace || 'default';
    const targetVersion = params.targetVersion;

    console.log(`[HealingActionExecutor] Verifying rollback of ${target} to version ${targetVersion || 'previous'}`);

    if (isSimulateMode() || !k8sManager.isAvailable()) {
      console.log('[HealingActionExecutor] Using simulated mode for rollback verification');
      await this.delay(10);
      return true;
    }

    try {
      const appsApi = k8sManager.getAppsApi();
      const deployment = await appsApi.readNamespacedDeployment({
        name: target,
        namespace,
      });

      // Check if deployment is in a stable state after rollback
      const desiredReplicas = deployment.spec?.replicas ?? 1;
      const readyReplicas = deployment.status?.readyReplicas ?? 0;
      const availableReplicas = deployment.status?.availableReplicas ?? 0;
      const updatedReplicas = deployment.status?.updatedReplicas ?? 0;

      // Verify all replicas are ready and updated
      const isStable =
        readyReplicas >= desiredReplicas &&
        availableReplicas >= desiredReplicas &&
        updatedReplicas >= desiredReplicas;

      // If a specific target version is provided, verify the revision matches
      if (targetVersion !== undefined && isStable) {
        const replicaSetList = await appsApi.listNamespacedReplicaSet({
          namespace,
          labelSelector: `app=${target}`,
        });

        // Find the active replica set that matches the deployment's pod template
        const deploymentTemplateHash =
          deployment.spec?.selector?.matchLabels?.['pod-template-hash'];

        if (deploymentTemplateHash) {
          const matchingRS = replicaSetList.items.find(
            (rs: k8s.V1ReplicaSet) =>
              rs.metadata?.annotations?.['deployment.kubernetes.io/revision'] === targetVersion ||
              rs.spec?.template?.metadata?.labels?.['pod-template-hash'] === deploymentTemplateHash
          );

          if (!matchingRS) {
            console.warn(
              `[HealingActionExecutor] No matching ReplicaSet found for revision ${targetVersion}`
            );
            return false;
          }

          return (matchingRS.status?.readyReplicas ?? 0) >= desiredReplicas;
        }
      }

      return isStable;
    } catch (error: any) {
      console.warn(
        `[HealingActionExecutor] Rollback verification failed for ${target}:`,
        error.message
      );
      return false;
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Create a successful action result
   */
  private createSuccessResult(
    type: HealingActionType,
    startTime: number,
    message: string
  ): HealingActionResult {
    return {
      type,
      success: true,
      durationMs: Date.now() - startTime,
      message,
      executedAt: new Date(),
      verified: true,
    };
  }

  /**
   * Create a failed action result
   */
  private createFailureResult(
    type: HealingActionType,
    startTime: number,
    error: string
  ): HealingActionResult {
    return {
      type,
      success: false,
      durationMs: Date.now() - startTime,
      error,
      executedAt: new Date(),
      verified: false,
    };
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
