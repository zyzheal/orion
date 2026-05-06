/**
 * K8s Provisioner Repository
 *
 * PostgreSQL persistence for ephemeral namespace tracking.
 */
import { BaseRepository } from '../db/base-repository';

export interface K8sNamespaceEntity {
  id: string;
  namespace: string;
  pr_id: string | null;
  branch_name: string | null;
  status: string;
  preview_url: string | null;
  created_at: Date;
  destroyed_at: Date | null;
}

export class K8sNamespaceRepository extends BaseRepository<K8sNamespaceEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'k8s_namespaces');
  }

  async findByNamespace(namespace: string): Promise<K8sNamespaceEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM k8s_namespaces WHERE namespace = $1 ORDER BY created_at DESC LIMIT 1`,
      [namespace],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findActive(): Promise<K8sNamespaceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM k8s_namespaces WHERE status = 'active' AND destroyed_at IS NULL ORDER BY created_at DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByPr(prId: string): Promise<K8sNamespaceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM k8s_namespaces WHERE pr_id = $1 AND destroyed_at IS NULL ORDER BY created_at DESC`,
      [prId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async markDestroyed(id: string): Promise<K8sNamespaceEntity | undefined> {
    const result = await this.db.query(
      `UPDATE k8s_namespaces SET status = 'destroyed', destroyed_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): K8sNamespaceEntity {
    return {
      id: row.id,
      namespace: row.namespace,
      pr_id: row.pr_id,
      branch_name: row.branch_name,
      status: row.status ?? 'active',
      preview_url: row.preview_url,
      created_at: row.created_at,
      destroyed_at: row.destroyed_at,
    };
  }
}
