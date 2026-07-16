/**
 * ArtifactRepository - PostgreSQL Repository for Build Artifact CRUD operations
 *
 * Maps to the `artifacts` table defined in migration 090.
 * Provides persistence for the build ArtifactService, replacing the in-memory Map storage.
 */

import { DatabasePool } from '../database';
import { BaseRepository } from '../../db/base-repository';
import { OrionError, ErrorCode } from '../../errors';

// ==================== Entity Interfaces ====================

export interface ArtifactRecord {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  storage_type: string;
  storage_path: string;
  size_bytes: number;
  checksum_sha256: string | null;
  run_id: string;
  stage_id: string | null;
  expires_at: Date | null;
  downloaded_count: number;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface CreateArtifactInput {
  tenant_id?: string;
  name: string;
  type: string;
  storage_type?: string;
  storage_path: string;
  size_bytes?: number;
  checksum_sha256?: string;
  run_id: string;
  stage_id?: string;
  expires_at?: Date;
  metadata?: Record<string, any>;
}

export interface UpdateArtifactInput {
  name?: string;
  type?: string;
  storage_path?: string;
  size_bytes?: number;
  checksum_sha256?: string;
  metadata?: Record<string, any>;
}

export interface ArtifactQueryOptions {
  runId?: string;
  stageId?: string;
  taskId?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

// ==================== Repository Class ====================

export class ArtifactRepository extends BaseRepository<ArtifactRecord> {
  constructor(db: DatabasePool) {
    super(db, 'artifacts');
  }

  /**
   * Find artifacts by Pipeline Run ID
   */
  async findByRunId(runId: string): Promise<ArtifactRecord[]> {
    const result = await this.db.query(
      `SELECT * FROM artifacts WHERE run_id = $1 ORDER BY created_at DESC`,
      [runId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find artifacts by Stage ID (stage_id or via metadata.taskId)
   */
  async findByStageId(stageId: string): Promise<ArtifactRecord[]> {
    const result = await this.db.query(
      `SELECT * FROM artifacts WHERE stage_id = $1 ORDER BY created_at DESC`,
      [stageId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find artifacts by task ID (stored in metadata)
   */
  async findByTaskId(taskId: string): Promise<ArtifactRecord[]> {
    const result = await this.db.query(
      `SELECT * FROM artifacts WHERE metadata->>'taskId' = $1 ORDER BY created_at DESC`,
      [taskId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find artifacts with combined filters (runId, stageId, taskId, type)
   */
  async findByOptions(options: ArtifactQueryOptions): Promise<ArtifactRecord[]> {
    let query = `SELECT * FROM artifacts WHERE 1=1`;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options.runId) {
      query += ` AND run_id = $${paramIndex}`;
      params.push(options.runId);
      paramIndex++;
    }
    if (options.stageId) {
      query += ` AND stage_id = $${paramIndex}`;
      params.push(options.stageId);
      paramIndex++;
    }
    if (options.taskId) {
      query += ` AND metadata->>'taskId' = $${paramIndex}`;
      params.push(options.taskId);
      paramIndex++;
    }
    if (options.type) {
      query += ` AND type = $${paramIndex}`;
      params.push(options.type);
      paramIndex++;
    }

    const limit = options.limit || 100;
    const offset = options.offset || 0;
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find expired artifacts that haven't been soft-deleted yet
   */
  async findExpired(): Promise<ArtifactRecord[]> {
    const result = await this.db.query(
      `SELECT * FROM artifacts
       WHERE expires_at IS NOT NULL
       AND expires_at < NOW()
       ORDER BY expires_at ASC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Create a new artifact record
   */
  async createArtifact(input: CreateArtifactInput): Promise<ArtifactRecord> {
    const result = await this.db.query(
      `INSERT INTO artifacts
       (tenant_id, name, type, storage_type, storage_path, size_bytes,
        checksum_sha256, run_id, stage_id, expires_at, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        input.tenant_id || '00000000-0000-0000-0000-000000000000',
        input.name,
        input.type,
        input.storage_type || 'local',
        input.storage_path,
        input.size_bytes || 0,
        input.checksum_sha256 || null,
        input.run_id,
        input.stage_id || null,
        input.expires_at || null,
        input.metadata || {},
      ],
    );
    if (result.rows.length === 0) {
      throw new OrionError('INSERT into artifacts returned no rows', ErrorCode.OPERATION_FAILED);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Increment download counter for an artifact
   */
  async incrementDownloadCount(id: string): Promise<void> {
    await this.db.query(
      `UPDATE artifacts SET downloaded_count = downloaded_count + 1, updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  /**
   * Delete expired artifacts (hard delete)
   */
  async deleteExpired(): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM artifacts
       WHERE expires_at IS NOT NULL
       AND expires_at < NOW()`,
    );
    return result.rowCount ?? 0;
  }

  /**
   * Find artifact by ID
   */
  async findById(id: string): Promise<ArtifactRecord | null> {
    const result = await this.db.query(
      `SELECT * FROM artifacts WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Delete artifact by ID
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM artifacts WHERE id = $1`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): ArtifactRecord {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      type: row.type,
      storage_type: row.storage_type || 'local',
      storage_path: row.storage_path,
      size_bytes: row.size_bytes || 0,
      checksum_sha256: row.checksum_sha256 || null,
      run_id: row.run_id,
      stage_id: row.stage_id || null,
      expires_at: row.expires_at ? new Date(row.expires_at) : null,
      downloaded_count: row.downloaded_count || 0,
      metadata: row.metadata || {},
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}

export default ArtifactRepository;
