import { DatabasePool } from '../database';
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

export interface ArtifactLifecyclePolicy {
  id?: string;
  tenant_id: string;
  artifact_name?: string | null;
  max_age_days: number;
  max_count: number | null;
  keep_tags: string[];
  enabled: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface ArtifactAcl {
  id?: string;
  tenant_id: string;
  artifact_id: string;
  subject_type: 'user' | 'role' | 'project';
  subject_id: string;
  permission: 'read' | 'write' | 'admin';
  created_at?: Date;
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
    return result.rowCount > 0;
  }

  // ==================== Lifecycle Policy ====================

  async upsertLifecyclePolicy(policy: ArtifactLifecyclePolicy): Promise<ArtifactLifecyclePolicy> {
    const result = await this.pool.query(
      `INSERT INTO artifact_lifecycle_policies
       (tenant_id, artifact_name, max_age_days, max_count, keep_tags, enabled)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, artifact_name) WHERE artifact_name IS NOT NULL
       DO UPDATE SET max_age_days = $3, max_count = $4, keep_tags = $5, enabled = $6, updated_at = NOW()
       RETURNING *`,
      [policy.tenant_id, policy.artifact_name, policy.max_age_days, policy.max_count, policy.keep_tags, policy.enabled]
    );
    return result.rows[0];
  }

  async upsertDefaultLifecyclePolicy(policy: ArtifactLifecyclePolicy): Promise<ArtifactLifecyclePolicy> {
    const result = await this.pool.query(
      `INSERT INTO artifact_lifecycle_policies
       (tenant_id, artifact_name, max_age_days, max_count, keep_tags, enabled)
       VALUES ($1, NULL, $2, $3, $4, $5)
       ON CONFLICT (tenant_id) WHERE artifact_name IS NULL
       DO UPDATE SET max_age_days = $2, max_count = $3, keep_tags = $4, enabled = $5, updated_at = NOW()
       RETURNING *`,
      [policy.tenant_id, policy.max_age_days, policy.max_count, policy.keep_tags, policy.enabled]
    );
    return result.rows[0];
  }

  async findLifecyclePolicy(tenantId: string, artifactName?: string): Promise<ArtifactLifecyclePolicy | null> {
    if (artifactName) {
      const result = await this.pool.query(
        'SELECT * FROM artifact_lifecycle_policies WHERE tenant_id = $1 AND artifact_name = $2 LIMIT 1',
        [tenantId, artifactName]
      );
      return result.rows[0] || null;
    }

    const result = await this.pool.query(
      'SELECT * FROM artifact_lifecycle_policies WHERE tenant_id = $1 AND artifact_name IS NULL LIMIT 1',
      [tenantId]
    );
    return result.rows[0] || null;
  }

  async findEnabledLifecyclePolicies(tenantId: string): Promise<ArtifactLifecyclePolicy[]> {
    const result = await this.pool.query(
      'SELECT * FROM artifact_lifecycle_policies WHERE tenant_id = $1 AND enabled = true ORDER BY created_at DESC',
      [tenantId]
    );
    return result.rows;
  }

  async findExpiredArtifacts(tenantId: string, maxAgeDays: number): Promise<Artifact[]> {
    const result = await this.pool.query(
      `SELECT * FROM artifacts
       WHERE tenant_id = $1
       AND created_at < NOW() - INTERVAL '1 day' * $2
       AND status != 'DELETED'
       ORDER BY created_at ASC`,
      [tenantId, maxAgeDays]
    );
    return result.rows;
  }

  async findOldVersionsForCleanup(tenantId: string, artifactName: string, keepCount: number, keepTags: string[]): Promise<Artifact[]> {
    const tagCondition = keepTags.length > 0
      ? `AND tags IS NULL OR NOT (tags && $3::text[])`
      : `AND TRUE`;
    const params: unknown[] = [tenantId, artifactName];
    if (keepTags.length > 0) {
      params.push(keepTags);
    }

    const result = await this.pool.query(
      `SELECT * FROM artifacts
       WHERE tenant_id = $1
       AND name = $2
       AND status != 'DELETED'
       ${tagCondition}
       ORDER BY created_at DESC
       OFFSET $${params.length + 1}`,
      [...params, keepCount]
    );
    return result.rows;
  }

  async softDeleteArtifacts(ids: string[]): Promise<number> {
    const result = await this.pool.query(
      'UPDATE artifacts SET status = \'DELETED\', deleted_at = NOW() WHERE id = ANY($1::text[])',
      [ids]
    );
    return result.rowCount ?? 0;
  }

  // ==================== ACL ====================

  async findAcls(tenantId: string, artifactId: string): Promise<ArtifactAcl[]> {
    const result = await this.pool.query(
      'SELECT * FROM artifact_acls WHERE tenant_id = $1 AND artifact_id = $2',
      [tenantId, artifactId]
    );
    return result.rows;
  }

  async upsertAcl(acl: ArtifactAcl): Promise<ArtifactAcl> {
    const result = await this.pool.query(
      `INSERT INTO artifact_acls (tenant_id, artifact_id, subject_type, subject_id, permission)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, artifact_id, subject_type, subject_id)
       DO UPDATE SET permission = $5
       RETURNING *`,
      [acl.tenant_id, acl.artifact_id, acl.subject_type, acl.subject_id, acl.permission]
    );
    return result.rows[0];
  }

  async deleteAcl(tenantId: string, artifactId: string, subjectType: string, subjectId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM artifact_acls WHERE tenant_id = $1 AND artifact_id = $2 AND subject_type = $3 AND subject_id = $4',
      [tenantId, artifactId, subjectType, subjectId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findAclsBySubject(tenantId: string, subjectType: string, subjectId: string): Promise<ArtifactAcl[]> {
    const result = await this.pool.query(
      'SELECT * FROM artifact_acls WHERE tenant_id = $1 AND subject_type = $2 AND subject_id = $3',
      [tenantId, subjectType, subjectId]
    );
    return result.rows;
  }

  async hasPermission(tenantId: string, artifactId: string, subjectType: string, subjectId: string, requiredPermission: 'read' | 'write' | 'admin'): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT permission FROM artifact_acls
       WHERE tenant_id = $1 AND artifact_id = $2 AND subject_type = $3 AND subject_id = $4
       LIMIT 1`,
      [tenantId, artifactId, subjectType, subjectId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    const permission = result.rows[0].permission as string;
    if (permission === 'admin') return true;
    return permission === requiredPermission;
  }
}