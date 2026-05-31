/**
 * BuildArtifactRepository - Database layer for Build Artifact operations
 *
 * Provides PostgreSQL persistence for build artifacts,
 * replacing the Map() in-memory storage in ArtifactService.
 */

import { BaseRepository } from '../db/base-repository';
import {
  ArtifactType,
  ArtifactStorageType,
  Artifact,
  ArtifactCreateInput,
} from '../models/BuildArtifact';
import { OrionError, ErrorCode } from '../errors';

export interface BuildArtifactRow {
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

export class BuildArtifactRepository extends BaseRepository<Artifact> {
  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    super(db, 'artifacts');
  }

  /**
   * Create a new artifact record
   */
  async createArtifact(input: ArtifactCreateInput & { tenantId: string }): Promise<Artifact> {
    const result = await this.db.query(
      `INSERT INTO artifacts
       (tenant_id, name, type, storage_type, storage_path, size_bytes,
        checksum_sha256, run_id, stage_id, expires_at, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        input.tenantId,
        input.name,
        input.type || ArtifactType.OTHER,
        input.storageType || ArtifactStorageType.LOCAL,
        input.storagePath,
        input.size,
        input.checksum || null,
        input.runId,
        input.stageId || null,
        input.expiresAt || null,
        input.metadata || {},
      ],
    );
    if (result.rows.length === 0) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'INSERT into artifacts returned no rows');
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find artifact by ID
   */
  async findById(id: string): Promise<Artifact | undefined> {
    const result = await this.db.query(
      `SELECT * FROM artifacts WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find all artifacts with optional filters and pagination
   * Note: overrides BaseRepository.findAll with artifact-specific filtering
   */
  override async findAll(options?: {
    runId?: string;
    stageId?: string;
    type?: ArtifactType;
    limit?: number;
    offset?: number;
  }): Promise<{ entities: Artifact[]; total: number }> {
    const runId = options?.runId;
    const stageId = options?.stageId;
    const type = options?.type;
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    let query = `SELECT * FROM artifacts WHERE 1=1`;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (runId) {
      query += ` AND run_id = $${paramIndex}`;
      params.push(runId);
      paramIndex++;
    }

    if (stageId) {
      query += ` AND stage_id = $${paramIndex}`;
      params.push(stageId);
      paramIndex++;
    }

    if (type) {
      query += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    // Exclude expired artifacts
    query += ` AND (expires_at IS NULL OR expires_at > NOW())`;

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    const entities = result.rows.map((row: any) => this.mapRowToEntity(row));

    // Get total count
    const countQuery = query.replace('SELECT * FROM', 'SELECT COUNT(*) as count FROM').split(' ORDER BY')[0];
    const countResult = await this.db.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].count, 10);

    return { entities, total };
  }

  /**
   * Count artifacts with optional filters
   */
  async count(options?: {
    runId?: string;
    stageId?: string;
    type?: ArtifactType;
  }): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM artifacts WHERE 1=1`;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options?.runId) {
      query += ` AND run_id = $${paramIndex}`;
      params.push(options.runId);
      paramIndex++;
    }

    if (options?.stageId) {
      query += ` AND stage_id = $${paramIndex}`;
      params.push(options.stageId);
      paramIndex++;
    }

    if (options?.type) {
      query += ` AND type = $${paramIndex}`;
      params.push(options.type);
      paramIndex++;
    }

    query += ` AND (expires_at IS NULL OR expires_at > NOW())`;

    const result = await this.db.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Increment download count for an artifact
   */
  async recordDownload(id: string): Promise<Artifact | null> {
    const result = await this.db.query(
      `UPDATE artifacts
       SET downloaded_count = downloaded_count + 1, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Delete an artifact by ID
   */
  async deleteArtifact(id: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM artifacts WHERE id = $1`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Delete expired artifact entries
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM artifacts WHERE expires_at IS NOT NULL AND expires_at <= NOW()`,
    );
    return result.rowCount || 0;
  }

  /**
   * Delete artifacts by run ID
   */
  async cleanupByRun(runId: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM artifacts WHERE run_id = $1`,
      [runId],
    );
    return result.rowCount || 0;
  }

  protected mapRowToEntity(row: any): Artifact {
    return {
      id: row.id,
      name: row.name,
      type: row.type as ArtifactType,
      storageType: row.storage_type as ArtifactStorageType,
      storagePath: row.storage_path,
      size: row.size_bytes,
      checksum: row.checksum_sha256 || undefined,
      runId: row.run_id,
      stageId: row.stage_id || undefined,
      expiresAt: row.expires_at || undefined,
      downloadedCount: row.downloaded_count,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
