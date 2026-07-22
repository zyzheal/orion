/**
 * ScriptVersionService - Script content version tracking
 *
 * Tracks script content versions with diff comparison.
 * Mirrors NeatLogic's script version management pattern.
 *
 * P3 feature from neatlogic-autoexec comparison analysis.
 */

import { createLogger } from '../../utils/logger';
import { ScriptVersionRepository } from '../../repositories/ScriptVersionRepository';
import { OrionError, ErrorCode } from '../../errors';
import type {
  ScriptVersion, CreateScriptVersion, ScriptVersionFilter, ScriptVersionDiff, ScriptVersionEntity,
} from '../../models/ScriptVersion';

const logger = createLogger('ScriptVersionService');

export class ScriptVersionServiceError extends Error {
  constructor(message: string, public code: string) {
    super(`[${code}] ${message}`);
    this.name = 'ScriptVersionServiceError';
  }
}

export interface ScriptVersionServiceOptions {
  db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };
}

export class ScriptVersionService {
  private repository: ScriptVersionRepository | null = null;

  constructor(options?: ScriptVersionServiceOptions) {
    if (options?.db) {
      this.repository = new ScriptVersionRepository(options.db);
    }
  }

  // ==================== CRUD ====================

  /**
   * Create a new script version.
   */
  async createVersion(input: CreateScriptVersion): Promise<ScriptVersion> {
    if (!this.repository) {
      throw new ScriptVersionServiceError('No repository configured', 'NO_REPOSITORY');
    }

    if (!input.tenantId || !input.scriptId || !input.version || !input.content) {
      throw new ScriptVersionServiceError(
        'Missing required fields: tenantId, scriptId, version, content',
        'INVALID_INPUT',
      );
    }

    const contentHash = this.computeHash(input.content);

    // Check for duplicate version
    const existing = await this.repository.findByVersion(input.tenantId, input.scriptId, input.version);
    if (existing) {
      throw new ScriptVersionServiceError(
        `Version already exists: ${input.version}`,
        'DUPLICATE_VERSION',
      );
    }

    const entity = await this.repository.create({
      id: this.generateId('sv'),
      tenant_id: input.tenantId,
      script_id: input.scriptId,
      version: input.version,
      content: input.content,
      content_hash: contentHash,
      parameters: input.parameters ?? {},
      change_description: input.changeDescription ?? undefined,
      created_by: input.createdBy,
    });

    return this.mapEntityToVersion(entity);
  }

  /**
   * Get all versions for a script.
   */
  async getVersions(tenantId: string, scriptId: string): Promise<ScriptVersion[]> {
    if (!this.repository) {
      throw new ScriptVersionServiceError('No repository configured', 'NO_REPOSITORY');
    }

    const entities = await this.repository.findByScriptId(tenantId, scriptId);
    return entities.map(e => this.mapEntityToVersion(e));
  }

  /**
   * Get the latest version for a script.
   */
  async getLatestVersion(tenantId: string, scriptId: string): Promise<ScriptVersion | null> {
    if (!this.repository) {
      throw new ScriptVersionServiceError('No repository configured', 'NO_REPOSITORY');
    }

    const entity = await this.repository.findLatestByScriptId(tenantId, scriptId);
    return entity ? this.mapEntityToVersion(entity) : null;
  }

  /**
   * Get a specific version by version string.
   */
  async getVersion(tenantId: string, scriptId: string, version: string): Promise<ScriptVersion | null> {
    if (!this.repository) {
      throw new ScriptVersionServiceError('No repository configured', 'NO_REPOSITORY');
    }

    const entity = await this.repository.findByVersion(tenantId, scriptId, version);
    return entity ? this.mapEntityToVersion(entity) : null;
  }

  /**
   * Compare two versions and return a diff.
   */
  async diff(
    tenantId: string,
    scriptId: string,
    versionA: string,
    versionB: string,
  ): Promise<ScriptVersionDiff> {
    if (!this.repository) {
      throw new ScriptVersionServiceError('No repository configured', 'NO_REPOSITORY');
    }

    const [vA, vB] = await Promise.all([
      this.repository.findByVersion(tenantId, scriptId, versionA),
      this.repository.findByVersion(tenantId, scriptId, versionB),
    ]);

    if (!vA) {
      throw new ScriptVersionServiceError(`Version not found: ${versionA}`, 'VERSION_NOT_FOUND');
    }
    if (!vB) {
      throw new ScriptVersionServiceError(`Version not found: ${versionB}`, 'VERSION_NOT_FOUND');
    }

    return this.computeDiff(vA.content, vB.content, versionA, versionB);
  }

  /**
   * List versions by filter.
   */
  async listVersions(filter: ScriptVersionFilter): Promise<ScriptVersion[]> {
    if (!this.repository) {
      throw new ScriptVersionServiceError('No repository configured', 'NO_REPOSITORY');
    }

    const entities = await this.repository.findByFilter(filter);
    return entities.map(e => this.mapEntityToVersion(e));
  }

  /**
   * Delete a version by (scriptId, version) composite key.
   * Looks up the real entity ID first, then deletes by ID.
   */
  async deleteVersion(tenantId: string, scriptId: string, version: string): Promise<void> {
    if (!this.repository) {
      throw new ScriptVersionServiceError('No repository configured', 'NO_REPOSITORY');
    }

    const entity = await this.repository.findByVersion(tenantId, scriptId, version);
    if (!entity) {
      throw new ScriptVersionServiceError(`Version not found: ${version}`, 'VERSION_NOT_FOUND');
    }

    await this.repository.delete(entity.id);
  }

  // ==================== Diff Computation ====================

  /**
   * Compute a simple line-by-line diff between two content strings.
   */
  private computeDiff(contentA: string, contentB: string, labelA: string, labelB: string): ScriptVersionDiff {
    const linesA = contentA.split('\n');
    const linesB = contentB.split('\n');

    const added: string[] = [];
    const removed: string[] = [];
    const modified: string[] = [];
    const unchanged: string[] = [];

    const maxLen = Math.max(linesA.length, linesB.length);

    for (let i = 0; i < maxLen; i++) {
      const lineA = linesA[i];
      const lineB = linesB[i];

      if (lineA === undefined && lineB !== undefined) {
        added.push(`+ ${lineB}`);
      } else if (lineA !== undefined && lineB === undefined) {
        removed.push(`- ${lineA}`);
      } else if (lineA !== lineB) {
        modified.push(`- ${lineA}`);
        modified.push(`+ ${lineB}`);
      } else {
        unchanged.push(lineA);
      }
    }

    const summary = this.buildSummary(added, removed, modified, labelA, labelB);

    return { added, removed, modified, unchanged, summary };
  }

  private buildSummary(added: string[], removed: string[], modified: string[], labelA: string, labelB: string): string {
    const parts: string[] = [];
    if (added.length > 0) parts.push(`${added.length} lines added`);
    if (removed.length > 0) parts.push(`${removed.length} lines removed`);
    if (modified.length > 0) parts.push(`${modified.length / 2} lines modified`);

    if (parts.length === 0) {
      return `No changes between ${labelA} and ${labelB}`;
    }

    return `Diff ${labelA} → ${labelB}: ${parts.join(', ')}`;
  }

  // ==================== Private Helpers ====================

  private computeHash(content: string): string {
    // Simple hash for content change detection (not cryptographic)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `sha-${Math.abs(hash).toString(16)}`;
  }

  private mapEntityToVersion(entity: ScriptVersionEntity): ScriptVersion {
    return {
      id: entity.id,
      tenantId: entity.tenant_id,
      scriptId: entity.script_id,
      version: entity.version,
      content: entity.content,
      contentHash: entity.content_hash,
      parameters: entity.parameters ?? {},
      changeDescription: entity.change_description ?? undefined,
      createdBy: entity.created_by,
      createdAt: entity.created_at,
    };
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
