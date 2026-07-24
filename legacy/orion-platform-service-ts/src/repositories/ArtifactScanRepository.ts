/**
 * ArtifactScanRepository
 *
 * PostgreSQL-backed repository for artifact scan reports and malicious detections.
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';
import { DatabasePool } from '../services/database';

export interface ScanReportEntity {
  id: string;
  tenant_id: string;
  artifact_id: string;
  scan_id: string;
  scan_type: string;
  status: string;
  started_at: Date;
  completed_at: Date | null;
  duration_ms: number | null;
  summary: Record<string, number>;
  passed: boolean;
}

export interface ScanFindingEntity {
  id: string;
  report_id: string;
  severity: string;
  type: string;
  title: string;
  description: string | null;
  location: string | null;
  cve: string | null;
  remediation: string | null;
}

export interface MaliciousDetectionEntity {
  id: number;
  tenant_id: string;
  artifact_id: string;
  detected: boolean;
  risk_level: string;
  reasons: string[];
  details: Record<string, unknown>;
  created_at: Date;
}

export class ScanReportRepository extends BaseRepository<ScanReportEntity> {
  constructor(db: DatabasePool) {
    super(db, 'scan_reports');
  }

  async findByArtifactId(artifactId: string): Promise<ScanReportEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM scan_reports WHERE artifact_id = $1 ORDER BY started_at DESC',
      [artifactId]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenant(tenantId: string, options?: FindAllOptions): Promise<FindAllResult<ScanReportEntity>> {
    return this.findAll({
      ...options,
      where: { ...options?.where, tenant_id: tenantId },
    });
  }

  async findLatestByArtifact(artifactId: string): Promise<ScanReportEntity | undefined> {
    const result = await this.db.query(
      'SELECT * FROM scan_reports WHERE artifact_id = $1 ORDER BY started_at DESC LIMIT 1',
      [artifactId]
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ScanReportEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      artifact_id: row.artifact_id,
      scan_id: row.scan_id,
      scan_type: row.scan_type,
      status: row.status,
      started_at: row.started_at,
      completed_at: row.completed_at,
      duration_ms: row.duration_ms,
      summary: row.summary ?? {},
      passed: row.passed,
    };
  }
}

export class ScanFindingRepository extends BaseRepository<ScanFindingEntity> {
  constructor(db: DatabasePool) {
    super(db, 'scan_findings');
  }

  async findByReportId(reportId: string): Promise<ScanFindingEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM scan_findings WHERE report_id = $1 ORDER BY CASE severity WHEN \'critical\' THEN 1 WHEN \'high\' THEN 2 WHEN \'medium\' THEN 3 WHEN \'low\' THEN 4 ELSE 5 END',
      [reportId]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByReportIds(reportIds: string[]): Promise<ScanFindingEntity[]> {
    if (reportIds.length === 0) return [];
    const placeholders = reportIds.map((_, i) => `$${i + 1}`).join(', ');
    const result = await this.db.query(
      `SELECT * FROM scan_findings WHERE report_id IN (${placeholders}) ORDER BY report_id, CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END`,
      reportIds
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): ScanFindingEntity {
    return {
      id: row.id,
      report_id: row.report_id,
      severity: row.severity,
      type: row.type,
      title: row.title,
      description: row.description,
      location: row.location,
      cve: row.cve,
      remediation: row.remediation,
    };
  }
}

export class MaliciousDetectionRepository {
  constructor(private db: DatabasePool) {}

  async findById(id: number): Promise<MaliciousDetectionEntity | undefined> {
    const result = await this.db.query(
      'SELECT * FROM malicious_detections WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async create(entity: Omit<MaliciousDetectionEntity, 'id' | 'created_at'>): Promise<MaliciousDetectionEntity> {
    const result = await this.db.query(
      `INSERT INTO malicious_detections (tenant_id, artifact_id, detected, risk_level, reasons, details)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [entity.tenant_id, entity.artifact_id, entity.detected, entity.risk_level,
       JSON.stringify(entity.reasons), JSON.stringify(entity.details)]
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByArtifact(tenantId: string, artifactId: string): Promise<MaliciousDetectionEntity | undefined> {
    const result = await this.db.query(
      'SELECT * FROM malicious_detections WHERE tenant_id = $1 AND artifact_id = $2',
      [tenantId, artifactId]
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenantDetected(tenantId: string): Promise<MaliciousDetectionEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM malicious_detections WHERE tenant_id = $1 AND detected = true ORDER BY created_at DESC',
      [tenantId]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async upsert(entity: Omit<MaliciousDetectionEntity, 'id' | 'created_at'>): Promise<MaliciousDetectionEntity> {
    const result = await this.db.query(
      `INSERT INTO malicious_detections (tenant_id, artifact_id, detected, risk_level, reasons, details)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, artifact_id) DO UPDATE SET
         detected = EXCLUDED.detected,
         risk_level = EXCLUDED.risk_level,
         reasons = EXCLUDED.reasons,
         details = EXCLUDED.details
       RETURNING *`,
      [entity.tenant_id, entity.artifact_id, entity.detected, entity.risk_level,
       JSON.stringify(entity.reasons), JSON.stringify(entity.details)]
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM malicious_detections WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  private mapRowToEntity(row: any): MaliciousDetectionEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      artifact_id: row.artifact_id,
      detected: row.detected,
      risk_level: row.risk_level,
      reasons: row.reasons ?? [],
      details: row.details ?? {},
      created_at: row.created_at,
    };
  }
}
