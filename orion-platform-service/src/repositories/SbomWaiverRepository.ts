import { BaseRepository } from '../db/base-repository';

export interface SbomWaiverEntity {
  id: string;
  cveId: string;
  packageName: string;
  packageVersion: string;
  reason: string;
  approvedBy: string | null;
  approvedAt: Date;
  expiresAt: Date;
  scope: string | null;
  scopeTarget: string | null;
}

export class SbomWaiverRepository extends BaseRepository<SbomWaiverEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'sbom_waivers');
  }

  async findByCveId(cveId: string): Promise<SbomWaiverEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM sbom_waivers WHERE cve_id = $1 ORDER BY approved_at DESC`,
      [cveId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findExpired(): Promise<SbomWaiverEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM sbom_waivers WHERE expires_at < NOW() ORDER BY expires_at ASC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findActive(): Promise<SbomWaiverEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM sbom_waivers WHERE expires_at > NOW() ORDER BY expires_at ASC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): SbomWaiverEntity {
    return {
      id: row.id,
      cveId: row.cve_id,
      packageName: row.package_name,
      packageVersion: row.package_version,
      reason: row.reason,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      expiresAt: row.expires_at,
      scope: row.scope,
      scopeTarget: row.scope_target,
    };
  }
}