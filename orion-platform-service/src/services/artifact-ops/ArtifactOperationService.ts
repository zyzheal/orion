export interface ArtifactOperationInput {
  artifactId: string;
  operation: 'build' | 'publish' | 'deploy' | 'scan' | 'promote' | 'delete' | 'rollback';
  source?: string;
  target?: string;
  metadata?: Record<string, unknown>;
}

export interface ArtifactOperation {
  id: string;
  tenantId: string;
  artifactId: string;
  operation: string;
  source?: string;
  target?: string;
  metadata?: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  initiatedBy?: string;
  createdAt: string;
  completedAt?: string;
  duration?: number;
}

export interface ArtifactStats {
  totalOperations: number;
  operationsByType: Record<string, number>;
  operationsByStatus: Record<string, number>;
  uniqueArtifacts: number;
  averageDuration: number;
  successRate: number;
  recentOperations: ArtifactOperation[];
}

export interface OperationFilters {
  artifactId?: string;
  operation?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  initiatedBy?: string;
}

/**
 * ArtifactOperationService — tracks and reports on artifact operations per tenant.
 * Uses in-memory Map storage with tenant isolation.
 */
export class ArtifactOperationService {
  private operations = new Map<string, ArtifactOperation>();
  private operationIndex = new Map<string, string[]>(); // tenantId -> operationIds

  /**
   * Track a new artifact operation.
   */
  trackOperation(
    tenantId: string,
    input: ArtifactOperationInput,
  ): ArtifactOperation {
    const id = `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const operation: ArtifactOperation = {
      id,
      tenantId,
      artifactId: input.artifactId,
      operation: input.operation,
      source: input.source,
      target: input.target,
      metadata: input.metadata,
      status: 'pending',
      createdAt: now,
    };

    this.operations.set(id, operation);

    // Index by tenant
    if (!this.operationIndex.has(tenantId)) {
      this.operationIndex.set(tenantId, []);
    }
    this.operationIndex.get(tenantId)!.push(id);

    return operation;
  }

  /**
   * Update the status of an operation.
   */
  updateOperationStatus(
    operationId: string,
    status: ArtifactOperation['status'],
    completedAt?: string,
  ): ArtifactOperation | undefined {
    const operation = this.operations.get(operationId);
    if (!operation) return undefined;

    operation.status = status;
    if (completedAt) {
      operation.completedAt = completedAt;
      const started = new Date(operation.createdAt).getTime();
      const ended = new Date(completedAt).getTime();
      operation.duration = ended - started;
    }

    return operation;
  }

  /**
   * Get operation history for a tenant, with optional filters.
   */
  getOperationHistory(
    tenantId: string,
    filters?: OperationFilters,
  ): ArtifactOperation[] {
    const ids = this.operationIndex.get(tenantId) || [];
    const ops = ids
      .map((id) => this.operations.get(id))
      .filter((op): op is ArtifactOperation => op !== undefined);

    if (!filters) return ops;

    return ops.filter((op) => {
      if (filters.artifactId && op.artifactId !== filters.artifactId) return false;
      if (filters.operation && op.operation !== filters.operation) return false;
      if (filters.status && op.status !== filters.status) return false;
      if (filters.initiatedBy && op.initiatedBy !== filters.initiatedBy) return false;
      if (filters.startDate && op.createdAt < filters.startDate) return false;
      if (filters.endDate && op.createdAt > filters.endDate) return false;
      return true;
    });
  }

  /**
   * Get a single operation by ID.
   */
  getOperation(operationId: string): ArtifactOperation | undefined {
    return this.operations.get(operationId);
  }

  /**
   * Get artifact statistics for a tenant.
   */
  getArtifactStats(tenantId: string): ArtifactStats {
    const ops = this.getOperationHistory(tenantId);

    const operationsByType: Record<string, number> = {};
    const operationsByStatus: Record<string, number> = {};
    const artifactIds = new Set<string>();
    let totalDuration = 0;
    let completedCount = 0;

    for (const op of ops) {
      // Count by type
      operationsByType[op.operation] = (operationsByType[op.operation] || 0) + 1;

      // Count by status
      operationsByStatus[op.status] = (operationsByStatus[op.status] || 0) + 1;

      // Unique artifacts
      artifactIds.add(op.artifactId);

      // Duration
      if (op.duration !== undefined) {
        totalDuration += op.duration;
        completedCount++;
      }
    }

    const successCount = operationsByStatus['completed'] || 0;

    return {
      totalOperations: ops.length,
      operationsByType,
      operationsByStatus,
      uniqueArtifacts: artifactIds.size,
      averageDuration: completedCount > 0 ? totalDuration / completedCount : 0,
      successRate: ops.length > 0 ? successCount / ops.length : 0,
      recentOperations: ops
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 20),
    };
  }

  /**
   * Delete all operations for a tenant.
   */
  deleteTenantOperations(tenantId: string): number {
    const ids = this.operationIndex.get(tenantId) || [];
    for (const id of ids) {
      this.operations.delete(id);
    }
    this.operationIndex.delete(tenantId);
    return ids.length;
  }

  /**
   * Clear all data.
   */
  destroy(): void {
    this.operations.clear();
    this.operationIndex.clear();
  }
}
