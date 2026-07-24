/**
 * Artifact ACL Repository
 *
 * PostgreSQL-backed repository for artifact access control lists.
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';
import { DatabasePool } from '../services/database';

export interface ArtifactAclEntity {
  id: string;
  tenantId: string;
  artifactId: string;
  subjectType: string;          // user, group, service
  subjectId: string;
  permissions: string[];        // ["read", "write", "admin", "delete"]
  effect: string;               // allow, deny
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ArtifactAclRepository extends BaseRepository<ArtifactAclEntity> {
  constructor(db: DatabasePool) {
    super(db, 'artifact_acls');
  }

  async findByArtifactId(artifactId: string): Promise<ArtifactAclEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM artifact_acls WHERE artifact_id = $1 ORDER BY created_at DESC',
      [artifactId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findBySubject(subjectType: string, subjectId: string): Promise<ArtifactAclEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM artifact_acls WHERE subject_type = $1 AND subject_id = $2 ORDER BY created_at DESC',
      [subjectType, subjectId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByArtifactAndSubject(
    artifactId: string,
    subjectType: string,
    subjectId: string
  ): Promise<ArtifactAclEntity | null> {
    const result = await this.db.query(
      'SELECT * FROM artifact_acls WHERE artifact_id = $1 AND subject_type = $2 AND subject_id = $3 LIMIT 1',
      [artifactId, subjectType, subjectId],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenant(tenantId: string, filters?: {
    artifactId?: string;
    subjectType?: string;
    effect?: string;
  }): Promise<FindAllResult<ArtifactAclEntity>> {
    let query = 'SELECT * FROM artifact_acls WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    let paramIdx = 2;

    if (filters?.artifactId) {
      query += ` AND artifact_id = $${paramIdx}`;
      params.push(filters.artifactId);
      paramIdx++;
    }
    if (filters?.subjectType) {
      query += ` AND subject_type = $${paramIdx}`;
      params.push(filters.subjectType);
      paramIdx++;
    }
    if (filters?.effect) {
      query += ` AND effect = $${paramIdx}`;
      params.push(filters.effect);
      paramIdx++;
    }

    const orderBy = 'created_at';
    const orderDir = 'DESC';
    const limit = 20;
    const offset = 0;

    query += ` ORDER BY ${orderBy} ${orderDir} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    const entities = result.rows.map(row => this.mapRowToEntity(row));

    const countQuery = query.slice(0, query.indexOf(' ORDER BY'));
    const countResult = await this.db.query(countQuery, params.slice(0, -2));

    return {
      entities,
      total: parseInt(countResult.rows[0]?.count || '0', 10),
    };
  }

  protected mapRowToEntity(row: any): ArtifactAclEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      artifactId: row.artifact_id,
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      permissions: Array.isArray(row.permissions) ? row.permissions : [],
      effect: row.effect,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
