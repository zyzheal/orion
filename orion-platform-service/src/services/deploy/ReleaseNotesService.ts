/**
 * ReleaseNotesService - Deployment release notes generation
 *
 * Generates, saves, and retrieves release notes for deployments.
 * Persisted via PostgreSQL Repository pattern.
 */

import { ReleaseNotesRepository, ReleaseNotesEntity } from '../../repositories/ReleaseNotesRepository';

export interface ChangeEntry {
  type: 'feature' | 'fix' | 'improvement' | 'breaking' | 'config';
  description: string;
  commit?: string;
  author?: string;
  issueId?: string;
}

export interface ReleaseNotes {
  id: string;
  deploymentId: string;
  tenantId: string;
  version: string;
  environment: string;
  generatedAt: Date;
  summary: string;
  changes: ChangeEntry[];
  metrics?: {
    totalCommits: number;
    totalChanges: number;
    breakingChanges: number;
    features: number;
    fixes: number;
  };
  notes?: string;
  updatedAt?: Date;
}

export class ReleaseNotesServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ReleaseNotesServiceError';
  }
}

function entityToReleaseNotes(entity: ReleaseNotesEntity): ReleaseNotes {
  return {
    id: entity.id,
    deploymentId: entity.deploymentId ?? '',
    tenantId: entity.tenantId ?? '',
    version: entity.version ?? '1.0.0',
    environment: entity.environment ?? 'unknown',
    generatedAt: entity.generatedAt,
    summary: entity.summary ?? '',
    changes: (entity.changes ?? []) as ChangeEntry[],
    metrics: entity.metrics as ReleaseNotes['metrics'],
    notes: entity.notes ?? undefined,
    updatedAt: entity.updatedAt,
  };
}

export class ReleaseNotesService {
  private repository: ReleaseNotesRepository;
  private counter = 0;

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.repository = new ReleaseNotesRepository(db);
  }

  // ==================== Generate Release Notes ====================

  /**
   * Generate release notes for a deployment
   * In production this would integrate with git history and CI data
   */
  async generateReleaseNotes(
    tenantId: string,
    deploymentId: string,
    options?: {
      version?: string;
      environment?: string;
      changes?: ChangeEntry[];
    }
  ): Promise<ReleaseNotes> {
    if (!tenantId || !deploymentId) {
      throw new ReleaseNotesServiceError(
        'tenantId and deploymentId are required',
        'INVALID_INPUT'
      );
    }

    const changes = options?.changes ?? this.generateDefaultChanges();
    const version = options?.version ?? '1.0.0';
    const environment = options?.environment ?? 'unknown';

    const metrics = {
      totalCommits: changes.length,
      totalChanges: changes.length,
      breakingChanges: changes.filter((c) => c.type === 'breaking').length,
      features: changes.filter((c) => c.type === 'feature').length,
      fixes: changes.filter((c) => c.type === 'fix').length,
    };

    const summary = this.generateSummary(changes);
    const id = this.generateId('release-notes');

    const entity = await this.repository.create({
      id,
      deploymentId,
      tenantId,
      version,
      environment,
      generatedAt: new Date(),
      summary,
      changes,
      metrics,
      notes: null,
      content: null,
      generatedBy: 'system',
      status: 'published',
    });

    return entityToReleaseNotes(entity);
  }

  // ==================== Get Release Notes ====================

  /**
   * Get release notes for a deployment
   */
  async getReleaseNotes(deploymentId: string): Promise<ReleaseNotes | null> {
    const entity = await this.repository.findByDeploymentId(deploymentId);
    return entity ? entityToReleaseNotes(entity) : null;
  }

  /**
   * Get all release notes for a tenant
   */
  async getReleaseNotesByTenant(tenantId: string): Promise<ReleaseNotes[]> {
    const entities = await this.repository.findByTenantId(tenantId);
    return entities.map(entityToReleaseNotes);
  }

  // ==================== Save Release Notes ====================

  /**
   * Save or update release notes for a deployment
   */
  async saveReleaseNotes(deploymentId: string, notes: ReleaseNotes): Promise<ReleaseNotes> {
    const entity = await this.repository.upsertByDeploymentId(deploymentId, {
      id: notes.id,
      tenantId: notes.tenantId,
      version: notes.version,
      environment: notes.environment,
      summary: notes.summary,
      changes: notes.changes,
      metrics: notes.metrics ?? null,
      notes: notes.notes ?? null,
      generatedAt: notes.generatedAt,
    });

    return entityToReleaseNotes(entity);
  }

  /**
   * Delete release notes for a deployment
   */
  async deleteReleaseNotes(deploymentId: string): Promise<void> {
    await this.repository.deleteByDeploymentId(deploymentId);
  }

  // ==================== Internal Helpers ====================

  private generateDefaultChanges(): ChangeEntry[] {
    return [
      {
        type: 'feature',
        description: 'Initial release',
      },
    ];
  }

  private generateSummary(changes: ChangeEntry[]): string {
    const featureCount = changes.filter((c) => c.type === 'feature').length;
    const fixCount = changes.filter((c) => c.type === 'fix').length;
    const breakingCount = changes.filter((c) => c.type === 'breaking').length;

    const parts: string[] = [];
    if (featureCount > 0) parts.push(`${featureCount} feature${featureCount > 1 ? 's' : ''}`);
    if (fixCount > 0) parts.push(`${fixCount} fix${fixCount > 1 ? 'es' : ''}`);
    if (breakingCount > 0) parts.push(`${breakingCount} breaking change${breakingCount > 1 ? 's' : ''}`);

    if (parts.length === 0) {
      return 'No significant changes';
    }

    return `This release includes ${parts.join(', ')}`;
  }

  private generateId(prefix: string): string {
    this.counter += 1;
    return `${prefix}-${Date.now()}-${this.counter}`;
  }
}
