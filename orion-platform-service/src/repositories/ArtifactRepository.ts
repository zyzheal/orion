/**
 * Artifact Repository Interface
 * 制品仓库数据访问层
 */

import { Artifact, ArtifactType, ArtifactStatus, ArtifactQueryOptions } from '../models/Artifact';

export interface ArtifactRepository {
  create(artifact: Artifact): Promise<void>;
  findById(id: string): Promise<Artifact | null>;
  findByNamespaceNameVersion(namespace: string, name: string, version: string): Promise<Artifact | null>;
  find(options: ArtifactQueryOptions): Promise<{ artifacts: Artifact[]; total: number }>;
  update(artifact: Artifact): Promise<void>;
  softDelete(id: string): Promise<void>;
  addTag(artifactId: string, tag: string): Promise<void>;
  removeTag(artifactId: string, tag: string): Promise<void>;
  getTags(artifactId: string): Promise<any[]>;
  recordDownload(download: any): Promise<void>;
  getDownloadHistory(artifactId: string): Promise<any[]>;
  search(query: string): Promise<Artifact[]>;
}

export class PostgresArtifactRepository implements ArtifactRepository {
  constructor(private db: any) {}

  async create(artifact: Artifact): Promise<void> {
    const query = `
      INSERT INTO artifact_registry (
        id, name, namespace, version, artifact_type, status, 
        size_bytes, checksum_sha256, checksum_sha512, metadata, 
        storage_path, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `;
    
    await this.db.query(query, [
      artifact.id,
      artifact.name,
      artifact.namespace,
      artifact.version,
      artifact.type,
      artifact.status,
      artifact.sizeBytes,
      artifact.checksumSha256,
      artifact.checksumSha512,
      JSON.stringify(artifact.metadata),
      artifact.storagePath,
      artifact.createdBy,
      artifact.createdAt,
      artifact.updatedAt
    ]);
  }

  async findById(id: string): Promise<Artifact | null> {
    const query = `
      SELECT * FROM artifact_registry 
      WHERE id = $1 AND deleted_at IS NULL
    `;
    
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToArtifact(result.rows[0]);
  }

  async findByNamespaceNameVersion(namespace: string, name: string, version: string): Promise<Artifact | null> {
    const query = `
      SELECT * FROM artifact_registry 
      WHERE namespace = $1 AND name = $2 AND version = $3 AND deleted_at IS NULL
    `;
    
    const result = await this.db.query(query, [namespace, name, version]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToArtifact(result.rows[0]);
  }

  async find(options: ArtifactQueryOptions): Promise<{ artifacts: Artifact[]; total: number }> {
    let query = `
      SELECT * FROM artifact_registry 
      WHERE deleted_at IS NULL
    `;
    
    const queryParams: any[] = [];
    let paramIndex = 1;
    
    // 添加过滤条件
    if (options.namespace) {
      query += ` AND namespace = $${paramIndex}`;
      queryParams.push(options.namespace);
      paramIndex++;
    }
    
    if (options.name) {
      query += ` AND name = $${paramIndex}`;
      queryParams.push(options.name);
      paramIndex++;
    }
    
    if (options.type) {
      query += ` AND artifact_type = $${paramIndex}`;
      queryParams.push(options.type);
      paramIndex++;
    }
    
    if (options.status) {
      query += ` AND status = $${paramIndex}`;
      queryParams.push(options.status);
      paramIndex++;
    }
    
    // 添加标签过滤
    if (options.tags && options.tags.length > 0) {
      query += ` AND id IN (
        SELECT DISTINCT artifact_id FROM artifact_tags 
        WHERE tag = ANY($${paramIndex})
      )`;
      queryParams.push(options.tags);
      paramIndex++;
    }
    
    // 添加排序 (whitelist to prevent SQL injection)
    const sortBy = options.sortBy || 'created_at';
    const sortOrder = options.sortOrder || 'DESC';
    const allowedOrderColumns = ['created_at', 'updated_at', 'name', 'version', 'size_bytes', 'status'];
    const safeColumn = allowedOrderColumns.includes(sortBy) ? sortBy : 'created_at';
    const safeDir = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${safeColumn} ${safeDir}`;
    
    // 添加分页
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);
    
    // 执行查询
    const result = await this.db.query(query, queryParams);
    
    // 获取总数
    const countQuery = query.replace('SELECT * FROM', 'SELECT COUNT(*) FROM').split(' LIMIT ')[0];
    const countResult = await this.db.query(countQuery, queryParams.slice(0, -2));
    
    return {
      artifacts: result.rows.map((row: any) => this.mapRowToArtifact(row)),
      total: parseInt(countResult.rows[0].count)
    };
  }

  async update(artifact: Artifact): Promise<void> {
    const query = `
      UPDATE artifact_registry 
      SET name = $2, namespace = $3, version = $4, status = $5,
          size_bytes = $6, checksum_sha256 = $7, checksum_sha512 = $8,
          metadata = $9, storage_path = $10, updated_at = $11
      WHERE id = $1
    `;
    
    await this.db.query(query, [
      artifact.id,
      artifact.name,
      artifact.namespace,
      artifact.version,
      artifact.status,
      artifact.sizeBytes,
      artifact.checksumSha256,
      artifact.checksumSha512,
      JSON.stringify(artifact.metadata),
      artifact.storagePath,
      artifact.updatedAt
    ]);
  }

  async softDelete(id: string): Promise<void> {
    const query = `
      UPDATE artifact_registry 
      SET deleted_at = NOW()
      WHERE id = $1
    `;
    
    await this.db.query(query, [id]);
  }

  async addTag(artifactId: string, tag: string): Promise<void> {
    const query = `
      INSERT INTO artifact_tags (artifact_id, tag, created_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (artifact_id, tag) DO NOTHING
    `;
    
    await this.db.query(query, [artifactId, tag]);
  }

  async removeTag(artifactId: string, tag: string): Promise<void> {
    const query = `
      DELETE FROM artifact_tags 
      WHERE artifact_id = $1 AND tag = $2
    `;
    
    await this.db.query(query, [artifactId, tag]);
  }

  async getTags(artifactId: string): Promise<any[]> {
    const query = `
      SELECT tag, created_at FROM artifact_tags 
      WHERE artifact_id = $1 
      ORDER BY created_at DESC
    `;
    
    const result = await this.db.query(query, [artifactId]);
    return result.rows;
  }

  async recordDownload(download: any): Promise<void> {
    const query = `
      INSERT INTO artifact_downloads (
        artifact_id, downloaded_by, downloaded_at, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5)
    `;
    
    await this.db.query(query, [
      download.artifactId,
      download.downloadedBy,
      download.downloadedAt,
      download.ipAddress,
      download.userAgent
    ]);
  }

  async getDownloadHistory(artifactId: string): Promise<any[]> {
    const query = `
      SELECT * FROM artifact_downloads 
      WHERE artifact_id = $1 
      ORDER BY downloaded_at DESC
    `;
    
    const result = await this.db.query(query, [artifactId]);
    return result.rows;
  }

  async search(query: string): Promise<Artifact[]> {
    const searchQuery = `
      SELECT * FROM artifact_registry 
      WHERE deleted_at IS NULL 
      AND (
        name ILIKE $1 
        OR namespace ILIKE $1 
        OR version ILIKE $1 
        OR metadata::text ILIKE $1
      )
      ORDER BY created_at DESC
      LIMIT 50
    `;
    
    const searchTerm = `%${query}%`;
    const result = await this.db.query(searchQuery, [searchTerm]);
    
    return result.rows.map((row: any) => this.mapRowToArtifact(row));
  }

  // 添加统计方法
  async getStats(): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'AVAILABLE' THEN 1 END) as available,
        COUNT(CASE WHEN status = 'DEPRECATED' THEN 1 END) as deprecated,
        COUNT(CASE WHEN status = 'QUARANTINED' THEN 1 END) as quarantined,
        SUM(size_bytes) as total_size
      FROM artifact_registry 
      WHERE deleted_at IS NULL
    `;
    
    const result = await this.db.query(query);
    return result.rows[0];
  }

  async getTypeStats(): Promise<any[]> {
    const query = `
      SELECT 
        artifact_type,
        COUNT(*) as count,
        SUM(size_bytes) as total_size
      FROM artifact_registry 
      WHERE deleted_at IS NULL
      GROUP BY artifact_type
      ORDER BY count DESC
    `;
    
    const result = await this.db.query(query);
    return result.rows;
  }

  async getNamespaces(): Promise<any[]> {
    const query = `
      SELECT 
        namespace,
        COUNT(*) as count
      FROM artifact_registry 
      WHERE deleted_at IS NULL
      GROUP BY namespace
      ORDER BY count DESC
    `;
    
    const result = await this.db.query(query);
    return result.rows;
  }

  private mapRowToArtifact(row: any): Artifact {
    return {
      id: row.id,
      name: row.name,
      namespace: row.namespace,
      version: row.version,
      type: row.artifact_type,
      status: row.status,
      sizeBytes: row.size_bytes,
      checksumSha256: row.checksum_sha256,
      checksumSha512: row.checksum_sha512,
      metadata: row.metadata || {},
      storagePath: row.storage_path,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at
    };
  }
}