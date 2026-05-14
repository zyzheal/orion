/**
 * PostgresArtifactRepository — PostgreSQL data access for the artifact registry.
 */
import { DatabasePool } from '../utils/database';

export interface ArtifactEntity {
  id: string;
  name: string;
  namespace: string;
  version: string;
  type: string;
  status: string;
  size_bytes: number;
  checksum_sha256: string | null;
  checksum_sha512: string | null;
  metadata: Record<string, any>;
  storage_path: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export class PostgresArtifactRepository {
  constructor(private pool: DatabasePool) {}

  async findById(id: string): Promise<ArtifactEntity | null> {
    const result = await this.pool.query('SELECT * FROM registry_artifacts WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findByNamespaceNameVersion(namespace: string, name: string, version: string): Promise<ArtifactEntity | null> {
    const result = await this.pool.query(
      'SELECT * FROM registry_artifacts WHERE namespace = $1 AND name = $2 AND version = $3',
      [namespace, name, version]
    );
    return result.rows[0] || null;
  }

  async create(data: ArtifactEntity): Promise<ArtifactEntity> {
    const result = await this.pool.query(
      `INSERT INTO registry_artifacts (id, name, namespace, version, type, status, size_bytes, checksum_sha256, checksum_sha512, metadata, storage_path, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [data.id, data.name, data.namespace, data.version, data.type, data.status, data.size_bytes, data.checksum_sha256, data.checksum_sha512, data.metadata, data.storage_path, data.created_by]
    );
    return result.rows[0];
  }

  async update(data: ArtifactEntity): Promise<ArtifactEntity> {
    const result = await this.pool.query(
      'UPDATE registry_artifacts SET status = $1, metadata = $2, updated_at = $3 WHERE id = $4 RETURNING *',
      [data.status, data.metadata, new Date(), data.id]
    );
    return result.rows[0];
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      "UPDATE registry_artifacts SET status = 'deleted', updated_at = $1 WHERE id = $2",
      [new Date(), id]
    );
    return (result.rowCount || 0) > 0;
  }

  async addTag(id: string, tag: string): Promise<void> {
    await this.pool.query(
      'INSERT INTO artifact_tags (artifact_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [id, tag]
    );
  }

  async removeTag(id: string, tag: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM artifact_tags WHERE artifact_id = $1 AND tag = $2',
      [id, tag]
    );
  }

  async getTags(id: string): Promise<{ tag: string }[]> {
    const result = await this.pool.query(
      'SELECT tag FROM artifact_tags WHERE artifact_id = $1',
      [id]
    );
    return result.rows;
  }

  async recordDownload(data: { artifactId: string; downloadedBy: string; ipAddress?: string; userAgent?: string }): Promise<void> {
    await this.pool.query(
      'INSERT INTO artifact_downloads (artifact_id, downloaded_by, ip_address, user_agent) VALUES ($1, $2, $3, $4)',
      [data.artifactId, data.downloadedBy, data.ipAddress || null, data.userAgent || null]
    );
  }

  async getDownloadHistory(id: string): Promise<any[]> {
    const result = await this.pool.query(
      'SELECT * FROM artifact_downloads WHERE artifact_id = $1 ORDER BY created_at DESC',
      [id]
    );
    return result.rows;
  }

  async find(options: {
    namespace?: string; type?: string; status?: string;
    limit?: number; offset?: number;
  }): Promise<{ artifacts: ArtifactEntity[]; total: number }> {
    let query = 'SELECT * FROM registry_artifacts WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (options.namespace) { query += ` AND namespace = $${idx++}`; params.push(options.namespace); }
    if (options.type) { query += ` AND type = $${idx++}`; params.push(options.type); }
    if (options.status) { query += ` AND status = $${idx++}`; params.push(options.status); }

    const limit = options.limit || 50;
    const offset = options.offset || 0;
    query += ` ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(limit, offset);

    const result = await this.pool.query(query, params);
    return { artifacts: result.rows, total: result.rows.length };
  }

  async search(query: string): Promise<ArtifactEntity[]> {
    const result = await this.pool.query(
      "SELECT * FROM registry_artifacts WHERE name ILIKE $1 OR namespace ILIKE $1 OR type ILIKE $1 ORDER BY created_at DESC",
      [`%${query}%`]
    );
    return result.rows;
  }

  async getStats(): Promise<{ totalArtifacts: number; totalSize: number }> {
    const result = await this.pool.query('SELECT COUNT(*) as total, COALESCE(SUM(size_bytes), 0) as size FROM registry_artifacts');
    return { totalArtifacts: parseInt(result.rows[0]?.total || '0', 10), totalSize: parseInt(result.rows[0]?.size || '0', 10) };
  }

  async getTypeStats(): Promise<{ type: string; count: number }[]> {
    const result = await this.pool.query('SELECT type, COUNT(*) as count FROM registry_artifacts GROUP BY type');
    return result.rows;
  }

  async getNamespaces(): Promise<string[]> {
    const result = await this.pool.query('SELECT DISTINCT namespace FROM registry_artifacts ORDER BY namespace');
    return result.rows.map((r: any) => r.namespace);
  }
}
