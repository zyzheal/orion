/**
 * ReleaseNotesService - Deployment release notes generation
 *
 * Generates, saves, and retrieves release notes for deployments.
 * Uses Map-based in-memory storage.
 */

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

export class ReleaseNotesService {
  private notes: Map<string, ReleaseNotes> = new Map();
  private counter = 0;
  private repository?: import('../../repositories/ReleaseNotesRepository').ReleaseNotesRepository;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      // Lazy import to avoid circular dependency
      const { ReleaseNotesRepository } = require('../../repositories/ReleaseNotesRepository');
      this.repository = new ReleaseNotesRepository(db);
    }
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

    const releaseNotes: ReleaseNotes = {
      id: this.generateId('release-notes'),
      deploymentId,
      tenantId,
      version,
      environment,
      generatedAt: new Date(),
      summary,
      changes,
      metrics,
    };

    this.notes.set(deploymentId, releaseNotes);
    return releaseNotes;
  }

  // ==================== Get Release Notes ====================

  /**
   * Get release notes for a deployment
   */
  async getReleaseNotes(deploymentId: string): Promise<ReleaseNotes | null> {
    return this.notes.get(deploymentId) ?? null;
  }

  /**
   * Get all release notes for a tenant
   */
  async getReleaseNotesByTenant(tenantId: string): Promise<ReleaseNotes[]> {
    const results: ReleaseNotes[] = [];
    for (const note of this.notes.values()) {
      if (note.tenantId === tenantId) {
        results.push(note);
      }
    }
    return results.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
  }

  // ==================== Save Release Notes ====================

  /**
   * Save or update release notes for a deployment
   */
  async saveReleaseNotes(deploymentId: string, notes: ReleaseNotes): Promise<ReleaseNotes> {
    const existing = this.notes.get(deploymentId);
    if (existing) {
      // Merge with existing, preserving id and generatedAt
      const updated: ReleaseNotes = {
        ...existing,
        ...notes,
        id: existing.id,
        generatedAt: existing.generatedAt,
        updatedAt: new Date(),
      };
      this.notes.set(deploymentId, updated);
      return updated;
    }

    this.notes.set(deploymentId, notes);
    return notes;
  }

  /**
   * Delete release notes for a deployment
   */
  async deleteReleaseNotes(deploymentId: string): Promise<void> {
    this.notes.delete(deploymentId);
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
