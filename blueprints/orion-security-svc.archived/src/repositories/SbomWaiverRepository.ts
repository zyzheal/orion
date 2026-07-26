/**
 * SBOM Waiver Repository - PostgreSQL data access layer
 */

export interface SbomWaiverEntity {
  id: string;
  cveId: string;
  packageName: string;
  packageVersion: string;
  reason: string;
  approvedBy?: string;
  approvedAt?: Date;
  expiresAt?: Date;
  scope: string;
  scopeTarget?: string;
  createdAt: Date;
}

interface DbClient {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
}

export class SbomWaiverRepository {
  constructor(private db: DbClient) {}

  async findById(id: string): Promise<SbomWaiverEntity | undefined> {
    const result = await this.db.query('SELECT * FROM sbom_waivers WHERE id = $1', [id]);
    if (result.rows.length === 0) return undefined;
    return this.mapRow(result.rows[0]);
  }

  async findActive(): Promise<SbomWaiverEntity[]> {
    const result = await this.db.query(
      "SELECT * FROM sbom_waivers WHERE expires_at IS NULL OR expires_at > NOW() ORDER BY created_at DESC"
    );
    return result.rows.map((row: any) => this.mapRow(row));
  }

  async findAll(): Promise<{ entities: SbomWaiverEntity[]; total: number }> {
    const countResult = await this.db.query('SELECT COUNT(*) FROM sbom_waivers');
    const total = parseInt(countResult.rows[0]?.count || '0', 10);
    const dataResult = await this.db.query('SELECT * FROM sbom_waivers ORDER BY created_at DESC LIMIT 100');
    return {
      entities: dataResult.rows.map((row: any) => this.mapRow(row)),
      total,
    };
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query('DELETE FROM sbom_waivers WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private mapRow(row: any): SbomWaiverEntity {
    return {
      id: row.id,
      cveId: row.cve_id,
      packageName: row.package_name,
      packageVersion: row.package_version,
      reason: row.reason,
      approvedBy: row.approved_by || undefined,
      approvedAt: row.approved_at || undefined,
      expiresAt: row.expires_at || undefined,
      scope: row.scope,
      scopeTarget: row.scope_target || undefined,
      createdAt: row.created_at,
    };
  }
}
