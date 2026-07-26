import { DatabasePool } from '../utils/database';
/**
 * ArtifactRepository - Database layer for Artifact operations
 */


export interface Artifact {
  id: string;
  tenant_id: string;
  name: string;
  version: string;
  type: string;
  size_bytes: number;
  checksum: string;
  storage_location: string;
  metadata: Record<string, any>;
  created_at: Date;
}

export class ArtifactRepository {
  constructor(private pool: DatabasePool) {}

  async findById(id: string): Promise<Artifact | null> {
    return (await this.pool.query('SELECT * FROM artifacts WHERE id = $1', [id])).rows[0] || null;
  }

  async findAll(tenantId: string, limit: number = 50): Promise<Artifact[]> {
    return (await this.pool.query(
      'SELECT * FROM artifacts WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2',
      [tenantId, limit]
    )).rows;
  }

  async findByName(tenantId: string, name: string): Promise<Artifact[]> {
    return (await this.pool.query(
      'SELECT * FROM artifacts WHERE tenant_id = $1 AND name = $2 ORDER BY created_at DESC',
      [tenantId, name]
    )).rows;
  }

  async create(tenantId: string, name: string, version: string, type: string, sizeBytes: number, checksum: string, storageLocation: string, metadata?: Record<string, any>): Promise<Artifact> {
    const result = await this.pool.query(
      'INSERT INTO artifacts (tenant_id, name, version, type, size_bytes, checksum, storage_location, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [tenantId, name, version, type, sizeBytes, checksum, storageLocation, metadata || {}]
    );
    return result.rows[0];
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM artifacts WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }
}