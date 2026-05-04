// orion-platform-service/src/services/disaster-recovery/FailoverExecutor.ts
import { KubeConfig, CoreV1Api, NetworkingV1Api } from '@kubernetes/client-node';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface FailoverExecutorConfig {
  namespace: string;
  serviceName: string;
  ingressName?: string;
  dnsUpdateScript?: string;
}

export interface FailoverStepResult {
  step: string;
  success: boolean;
  durationMs: number;
  error?: string;
}

export class FailoverExecutor {
  private k8sApi: CoreV1Api | null = null;
  private networkingApi: NetworkingV1Api | null = null;
  private available: boolean = false;

  constructor() {
    this.initializeK8sClient();
  }

  private initializeK8sClient(): void {
    try {
      const kubeConfig = new KubeConfig();
      kubeConfig.loadFromDefault();

      this.k8sApi = kubeConfig.makeApiClient(CoreV1Api);
      this.networkingApi = kubeConfig.makeApiClient(NetworkingV1Api);
      this.available = true;

      logger.info('[FailoverExecutor] K8s client initialized');
    } catch (error) {
      logger.warn(`[FailoverExecutor] K8s client initialization failed: ${error}`);
      this.available = false;
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  /**
   * Stop traffic to primary service by scaling to 0
   */
  async stopTrafficToPrimary(config: FailoverExecutorConfig): Promise<FailoverStepResult> {
    const startTime = Date.now();

    if (!this.available || !this.k8sApi) {
      return {
        step: 'stop_traffic_primary',
        success: false,
        durationMs: 0,
        error: 'K8s API not available',
      };
    }

    try {
      // Scale down primary deployment/service
      const deploymentName = config.serviceName;

      // Get current deployment
      const deployment = await this.k8sApi.readNamespacedDeployment(
        deploymentName,
        config.namespace
      );

      // Scale to 0 replicas
      await this.k8sApi.replaceNamespacedDeploymentScale(
        deploymentName,
        config.namespace,
        {
          spec: {
            replicas: 0,
          },
        }
      );

      logger.info(`[FailoverExecutor] Stopped traffic to ${deploymentName} in ${config.namespace}`);

      return {
        step: 'stop_traffic_primary',
        success: true,
        durationMs: Date.now() - startTime,
      };
    } catch (error: any) {
      logger.error(`[FailoverExecutor] Failed to stop traffic: ${error}`);
      return {
        step: 'stop_traffic_primary',
        success: false,
        durationMs: Date.now() - startTime,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Switch traffic to standby by updating service selector
   */
  async switchTrafficToStandby(config: FailoverExecutorConfig, standbyServiceName: string): Promise<FailoverStepResult> {
    const startTime = Date.now();

    if (!this.available || !this.k8sApi) {
      return {
        step: 'switch_traffic_standby',
        success: false,
        durationMs: 0,
        error: 'K8s API not available',
      };
    }

    try {
      // Update service to point to standby pods
      const service = await this.k8sApi.readNamespacedService(
        config.serviceName,
        config.namespace
      );

      // Update selector to point to standby deployment
      await this.k8sApi.replaceNamespacedService(
        config.serviceName,
        config.namespace,
        {
          ...service.body,
          spec: {
            ...service.body.spec,
            selector: {
              app: standbyServiceName,
            },
          },
        }
      );

      logger.info(`[FailoverExecutor] Switched traffic to ${standbyServiceName}`);

      return {
        step: 'switch_traffic_standby',
        success: true,
        durationMs: Date.now() - startTime,
      };
    } catch (error: any) {
      logger.error(`[FailoverExecutor] Failed to switch traffic: ${error}`);
      return {
        step: 'switch_traffic_standby',
        success: false,
        durationMs: Date.now() - startTime,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Update Ingress to route to standby service
   */
  async updateIngress(config: FailoverExecutorConfig, standbyServiceName: string): Promise<FailoverStepResult> {
    const startTime = Date.now();

    if (!this.available || !this.networkingApi || !config.ingressName) {
      return {
        step: 'update_ingress',
        success: false,
        durationMs: 0,
        error: 'K8s networking API not available or ingress not configured',
      };
    }

    try {
      const ingress = await this.networkingApi.readNamespacedIngress(
        config.ingressName,
        config.namespace
      );

      // Update backend service name to standby
      const updatedRules = ingress.body.spec?.rules?.map(rule => ({
        ...rule,
        http: {
          paths: rule.http?.paths?.map(path => ({
            ...path,
            backend: {
              service: {
                name: standbyServiceName,
                port: path.backend.service?.port,
              },
            },
          })),
        },
      }));

      await this.networkingApi.replaceNamespacedIngress(
        config.ingressName,
        config.namespace,
        {
          ...ingress.body,
          spec: {
            ...ingress.body.spec,
            rules: updatedRules,
          },
        }
      );

      logger.info(`[FailoverExecutor] Updated ingress ${config.ingressName} to ${standbyServiceName}`);

      return {
        step: 'update_ingress',
        success: true,
        durationMs: Date.now() - startTime,
      };
    } catch (error: any) {
      logger.error(`[FailoverExecutor] Failed to update ingress: ${error}`);
      return {
        step: 'update_ingress',
        success: false,
        durationMs: Date.now() - startTime,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Scale standby deployment to desired replicas
   */
  async scaleStandby(config: FailoverExecutorConfig, standbyServiceName: string, replicas: number): Promise<FailoverStepResult> {
    const startTime = Date.now();

    if (!this.available || !this.k8sApi) {
      return {
        step: 'scale_standby',
        success: false,
        durationMs: 0,
        error: 'K8s API not available',
      };
    }

    try {
      await this.k8sApi.replaceNamespacedDeploymentScale(
        standbyServiceName,
        config.namespace,
        {
          spec: { replicas },
        }
      );

      logger.info(`[FailoverExecutor] Scaled ${standbyServiceName} to ${replicas} replicas`);

      return {
        step: 'scale_standby',
        success: true,
        durationMs: Date.now() - startTime,
      };
    } catch (error: any) {
      logger.error(`[FailoverExecutor] Failed to scale standby: ${error}`);
      return {
        step: 'scale_standby',
        success: false,
        durationMs: Date.now() - startTime,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Verify service pods are ready
   */
  async verifyPodsReady(config: FailoverExecutorConfig, serviceName: string, minReadyPods: number = 1): Promise<boolean> {
    if (!this.available || !this.k8sApi) {
      return false;
    }

    try {
      const pods = await this.k8sApi.listNamespacedPod(
        config.namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        `app=${serviceName}`
      );

      const readyPods = pods.body.items.filter(pod =>
        pod.status?.phase === 'Running' &&
        pod.status?.conditions?.some(c => c.type === 'Ready' && c.status === 'True')
      );

      const ready = readyPods.length >= minReadyPods;

      logger.info(`[FailoverExecutor] Pod readiness check: ${readyPods.length}/${minReadyPods} ready`);

      return ready;
    } catch (error) {
      logger.error(`[FailoverExecutor] Failed to check pod readiness: ${error}`);
      return false;
    }
  }

  /**
   * Rollback - switch traffic back to primary
   */
  async rollback(config: FailoverExecutorConfig, primaryServiceName: string): Promise<FailoverStepResult[]> {
    const results: FailoverStepResult[] = [];

    // Scale primary back up
    const scaleResult = await this.scaleStandby(config, primaryServiceName, 3);
    results.push(scaleResult);

    if (!scaleResult.success) {
      return results;
    }

    // Wait for pods to be ready
    const ready = await this.verifyPodsReady(config, primaryServiceName, 1);
    if (!ready) {
      results.push({
        step: 'verify_primary_ready',
        success: false,
        durationMs: 0,
        error: 'Primary pods not ready',
      });
      return results;
    }

    // Switch traffic back to primary
    const switchResult = await this.switchTrafficToStandby(config, primaryServiceName);
    results.push(switchResult);

    // Update ingress if configured
    if (config.ingressName) {
      const ingressResult = await this.updateIngress(config, primaryServiceName);
      results.push(ingressResult);
    }

    return results;
  }

  /**
   * Execute full failover sequence
   */
  async executeFailover(config: FailoverExecutorConfig, standbyServiceName: string): Promise<{
    success: boolean;
    steps: FailoverStepResult[];
    totalDurationMs: number;
  }> {
    const startTime = Date.now();
    const steps: FailoverStepResult[] = [];

    // Step 1: Scale standby up first (prepare)
    const scaleResult = await this.scaleStandby(config, standbyServiceName, 3);
    steps.push(scaleResult);

    if (!scaleResult.success) {
      return { success: false, steps, totalDurationMs: Date.now() - startTime };
    }

    // Step 2: Wait for standby pods ready
    const standbyReady = await this.verifyPodsReady(config, standbyServiceName, 2);
    steps.push({
      step: 'verify_standby_ready',
      success: standbyReady,
      durationMs: 0,
      error: standbyReady ? undefined : 'Standby pods not ready',
    });

    if (!standbyReady) {
      return { success: false, steps, totalDurationMs: Date.now() - startTime };
    }

    // Step 3: Stop traffic to primary
    const stopResult = await this.stopTrafficToPrimary(config);
    steps.push(stopResult);

    // Step 4: Switch traffic to standby
    const switchResult = await this.switchTrafficToStandby(config, standbyServiceName);
    steps.push(switchResult);

    // Step 5: Update ingress
    if (config.ingressName) {
      const ingressResult = await this.updateIngress(config, standbyServiceName);
      steps.push(ingressResult);
    }

    // Determine overall success
    const criticalStepsFailed = steps.filter(s =>
      ['scale_standby', 'verify_standby_ready', 'switch_traffic_standby'].includes(s.step) && !s.success
    );

    return {
      success: criticalStepsFailed.length === 0,
      steps,
      totalDurationMs: Date.now() - startTime,
    };
  }
}

// Export singleton
export const failoverExecutor = new FailoverExecutor();