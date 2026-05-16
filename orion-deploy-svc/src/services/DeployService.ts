import type {
  CreateDeploymentRequest,
  Deployment,
  DeploymentStatus,
  ListDeploymentsQuery,
} from "../types/deploy";
import { DeploymentStatus as DS, DeploymentStrategy } from "../types/deploy";
import { K8sClientService } from "./K8sClientService";

/** Valid state transitions for deployments */
const VALID_TRANSITIONS: Record<DeploymentStatus, DeploymentStatus[]> = {
  [DS.PENDING]: [DS.QUEUED, DS.DEPLOYING, DS.CANCELLED],
  [DS.QUEUED]: [DS.DEPLOYING, DS.CANCELLED],
  [DS.DEPLOYING]: [DS.DEPLOYED, DS.FAILED, DS.ROLLED_BACK, DS.CANCELLED],
  [DS.DEPLOYED]: [DS.ROLLED_BACK],
  [DS.FAILED]: [DS.ROLLED_BACK],
  [DS.ROLLED_BACK]: [],
  [DS.CANCELLED]: [],
};

/**
 * Service responsible for managing deployments.
 *
 * Dependencies:
 * - orion-pipeline-svc: Trigger pipeline execution for deployments
 * - orion-monitor-svc: Subscribe to deployment health metrics
 * - orion-platform-core: Validate tenant and project existence
 */
export class DeployService {
  // In-memory store (replace with DB in production)
  private deployments = new Map<string, Deployment>();
  private k8sClient: K8sClientService;

  constructor(options?: { kubeconfig?: string; defaultNamespace?: string }) {
    this.k8sClient = new K8sClientService({
      kubeconfig: options?.kubeconfig,
      defaultNamespace: options?.defaultNamespace,
    });
  }

  /**
   * Create a new deployment record and initiate the deployment process
   */
  async createDeployment(
    tenantId: string,
    deployedBy: string,
    request: CreateDeploymentRequest,
  ): Promise<Deployment> {
    const id = `deploy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const deployment: Deployment = {
      id,
      tenantId,
      projectId: request.projectId,
      environmentId: request.environmentId,
      strategy: request.strategy || DeploymentStrategy.ROLLING,
      status: DS.PENDING,
      imageTag: request.imageTag,
      commitSha: request.commitSha,
      branch: request.branch,
      deployedBy,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      metadata: request.metadata,
    };

    this.deployments.set(id, deployment);

    // Transition to deploying
    deployment.status = DS.DEPLOYING;
    deployment.updatedAt = new Date().toISOString();

    return deployment;
  }

  /**
   * List deployments with optional filters
   */
  async listDeployments(
    query: ListDeploymentsQuery,
  ): Promise<{ data: Deployment[]; total: number }> {
    let data = Array.from(this.deployments.values());

    if (query.tenantId) {
      data = data.filter(d => d.tenantId === query.tenantId);
    }
    if (query.projectId) {
      data = data.filter(d => d.projectId === query.projectId);
    }
    if (query.environmentId) {
      data = data.filter(d => d.environmentId === query.environmentId);
    }
    if (query.status) {
      data = data.filter(d => d.status === query.status);
    }

    const total = data.length;
    const offset = query.offset || 0;
    const limit = query.limit || 50;

    return { data: data.slice(offset, offset + limit), total };
  }

  /**
   * Get a single deployment by ID
   */
  async getDeployment(id: string): Promise<Deployment | null> {
    return this.deployments.get(id) || null;
  }

  /**
   * Initiate a rollback for a given deployment
   */
  async rollbackDeployment(
    deploymentId: string,
    reason: string | undefined,
    targetDeploymentId: string | undefined,
    initiatedBy: string,
  ): Promise<Deployment> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    const rollbackId = `deploy-rollback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    // Create rollback deployment
    const rollback: Deployment = {
      id: rollbackId,
      tenantId: deployment.tenantId,
      projectId: deployment.projectId,
      environmentId: deployment.environmentId,
      strategy: deployment.strategy,
      status: DS.DEPLOYING,
      imageTag: deployment.imageTag,
      commitSha: deployment.commitSha,
      branch: deployment.branch,
      deployedBy: initiatedBy,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      rollbackTargetId: targetDeploymentId || deploymentId,
      metadata: {
        reason: reason || 'Manual rollback',
        originalDeployment: deploymentId,
      },
    };

    this.deployments.set(rollbackId, rollback);

    // Mark original as failed
    deployment.status = DS.FAILED;
    deployment.updatedAt = now;

    return rollback;
  }

  /**
   * Deploy a manifest to K8s and track the rollout.
   *
   * @param manifest - YAML/JSON Kubernetes manifest
   * @param namespace - Target namespace (defaults to K8sClientService default)
   */
  async deploy(
    manifest: string,
    namespace?: string,
  ): Promise<{ success: boolean; output: string }> {
    const applyResult = await this.k8sClient.apply(manifest);
    if (!applyResult.success) {
      return applyResult;
    }

    // Try to extract deployment name from manifest for rollout tracking
    // Simple heuristic: look for `name:` under `kind: Deployment`
    const match = manifest.match(/kind:\s*Deployment[\s\S]*?name:\s*(\S+)/m);
    if (match) {
      const deploymentName = match[1];
      const rolloutOk = await this.k8sClient.rolloutStatus(deploymentName, namespace);
      return {
        success: rolloutOk,
        output: applyResult.output + (rolloutOk ? '\nRollout completed successfully' : '\nRollout did not complete within timeout'),
      };
    }

    return applyResult;
  }

  /**
   * Rollback a Kubernetes deployment by name.
   *
   * @param deployment - Deployment name
   * @param namespace - Target namespace
   */
  async rollback(deployment: string, namespace?: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.k8sClient.rolloutUndo(deployment, namespace);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get K8s deployment status for a namespace.
   *
   * @param namespace - Target namespace
   */
  async getStatus(namespace?: string): Promise<any[]> {
    return this.k8sClient.getDeployments(namespace);
  }

  /**
   * Get a single K8s deployment by name.
   */
  async getK8sDeployment(name: string, namespace?: string): Promise<any | null> {
    return this.k8sClient.getDeployment(name, namespace);
  }

  /**
   * Update deployment status (called by internal event handlers)
   */
  async updateDeploymentStatus(
    deploymentId: string,
    status: DeploymentStatus,
    errorMessage?: string,
  ): Promise<void> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    // Validate state transition
    const allowedTransitions = VALID_TRANSITIONS[deployment.status];
    if (!allowedTransitions.includes(status)) {
      throw new Error(`Invalid state transition: ${deployment.status} -> ${status}`);
    }

    deployment.status = status;
    deployment.updatedAt = new Date().toISOString();

    if (errorMessage) {
      deployment.errorMessage = errorMessage;
    }

    if (status === DS.DEPLOYED || status === DS.FAILED || status === DS.ROLLED_BACK || status === DS.CANCELLED) {
      deployment.completedAt = new Date().toISOString();
    }
  }
}
