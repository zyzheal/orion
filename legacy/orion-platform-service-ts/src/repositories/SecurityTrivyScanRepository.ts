import { BaseRepository } from '../db/base-repository';

export interface SecurityTrivyScanEntity {
  id: string;
  imageName: string;
  scannedAt: Date;
  scannerVersion: string | null;
  vulnerabilities: any[];
  summary: Record<string, any>;
  passed: boolean;
  tenantId: string | null;
  createdAt: Date;
}

export class SecurityTrivyScanRepository extends BaseRepository<SecurityTrivyScanEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'security_trivy_scans');
  }

  async findByImageName(imageName: string, limit: number = 10): Promise<SecurityTrivyScanEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM security_trivy_scans WHERE image_name = $1 ORDER BY created_at DESC LIMIT $2`,
      [imageName, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): SecurityTrivyScanEntity {
    return {
      id: row.id,
      imageName: row.image_name,
      scannedAt: row.scanned_at,
      scannerVersion: row.scanner_version,
      vulnerabilities: typeof row.vulnerabilities === 'string' ? JSON.parse(row.vulnerabilities) : (row.vulnerabilities || []),
      summary: typeof row.summary === 'string' ? JSON.parse(row.summary) : (row.summary || {}),
      passed: row.passed,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
    };
  }
}
