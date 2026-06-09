import { BaseRepository } from '../db/base-repository';

export interface KnownIssueEntity {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  fingerprint: string;
  labelSelectors?: Record<string, string>;
  ticketId: string | null;
  resolved: boolean;
  resolvedAt: Date | null;
  createdAt: Date;
}

export class KnownIssueRepository extends BaseRepository<KnownIssueEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'known_issues');
  }

  async findByTenantId(tenantId: string): Promise<KnownIssueEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM known_issues WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findOpen(tenantId?: string): Promise<KnownIssueEntity[]> {
    let query = `SELECT * FROM known_issues WHERE resolved = false ORDER BY created_at DESC`;
    const params: any[] = [];
    if (tenantId) {
      query = `SELECT * FROM known_issues WHERE tenant_id = $1 AND resolved = false ORDER BY created_at DESC`;
      params.push(tenantId);
    }
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByFingerprint(fingerprint: string): Promise<KnownIssueEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM known_issues WHERE fingerprint = $1`,
      [fingerprint],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async resolve(id: string, resolvedAt?: Date): Promise<KnownIssueEntity | null> {
    const time = resolvedAt ?? new Date();
    const result = await this.db.query(
      `UPDATE known_issues SET resolved = true, resolved_at = $1 WHERE id = $2 RETURNING *`,
      [time, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): KnownIssueEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      description: row.description,
      fingerprint: row.fingerprint,
      labelSelectors: row.label_selectors ?? undefined,
      ticketId: row.ticket_id,
      resolved: row.resolved ?? false,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
    };
  }
}