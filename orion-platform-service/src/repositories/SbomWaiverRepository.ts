import { BaseRepository } from '../db/base-repository';

export interface SbomWaiverEntity {
  id: string;
  vulnerabilityId: string;
  reason: string;
  approvedBy: string | null;
  approvedAt: Date;
  expiresAt: Date;
}

export class SbomWaiverRepository extends BaseRepository<SbomWaiverEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'sbom_waivers');
  }

  async findByVulnerabilityId(vulnerabilityId: string): Promise<SbomWaiverEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM sbom_waivers WHERE vulnerability_id = $1 ORDER BY approved_at DESC`,
      [vulnerabilityId],
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

  async deleteByVulnerabilityId(vulnerabilityId: string): Promise<void> {
    await this.db.query(
      `DELETE FROM sbom_waivers WHERE vulnerability_id = $1`,
      [vulnerabilityId],
    );
  }

  protected mapRowToEntity(row: any): SbomWaiverEntity {
    return {
      id: row.id,
      vulnerabilityId: row.vulnerability_id,
      reason: row.reason,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      expiresAt: row.expires_at,
    };
  }
}