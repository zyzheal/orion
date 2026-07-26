/**
 * ArtifactScanRepository — PostgreSQL data access for scan reports, findings, and malicious detections.
 */
import { DatabasePool } from '../utils/database';

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
  summary: Record<string, any>;
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
  id: string;
  tenant_id: string;
  artifact_id: string;
  detected: boolean;
  risk_level: string;
  reasons: string[];
  details: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export class ScanReportRepository {
  constructor(private pool: DatabasePool) {}

  async create(data: {
    id: string; tenant_id: string; artifact_id: string; scan_id: string;
    scan_type: string; status: string; started_at: Date; completed_at: Date | null;
    duration_ms: number | null; summary: Record<string, any>; passed: boolean;
  }): Promise<ScanReportEntity> {
    const result = await this.pool.query(
      `INSERT INTO scan_reports (id, tenant_id, artifact_id, scan_id, scan_type, status, started_at, completed_at, duration_ms, summary, passed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [data.id, data.tenant_id, data.artifact_id, data.scan_id, data.scan_type, data.status, data.started_at, data.completed_at, data.duration_ms, data.summary, data.passed]
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<ScanReportEntity | null> {
    const result = await this.pool.query('SELECT * FROM scan_reports WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findByArtifactId(artifactId: string): Promise<ScanReportEntity[]> {
    const result = await this.pool.query('SELECT * FROM scan_reports WHERE artifact_id = $1 ORDER BY started_at DESC', [artifactId]);
    return result.rows;
  }

  async findLatestByArtifact(artifactId: string): Promise<ScanReportEntity | null> {
    const result = await this.pool.query('SELECT * FROM scan_reports WHERE artifact_id = $1 ORDER BY started_at DESC LIMIT 1', [artifactId]);
    return result.rows[0] || null;
  }
}

export class ScanFindingRepository {
  constructor(private pool: DatabasePool) {}

  async create(data: {
    id: string; report_id: string; severity: string; type: string; title: string;
    description: string | null; location: string | null; cve: string | null; remediation: string | null;
  }): Promise<ScanFindingEntity> {
    const result = await this.pool.query(
      `INSERT INTO scan_findings (id, report_id, severity, type, title, description, location, cve, remediation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [data.id, data.report_id, data.severity, data.type, data.title, data.description, data.location, data.cve, data.remediation]
    );
    return result.rows[0];
  }

  async findByReportId(reportId: string): Promise<ScanFindingEntity[]> {
    const result = await this.pool.query('SELECT * FROM scan_findings WHERE report_id = $1 ORDER BY severity ASC', [reportId]);
    return result.rows;
  }
}

export class MaliciousDetectionRepository {
  constructor(private pool: DatabasePool) {}

  async upsert(data: {
    tenant_id: string; artifact_id: string; detected: boolean; risk_level: string;
    reasons: string[]; details: Record<string, any>;
  }): Promise<MaliciousDetectionEntity> {
    const id = `det_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.pool.query(
      `INSERT INTO malicious_detections (id, tenant_id, artifact_id, detected, risk_level, reasons, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, data.tenant_id, data.artifact_id, data.detected, data.risk_level, data.reasons, data.details]
    );
    return result.rows[0];
  }

  async findByArtifact(tenantId: string, artifactId: string): Promise<MaliciousDetectionEntity | null> {
    const result = await this.pool.query(
      'SELECT * FROM malicious_detections WHERE tenant_id = $1 AND artifact_id = $2 ORDER BY created_at DESC LIMIT 1',
      [tenantId, artifactId]
    );
    return result.rows[0] || null;
  }

  async findByTenantDetected(tenantId: string): Promise<MaliciousDetectionEntity[]> {
    const result = await this.pool.query(
      'SELECT * FROM malicious_detections WHERE tenant_id = $1 AND detected = true ORDER BY created_at DESC',
      [tenantId]
    );
    return result.rows;
  }
}
