/**
 * SbomDocumentRepository - Data access layer for SBOM documents, packages, and attestations
 *
 * Covers tables: sbom_documents, sbom_packages, sbom_attestations
 */
import { BaseRepository, FindAllOptions } from '../db/base-repository';

// ==================== Entity Interfaces ====================

export interface SbomDocumentEntity {
  id: string;
  buildId: string;
  pipelineRunId: string;
  format: string;
  specVersion: string;
  documentId: string;
  content: Record<string, unknown>;
  packageCount: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
  status: string;
}

export interface SbomDocumentCreateInput {
  buildId: string;
  pipelineRunId: string;
  format: string;
  specVersion: string;
  documentId: string;
  content: Record<string, unknown>;
  packageCount?: number;
  expiresAt?: Date;
}

export interface SbomDocumentUpdateInput {
  status?: string;
  expiresAt?: Date;
}

export interface SbomPackageEntity {
  id: string;
  sbomId: string;
  name: string;
  version: string;
  purl: string | null;
  cpe: string | null;
  license: string | null;
  supplier: string | null;
  sourceLocation: string | null;
  checksum: string | null;
}

export interface SbomPackageCreateInput {
  sbomId: string;
  name: string;
  version: string;
  purl?: string;
  cpe?: string;
  license?: string;
  supplier?: string;
  sourceLocation?: string;
  checksum?: string;
}

export interface SbomAttestationEntity {
  id: string;
  sbomId: string;
  attestationType: string;
  signature: string;
  certificate: string | null;
  transparencyLogUrl: string | null;
  signedAt: Date;
  verified: boolean;
  verifiedAt: Date | null;
}

export interface SbomAttestationCreateInput {
  sbomId: string;
  attestationType: string;
  signature: string;
  certificate?: string;
  transparencyLogUrl?: string;
}

// ==================== SbomDocumentRepository ====================

export interface SbomDocumentListFilter {
  buildId?: string;
  pipelineRunId?: string;
  format?: string;
  status?: string;
  page?: number;
  perPage?: number;
}

export class SbomDocumentRepository extends BaseRepository<SbomDocumentEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'sbom_documents');
  }

  /**
   * List documents with filtering and pagination
   * Task 4.66: tenant_id filtering applied
   */
  async list(filter: SbomDocumentListFilter = {}): Promise<{ documents: SbomDocumentEntity[]; total: number }> {
    const { buildId, pipelineRunId, format, status } = filter;
    const page = filter.page ?? 1;
    const perPage = filter.perPage ?? 20;
    const tenantId = this.getTenantId();

    let query = 'SELECT * FROM sbom_documents WHERE 1=1 AND tenant_id = $1';
    const queryParams: unknown[] = [tenantId];
    let paramIndex = 2;

    if (buildId) {
      query += ' AND build_id = $' + paramIndex;
      queryParams.push(buildId);
      paramIndex++;
    }
    if (pipelineRunId) {
      query += ' AND pipeline_run_id = $' + paramIndex;
      queryParams.push(pipelineRunId);
      paramIndex++;
    }
    if (format) {
      query += ' AND format = $' + paramIndex;
      queryParams.push(format);
      paramIndex++;
    }
    if (status) {
      query += ' AND status = $' + paramIndex;
      queryParams.push(status);
      paramIndex++;
    }

    const countQuery = 'SELECT COUNT(*) as count FROM sbom_documents WHERE 1=1 AND tenant_id = $1' +
      query.slice(query.indexOf('AND tenant_id = $1') + 'AND tenant_id = $1'.length);
    const countResult = await this.db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count, 10);

    query += ' ORDER BY created_at DESC LIMIT $' + paramIndex + ' OFFSET $' + (paramIndex + 1);
    queryParams.push(perPage, (page - 1) * perPage);

    const result = await this.db.query(query, queryParams);
    const documents = result.rows.map(row => this.mapRowToEntity(row));

    return { documents, total };
  }

  /**
   * Find by buildId - Task 4.66: tenant_id filtering applied
   */
  async findByBuildId(buildId: string): Promise<SbomDocumentEntity[]> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      'SELECT * FROM sbom_documents WHERE build_id = $1 AND tenant_id = $2 ORDER BY created_at DESC',
      [buildId, tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find by pipelineRunId - Task 4.66: tenant_id filtering applied
   */
  async findByPipelineRunId(pipelineRunId: string): Promise<SbomDocumentEntity[]> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      'SELECT * FROM sbom_documents WHERE pipeline_run_id = $1 AND tenant_id = $2 ORDER BY created_at DESC',
      [pipelineRunId, tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Increment package count - Task 4.66: tenant_id filtering applied
   */
  async incrementPackageCount(sbomId: string): Promise<number> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      'UPDATE sbom_documents SET package_count = package_count + 1, updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING package_count',
      [sbomId, tenantId],
    );
    return result.rows[0]?.package_count ?? 0;
  }

  protected mapRowToEntity(row: any): SbomDocumentEntity {
    return {
      id: row.id,
      buildId: row.build_id,
      pipelineRunId: row.pipeline_run_id,
      format: row.format,
      specVersion: row.spec_version,
      documentId: row.document_id,
      content: row.content,
      packageCount: row.package_count ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
      status: row.status,
    };
  }
}

// ==================== SbomPackageRepository ====================

export class SbomPackageRepository {
  private tenantId: string = 'default';

  constructor(
    private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {}

  /**
   * Set tenant ID for multi-tenancy - Task 4.66
   */
  setTenantId(tenantId: string): void {
    this.tenantId = tenantId;
  }

  /**
   * Get current tenant ID - Task 4.66
   */
  private getTenantId(): string {
    if (this.tenantId === 'default') {
      try {
        const ctx = require('../../db/tenant-context-storage');
        const ctxTenantId = ctx.getCurrentTenantId();
        if (ctxTenantId) {
          this.tenantId = ctxTenantId;
        }
      } catch {
        // keep 'default' fallback
      }
    }
    return this.tenantId;
  }

  async create(input: SbomPackageCreateInput): Promise<SbomPackageEntity> {
    const result = await this.db.query(
      'INSERT INTO sbom_packages (id, sbom_id, name, version, purl, cpe, license, supplier, source_location, checksum) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [
        input.sbomId + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        input.sbomId,
        input.name,
        input.version,
        input.purl ?? null,
        input.cpe ?? null,
        input.license ?? null,
        input.supplier ?? null,
        input.sourceLocation ?? null,
        input.checksum ?? null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find packages by sbomId - Task 4.66: tenant isolation via JOIN with sbom_documents
   */
  async findBySbomId(sbomId: string): Promise<SbomPackageEntity[]> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      'SELECT sp.* FROM sbom_packages sp JOIN sbom_documents sd ON sd.id = sp.sbom_id WHERE sp.sbom_id = $1 AND sd.tenant_id = $2 ORDER BY sp.name ASC',
      [sbomId, tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Delete packages by sbomId - Task 4.66: tenant isolation via JOIN with sbom_documents
   */
  async deleteBySbomId(sbomId: string): Promise<boolean> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      'DELETE FROM sbom_packages WHERE sbom_id = $1 AND EXISTS (SELECT 1 FROM sbom_documents WHERE id = $1 AND tenant_id = $2)',
      [sbomId, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): SbomPackageEntity {
    return {
      id: row.id,
      sbomId: row.sbom_id,
      name: row.name,
      version: row.version,
      purl: row.purl,
      cpe: row.cpe,
      license: row.license,
      supplier: row.supplier,
      sourceLocation: row.source_location,
      checksum: row.checksum,
    };
  }
}

// ==================== SbomAttestationRepository ====================

export class SbomAttestationRepository {
  private tenantId: string = 'default';

  constructor(
    private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {}

  /**
   * Set tenant ID for multi-tenancy - Task 4.66
   */
  setTenantId(tenantId: string): void {
    this.tenantId = tenantId;
  }

  /**
   * Get current tenant ID - Task 4.66
   * Falls back to request context if not explicitly set
   */
  private getTenantId(): string {
    if (this.tenantId === 'default') {
      try {
        const ctx = require('../../db/tenant-context-storage');
        const ctxTenantId = ctx.getCurrentTenantId();
        if (ctxTenantId) {
          this.tenantId = ctxTenantId;
        }
      } catch {
        // keep 'default' fallback
      }
    }
    return this.tenantId;
  }

  async create(input: SbomAttestationCreateInput): Promise<SbomAttestationEntity> {
    const result = await this.db.query(
      'INSERT INTO sbom_attestations (id, sbom_id, attestation_type, signature, certificate, transparency_log_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [
        input.sbomId + '-att-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        input.sbomId,
        input.attestationType,
        input.signature,
        input.certificate ?? null,
        input.transparencyLogUrl ?? null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find attestation by sbomId - Task 4.66: tenant isolation via JOIN with sbom_documents
   */
  async findBySbomId(sbomId: string): Promise<SbomAttestationEntity | undefined> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      'SELECT sa.* FROM sbom_attestations sa JOIN sbom_documents sd ON sd.id = sa.sbom_id WHERE sa.sbom_id = $1 AND sd.tenant_id = $2 ORDER BY sa.signed_at DESC LIMIT 1',
      [sbomId, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find attestation by ID - Task 4.66: tenant isolation via JOIN with sbom_documents
   */
  async findById(id: string): Promise<SbomAttestationEntity | undefined> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      'SELECT sa.* FROM sbom_attestations sa JOIN sbom_documents sd ON sd.id = sa.sbom_id WHERE sa.id = $1 AND sd.tenant_id = $2',
      [id, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async verify(id: string): Promise<SbomAttestationEntity | undefined> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      'UPDATE sbom_attestations SET verified = true, verified_at = NOW() WHERE id = $1 AND EXISTS (SELECT 1 FROM sbom_documents WHERE id = (SELECT sbom_id FROM sbom_attestations WHERE id = $1) AND tenant_id = $2) RETURNING *',
      [id, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Delete attestations by sbomId - Task 4.66: tenant isolation via JOIN with sbom_documents
   */
  async deleteBySbomId(sbomId: string): Promise<boolean> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      'DELETE FROM sbom_attestations WHERE sbom_id = $1 AND EXISTS (SELECT 1 FROM sbom_documents WHERE id = $1 AND tenant_id = $2)',
      [sbomId, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): SbomAttestationEntity {
    return {
      id: row.id,
      sbomId: row.sbom_id,
      attestationType: row.attestation_type,
      signature: row.signature,
      certificate: row.certificate,
      transparencyLogUrl: row.transparency_log_url,
      signedAt: row.signed_at,
      verified: row.verified ?? false,
      verifiedAt: row.verified_at,
    };
  }
}
