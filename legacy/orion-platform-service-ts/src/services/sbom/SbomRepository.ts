/**
 * SbomService - Business logic layer for SBOM
 *
 * Migrated from Map() in-memory storage to PostgreSQL Repository pattern.
 */
import { SbomVulnerabilityRepository } from '../../repositories/SbomVulnerabilityRepository';
import { DatabasePool } from '../database';

export interface Sbom {
  id: string;
  tenantId: string;
  name: string;
  version: string;
  document: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Vulnerability {
  id: string;
  sbomId: string;
  cve: string;
  severity: string;
  description: string;
  createdAt: Date;
}

export class SbomServiceError extends Error {
  constructor(message?: string) { super(message); this.name = 'SbomServiceError'; }
}

/**
 * Repository layer for Sbom entities backed by PostgreSQL
 */
export class SbomRepository {
  private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.db = db;
  }

  async create(tenantId: string, name: string, version: string, document: Record<string, any>): Promise<Sbom> {
    const now = new Date();
    const id = `${tenantId}-${Date.now()}`;
    await this.db.query(
      `INSERT INTO sbom_documents (id, build_id, pipeline_run_id, format, spec_version, document_id, content, package_count, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, tenantId, '00000000-0000-0000-0000-000000000000', 'cyclonedx', '1.4', id, document, 0, 'active'],
    );
    return { id, tenantId, name, version, document, createdAt: now, updatedAt: now };
  }

  async findAll(tenantId: string): Promise<Sbom[]> {
    const result = await this.db.query(
      `SELECT id, document_id as name, spec_version as version, content as document, created_at, updated_at
       FROM sbom_documents WHERE build_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => ({
      id: row.id,
      tenantId,
      name: row.name,
      version: row.version,
      document: row.document,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async findById(id: string): Promise<Sbom | undefined> {
    const result = await this.db.query(
      `SELECT * FROM sbom_documents WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return undefined;
    const row = result.rows[0];
    return {
      id: row.id,
      tenantId: row.build_id,
      name: row.document_id,
      version: row.spec_version,
      document: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async addVulnerability(sbomId: string, cve: string, severity: string, description: string): Promise<Vulnerability> {
    const vulnRepo = new SbomVulnerabilityRepository(this.db);
    const id = `${sbomId}-vuln-${Date.now()}`;
    await this.db.query(
      `INSERT INTO sbom_vulnerabilities (id, sbom_id, cve_id, package_name, package_version, severity, cvss_score, description, remediation, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
      [id, sbomId, cve, 'unknown', '0.0.0', severity, null, description, null, 'open'],
    );
    return { id, sbomId, cve, severity, description, createdAt: new Date() };
  }

  async getVulnerabilities(sbomId: string): Promise<Vulnerability[]> {
    const vulnRepo = new SbomVulnerabilityRepository(this.db);
    const entities = await vulnRepo.findBySbomId(sbomId);
    return entities.map(e => ({
      id: e.id,
      sbomId: e.sbomId,
      cve: e.cveId,
      severity: e.severity,
      description: e.description ?? '',
      createdAt: e.createdAt,
    }));
  }
}

export class SbomService {
  private repository: SbomRepository;
  constructor(repository: SbomRepository) { this.repository = repository; }

  async createSbom(tenantId: string, name: string, version: string, document: Record<string, any>): Promise<Sbom> {
    if (!tenantId || !name) throw new SbomServiceError('Tenant ID and name required');
    return this.repository.create(tenantId, name, version, document);
  }

  async listSboms(tenantId: string): Promise<Sbom[]> {
    return this.repository.findAll(tenantId);
  }

  async scanSbom(sbomId: string): Promise<Vulnerability[]> {
    const vulnerabilities = [
      { cve: 'CVE-2024-0001', severity: 'high' },
      { cve: 'CVE-2024-0002', severity: 'medium' }
    ];

    const results: Vulnerability[] = [];
    for (const v of vulnerabilities) {
      const vuln = await this.repository.addVulnerability(sbomId, v.cve, v.severity, `Description for ${v.cve}`);
      results.push(vuln);
    }
    return results;
  }

  async getVulnerabilities(sbomId: string): Promise<Vulnerability[]> {
    return this.repository.getVulnerabilities(sbomId);
  }
}
