/**
 * Deployment History Service
 *
 * Stores deployment records, provides query capabilities,
 * calculates deployment metrics, and maintains audit trails.
 *
 * TASK-701: Smart Deployment (智能部署)
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Deployment,
  DeploymentMetrics,
  AuditTrailEntry,
  HistoryQuery,
  HistoryQueryResponse,
  DeploymentStatus,
  DeploymentStrategyType,
} from './types';

/**
 * Deployment history and audit service
 */
export class DeploymentHistoryService {
  // In-memory storage (production should use database)
  private deployments: Map<string, Deployment> = new Map();
  private auditTrail: AuditTrailEntry[] = [];

  /**
   * Record a deployment
   */
  async recordDeployment(deployment: Deployment): Promise<Deployment> {
    this.deployments.set(deployment.id, deployment);

    // Add audit trail entry
    await this.addAuditTrailEntry({
      deploymentId: deployment.id,
      action: 'deployment_created',
      performedBy: deployment.initiatedBy,
      details: {
        appName: deployment.appName,
        version: deployment.version,
        environment: deployment.environment,
        strategy: deployment.strategy,
        status: deployment.status,
      },
    });

    return deployment;
  }

  /**
   * Update a deployment record
   */
  async updateDeployment(
    deploymentId: string,
    updates: Partial<Deployment>
  ): Promise<Deployment | null> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      return null;
    }

    // Apply updates
    Object.assign(deployment, updates);
    deployment.updatedAt = new Date();

    this.deployments.set(deploymentId, deployment);

    // Add audit trail entry
    await this.addAuditTrailEntry({
      deploymentId,
      action: 'deployment_updated',
      performedBy: updates.initiatedBy || 'system',
      details: {
        updatedFields: Object.keys(updates),
        status: deployment.status,
      },
    });

    return deployment;
  }

  /**
   * Get deployment by ID
   */
  async getDeployment(deploymentId: string): Promise<Deployment | null> {
    return this.deployments.get(deploymentId) || null;
  }

  /**
   * Get deployment history with filtering and pagination
   */
  async getHistory(query: HistoryQuery = {}): Promise<HistoryQueryResponse> {
    let deployments = Array.from(this.deployments.values());

    // Apply filters
    if (query.appName) {
      deployments = deployments.filter((d) => d.appName === query.appName);
    }

    if (query.version) {
      deployments = deployments.filter((d) => d.version === query.version);
    }

    if (query.environment) {
      deployments = deployments.filter(
        (d) => d.environment === query.environment
      );
    }

    if (query.status) {
      deployments = deployments.filter((d) => d.status === query.status);
    }

    if (query.strategy) {
      deployments = deployments.filter((d) => d.strategy === query.strategy);
    }

    if (query.initiatedBy) {
      deployments = deployments.filter(
        (d) => d.initiatedBy === query.initiatedBy
      );
    }

    if (query.startDate) {
      deployments = deployments.filter(
        (d) => d.startedAt >= query.startDate!
      );
    }

    if (query.endDate) {
      deployments = deployments.filter(
        (d) => d.startedAt <= query.endDate!
      );
    }

    // Sort by start time (most recent first)
    deployments.sort(
      (a, b) => b.startedAt.getTime() - a.startedAt.getTime()
    );

    const total = deployments.length;
    const limit = query.limit || 20;
    const offset = query.offset || 0;
    const data = deployments.slice(offset, offset + limit);

    return {
      data,
      total,
      limit,
      offset,
    };
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
    let deployments = Array.from(this.deployments.values());

    // Apply filters
    if (filters?.appName) {
      deployments = deployments.filter((d) => d.appName === filters.appName);
    }

    if (filters?.environment) {
      deployments = deployments.filter(
        (d) => d.environment === filters.environment
      );
    }

    if (filters?.startDate) {
      deployments = deployments.filter(
        (d) => d.startedAt >= filters.startDate!
      );
    }

    if (filters?.endDate) {
      deployments = deployments.filter(
        (d) => d.startedAt <= filters.endDate!
      );
    }

    const total = deployments.length;
    const successful = deployments.filter(
      (d) => d.status === 'completed'
    ).length;
    const failed = deployments.filter((d) => d.status === 'failed').length;
    const rolledBack = deployments.filter(
      (d) => d.status === 'rolled_back'
    ).length;

    // Calculate durations for completed deployments
    const durations = deployments
      .filter(
        (d) =>
          d.completedAt && d.startedAt && d.status !== 'pending'
      )
      .map((d) => d.completedAt!.getTime() - d.startedAt.getTime());

    const averageDurationMs =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;

    const medianDurationMs =
      durations.length > 0
        ? this.calculateMedian(durations)
        : 0;

    // Count by strategy
    const byStrategy: Record<string, number> = {};
    for (const d of deployments) {
      byStrategy[d.strategy] = (byStrategy[d.strategy] || 0) + 1;
    }

    // Count by environment
    const byEnvironment: Record<string, number> = {};
    for (const d of deployments) {
      byEnvironment[d.environment] = (byEnvironment[d.environment] || 0) + 1;
    }

    // Count by status
    const byStatus: Record<string, number> = {};
    for (const d of deployments) {
      byStatus[d.status] = (byStatus[d.status] || 0) + 1;
    }

    return {
      totalDeployments: total,
      successfulDeployments: successful,
      failedDeployments: failed,
      rolledBackDeployments: rolledBack,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
      averageDurationMs,
      medianDurationMs,
      rollbackRate: total > 0 ? Math.round((rolledBack / total) * 100) : 0,
      byStrategy,
      byEnvironment,
      byStatus,
    };
  }

  /**
   * Get audit trail for a deployment
   */
  async getAuditTrail(deploymentId: string): Promise<AuditTrailEntry[]> {
    return this.auditTrail.filter(
      (entry) => entry.deploymentId === deploymentId
    );
  }

  /**
   * Get all audit trail entries
   */
  async getAllAuditTrail(): Promise<AuditTrailEntry[]> {
    return [...this.auditTrail].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Get deployments by app name
   */
  async getByAppName(appName: string): Promise<Deployment[]> {
    return Array.from(this.deployments.values())
      .filter((d) => d.appName === appName)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  /**
   * Get deployments by environment
   */
  async getByEnvironment(environment: string): Promise<Deployment[]> {
    return Array.from(this.deployments.values())
      .filter((d) => d.environment === environment)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  /**
   * Get latest deployment for an app in an environment
   */
  async getLatestDeployment(
    appName: string,
    environment: string
  ): Promise<Deployment | null> {
    const deployments = Array.from(this.deployments.values())
      .filter(
        (d) =>
          d.appName === appName && d.environment === environment
      )
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    return deployments.length > 0 ? deployments[0] : null;
  }

  /**
   * Get the last successful deployment for an app in an environment
   */
  async getLastSuccessfulDeployment(
    appName: string,
    environment: string
  ): Promise<Deployment | null> {
    const deployments = Array.from(this.deployments.values())
      .filter(
        (d) =>
          d.appName === appName &&
          d.environment === environment &&
          d.status === 'completed'
      )
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    return deployments.length > 0 ? deployments[0] : null;
  }

  /**
   * Add audit trail entry
   */
  private async addAuditTrailEntry(
    entry: Omit<AuditTrailEntry, 'id' | 'timestamp'>
  ): Promise<AuditTrailEntry> {
    const auditEntry: AuditTrailEntry = {
      id: uuidv4(),
      ...entry,
      timestamp: new Date(),
    };

    this.auditTrail.push(auditEntry);
    return auditEntry;
  }

  /**
   * Calculate median of an array of numbers
   */
  private calculateMedian(numbers: number[]): number {
    if (numbers.length === 0) return 0;

    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    }

    return sorted[mid];
  }

  /**
   * Clear all stored data (for testing)
   */
  static clearAll(): void {
    // Handled in tests by creating new instances
  }
}
