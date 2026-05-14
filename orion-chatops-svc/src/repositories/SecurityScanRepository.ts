/**
 * SecurityScanRepository - Database layer for security scan history persistence
 */

import { BaseRepository } from '../db/base-repository';

export interface SecurityScanEntity {
  id: string;
  tenantId: string | null;
  scanType: 'secret' | 'sast' | 'dependency' | 'composite';
  repository: string;
  branch: string | null;
  commitHash: string | null;
  status: 'success' | 'failed' | 'partial';
  scanner: string;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  gateFailed: boolean;
  scanStartTime: Date;
  scanEndTime: Date;
  durationMs: number;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

export interface SecurityFindingEntity {
  id: string;
  scanId: string;
  ruleId: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string | null;
  title: string;
  description: string | null;
  file: string | null;
  lineStart: number | null;
  lineEnd: number | null;
  codeSnippet: string | null;
  match: string | null;
  confidence: number;
  remediation: string | null;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

export interface CreateScanInput {
  id: string;
  tenantId?: string;
  scanType: SecurityScanEntity['scanType'];
  repository: string;
  branch?: string;
  commitHash?: string;
  status: SecurityScanEntity['status'];
  scanner: string;
  findingsCount?: number;
  criticalCount?: number;
  highCount?: number;
  mediumCount?: number;
  lowCount?: number;
  infoCount?: number;
  gateFailed?: boolean;
  scanStartTime: Date;
  scanEndTime: Date;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateFindingInput {
  id: string;
  scanId: string;
  ruleId?: string;
  severity: SecurityFindingEntity['severity'];
  category?: string;
  title: string;
  description?: string;
  file?: string;
  lineStart?: number;
  lineEnd?: number;
  codeSnippet?: string;
  match?: string;
  confidence?: number;
  remediation?: string;
  metadata?: Record<string, unknown>;
}

export class SecurityScanRepository extends BaseRepository<SecurityScanEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'security_scans');
  }

  /**
   * Find scans by repository
   */
  async findByRepository(
    repository: string,
    options?: { limit?: number; offset?: number }
  ): Promise<SecurityScanEntity[]> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    const result = await this.db.query(
      `SELECT * FROM security_scans WHERE repository = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [repository, limit, offset]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find scans by tenant
   */
  async findByTenant(
    tenantId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<SecurityScanEntity[]> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    const result = await this.db.query(
      `SELECT * FROM security_scans WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find recent scans with gate failures
   */
  async findFailedGates(limit: number = 10): Promise<SecurityScanEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM security_scans WHERE gate_failed = true ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Get scan statistics summary
   */
  async getScanStats(repository?: string): Promise<{
    totalScans: number;
    successCount: number;
    failedCount: number;
    avgFindings: number;
  }> {
    let query = `SELECT
      COUNT(*) as total_scans,
      COUNT(*) FILTER (WHERE status = 'success') as success_count,
      COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
      AVG(findings_count) as avg_findings
    FROM security_scans`;
    const params: string[] = [];

    if (repository) {
      query += ` WHERE repository = $1`;
      params.push(repository);
    }

    const result = await this.db.query(query, params);
    const row = result.rows[0];
    return {
      totalScans: parseInt(row.total_scans, 10) || 0,
      successCount: parseInt(row.success_count, 10) || 0,
      failedCount: parseInt(row.failed_count, 10) || 0,
      avgFindings: parseFloat(row.avg_findings) || 0,
    };
  }

  protected mapRowToEntity(row: any): SecurityScanEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      scanType: row.scan_type,
      repository: row.repository,
      branch: row.branch,
      commitHash: row.commit_hash,
      status: row.status,
      scanner: row.scanner,
      findingsCount: row.findings_count ?? 0,
      criticalCount: row.critical_count ?? 0,
      highCount: row.high_count ?? 0,
      mediumCount: row.medium_count ?? 0,
      lowCount: row.low_count ?? 0,
      infoCount: row.info_count ?? 0,
      gateFailed: row.gate_failed ?? false,
      scanStartTime: row.scan_start_time,
      scanEndTime: row.scan_end_time,
      durationMs: row.duration_ms ?? 0,
      createdAt: row.created_at,
      metadata: row.metadata ?? {},
    };
  }
}

/**
 * Repository for security findings
 */
export class SecurityFindingRepository extends BaseRepository<SecurityFindingEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'security_findings');
  }

  /**
   * Find all findings for a scan
   */
  async findByScanId(scanId: string): Promise<SecurityFindingEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM security_findings WHERE scan_id = $1 ORDER BY severity, created_at`,
      [scanId]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find findings by severity
   */
  async findBySeverity(
    severity: SecurityFindingEntity['severity'],
    options?: { limit?: number }
  ): Promise<SecurityFindingEntity[]> {
    const limit = options?.limit ?? 50;
    const result = await this.db.query(
      `SELECT * FROM security_findings WHERE severity = $1 ORDER BY created_at DESC LIMIT $2`,
      [severity, limit]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Batch create findings for a scan
   */
  async batchCreate(findings: CreateFindingInput[]): Promise<SecurityFindingEntity[]> {
    if (findings.length === 0) return [];

    const results: SecurityFindingEntity[] = [];
    for (const finding of findings) {
      const created = await this.create({
        id: finding.id,
        scan_id: finding.scanId,
        rule_id: finding.ruleId ?? null,
        severity: finding.severity,
        category: finding.category ?? null,
        title: finding.title,
        description: finding.description ?? null,
        file: finding.file ?? null,
        line_start: finding.lineStart ?? null,
        line_end: finding.lineEnd ?? null,
        code_snippet: finding.codeSnippet ?? null,
        match: finding.match ?? null,
        confidence: finding.confidence ?? 0.8,
        remediation: finding.remediation ?? null,
        metadata: finding.metadata ?? {},
      } as any);
      results.push(created);
    }
    return results;
  }

  protected mapRowToEntity(row: any): SecurityFindingEntity {
    return {
      id: row.id,
      scanId: row.scan_id,
      ruleId: row.rule_id,
      severity: row.severity,
      category: row.category,
      title: row.title,
      description: row.description,
      file: row.file,
      lineStart: row.line_start,
      lineEnd: row.line_end,
      codeSnippet: row.code_snippet,
      match: row.match,
      confidence: row.confidence,
      remediation: row.remediation,
      createdAt: row.created_at,
      metadata: row.metadata ?? {},
    };
  }
}

export default SecurityScanRepository;