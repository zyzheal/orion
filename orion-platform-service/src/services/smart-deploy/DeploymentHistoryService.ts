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
import { DeploymentHistoryRepository, DeploymentHistoryEntity } from '../../repositories/DeploymentHistoryRepository';

/**
 * Deployment history and audit service
 */
export class DeploymentHistoryService {
  private deploymentRepository?: DeploymentHistoryRepository;
  private auditTrail: AuditTrailEntry[] = [];

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.deploymentRepository = new DeploymentHistoryRepository(db);
    }
  }

  /**
   * Record a deployment
   */
  async recordDeployment(deployment: Deployment): Promise<Deployment> {
    if (this.deploymentRepository) {
      await this.deploymentRepository.create({
        id: deployment.id,
        tenantId: 'default',
        projectId: null,
        pipelineRunId: null,
        buildId: null,
        environment: deployment.environment,
        status: deployment.status,
        strategy: deployment.strategy,
        config: {},
        deployedBy: deployment.initiatedBy,
        startedAt: deployment.startedAt,
        completedAt: deployment.completedAt ?? null,
        durationMs: null,
        errorMessage: deployment.error ?? null,
        rollbackTo: null,
      });
    }

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
    if (this.deploymentRepository) {
      if (updates.status) {
        await this.deploymentRepository.updateStatus(
          deploymentId,
          updates.status,
          updates.completedAt,
          updates.error,
        );
      }
    }

    // Add audit trail entry
    await this.addAuditTrailEntry({
      deploymentId,
      action: 'deployment_updated',
      performedBy: updates.initiatedBy || 'system',
      details: {
        updatedFields: Object.keys(updates),
        status: updates.status,
      },
    });

    return null; // Repository handles persistence
  }

  /**
   * Get deployment by ID
   */
  async getDeployment(deploymentId: string): Promise<DeploymentHistoryEntity | null> {
    if (this.deploymentRepository) {
      return await this.deploymentRepository.findById(deploymentId);
    }
    return null;
  }

  /**
   * Get deployment history with filtering and pagination
   */
  async getHistory(query: HistoryQuery = {}): Promise<HistoryQueryResponse> {
    if (this.deploymentRepository) {
      let deployments = await this.deploymentRepository.findAll();

      // Apply filters
      if (query.environment) {
        deployments = deployments.filter(d => d.environment === query.environment);
      }
      if (query.status) {
        deployments = deployments.filter(d => d.status === query.status);
      }

      // Sort by start time (most recent first)
      deployments.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));

      const total = deployments.length;
      const limit = query.limit || 20;
      const offset = query.offset || 0;
      const data = deployments.slice(offset, offset + limit);

      return {
        data: data as unknown as Deployment[],
        total,
        limit,
        offset,
      };
    }

    return { data: [], total: 0, limit: 20, offset: 0 };
  }

  /**
   * Get deployments by environment
   */
  async getByEnvironment(environment: string): Promise<DeploymentHistoryEntity[]> {
    if (this.deploymentRepository) {
      return await this.deploymentRepository.findByEnvironment(environment);
    }
    return [];
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
