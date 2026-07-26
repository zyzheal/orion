import { ArtifactOperationRepository, ArtifactOperationEntity } from '../repositories/ArtifactOperationRepository';

export interface ArtifactOperationInput {
  artifactId: string;
  operation: 'build' | 'publish' | 'deploy' | 'scan' | 'promote' | 'delete' | 'rollback';
  source?: string;
  target?: string;
  metadata?: Record<string, unknown>;
  initiatedBy?: string;
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
 * Uses PostgreSQL Repository pattern for persistence.
 */
export class ArtifactOperationService {
  private repository: ArtifactOperationRepository;

  constructor(repository: ArtifactOperationRepository) {
    this.repository = repository;
  }

  /**
   * Track a new artifact operation.
   */
  async trackOperation(
    tenantId: string,
    input: ArtifactOperationInput,
  ): Promise<ArtifactOperation> {
    const id = `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();

    const entity = await this.repository.create({
      id,
      tenant_id: tenantId,
      artifact_id: input.artifactId,
      operation: input.operation,
      source: input.source || null,
      target: input.target || null,
      metadata: input.metadata || {},
      status: 'pending',
      initiated_by: input.initiatedBy || null,
    });

    return this.entityToDomain(entity);
  }

  /**
   * Update the status of an operation.
   */
  async updateOperationStatus(
    operationId: string,
    status: ArtifactOperation['status'],
    completedAt?: string,
  ): Promise<ArtifactOperation | undefined> {
    let completedDate: Date | undefined;
    let durationMs: number | undefined;

    if (completedAt) {
      completedDate = new Date(completedAt);
      const started = new Date(); // Would need to fetch created_at for accurate duration
      durationMs = completedDate.getTime() - started.getTime();
    }

    const entity = await this.repository.updateStatus(operationId, status, completedDate || null, durationMs ?? null);
    if (!entity) return undefined;
    return this.entityToDomain(entity);
  }

  /**
   * Get operation history for a tenant, with optional filters.
   */
  async getOperationHistory(
    tenantId: string,
    filters?: OperationFilters,
  ): Promise<ArtifactOperation[]> {
    const result = await this.repository.findByTenant(tenantId, filters, {
      limit: 1000,
      orderBy: 'created_at',
      orderDir: 'DESC',
    });

    return result.entities.map((e: ArtifactOperationEntity) => this.entityToDomain(e));
  }

  /**
   * Get a single operation by ID.
   */
  async getOperation(operationId: string): Promise<ArtifactOperation | undefined> {
    const entity = await this.repository.findById(operationId);
    if (!entity) return undefined;
    return this.entityToDomain(entity);
  }

  /**
   * Get artifact statistics for a tenant.
   */
  async getArtifactStats(tenantId: string): Promise<ArtifactStats> {
    const stats = await this.repository.getTenantStats(tenantId);

    // Get recent operations
    const recentResult = await this.repository.findByTenant(tenantId, undefined, {
      limit: 20,
      orderBy: 'created_at',
      orderDir: 'DESC',
    });
    const recentOperations = recentResult.entities.map((e: ArtifactOperationEntity) => this.entityToDomain(e));

    return {
      ...stats,
      recentOperations,
    };
  }

  /**
   * Delete all operations for a tenant.
   */
  async deleteTenantOperations(tenantId: string): Promise<number> {
    return this.repository.deleteByTenant(tenantId);
  }

  /**
   * Convert entity to domain model
   */
  private entityToDomain(entity: ArtifactOperationEntity): ArtifactOperation {
    return {
      id: entity.id,
      tenantId: entity.tenant_id,
      artifactId: entity.artifact_id,
      operation: entity.operation,
      source: entity.source || undefined,
      target: entity.target || undefined,
      metadata: entity.metadata,
      status: entity.status as ArtifactOperation['status'],
      initiatedBy: entity.initiated_by || undefined,
      createdAt: entity.created_at.toISOString(),
      completedAt: entity.completed_at?.toISOString(),
      duration: entity.duration_ms || undefined,
    };
  }
}
