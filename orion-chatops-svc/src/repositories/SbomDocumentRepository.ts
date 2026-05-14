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
   */
  async list(filter: SbomDocumentListFilter = {}): Promise<{ documents: SbomDocumentEntity[]; total: number }> {
    const { buildId, pipelineRunId, format, status } = filter;
    const page = filter.page ?? 1;
    const perPage = filter.perPage ?? 20;

    let query = `SELECT * FROM sbom_documents WHERE 1=1`;
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    if (buildId) {
      query += ` AND build_id = $${paramIndex}`;
      queryParams.push(buildId);
      paramIndex++;
    }
    if (pipelineRunId) {
      query += ` AND pipeline_run_id = $${paramIndex}`;
      queryParams.push(pipelineRunId);
      paramIndex++;
    }
    if (format) {
      query += ` AND format = $${paramIndex}`;
      queryParams.push(format);
      paramIndex++;
    }
    if (status) {
      query += ` AND status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    const countQuery = `SELECT COUNT(*) as count FROM sbom_documents WHERE 1=1` +
      query.slice(query.indexOf('WHERE 1=1') + 'WHERE 1=1'.length);
    const countResult = await this.db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count, 10);

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(perPage, (page - 1) * perPage);

    const result = await this.db.query(query, queryParams);
    const documents = result.rows.map(row => this.mapRowToEntity(row));

    return { documents, total };
  }

  /**
   * Find by buildId
   */
  async findByBuildId(buildId: string): Promise<SbomDocumentEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM sbom_documents WHERE build_id = $1 ORDER BY created_at DESC`,
      [buildId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find by pipelineRunId
   */
  async findByPipelineRunId(pipelineRunId: string): Promise<SbomDocumentEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM sbom_documents WHERE pipeline_run_id = $1 ORDER BY created_at DESC`,
      [pipelineRunId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Increment package count
   */
  async incrementPackageCount(sbomId: string): Promise<number> {
    const result = await this.db.query(
      `UPDATE sbom_documents SET package_count = package_count + 1, updated_at = NOW() WHERE id = $1 RETURNING package_count`,
      [sbomId],
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
  constructor(
    private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {}

  async create(input: SbomPackageCreateInput): Promise<SbomPackageEntity> {
    const result = await this.db.query(
      `INSERT INTO sbom_packages (id, sbom_id, name, version, purl, cpe, license, supplier, source_location, checksum)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        input.sbomId + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8), // simple ID
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

  async findBySbomId(sbomId: string): Promise<SbomPackageEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM sbom_packages WHERE sbom_id = $1 ORDER BY name ASC`,
      [sbomId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async deleteBySbomId(sbomId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM sbom_packages WHERE sbom_id = $1`,
      [sbomId],
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
  constructor(
    private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {}

  async create(input: SbomAttestationCreateInput): Promise<SbomAttestationEntity> {
    const result = await this.db.query(
      `INSERT INTO sbom_attestations (id, sbom_id, attestation_type, signature, certificate, transparency_log_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
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

  async findBySbomId(sbomId: string): Promise<SbomAttestationEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM sbom_attestations WHERE sbom_id = $1 ORDER BY signed_at DESC LIMIT 1`,
      [sbomId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findById(id: string): Promise<SbomAttestationEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM sbom_attestations WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async verify(id: string): Promise<SbomAttestationEntity | undefined> {
    const result = await this.db.query(
      `UPDATE sbom_attestations SET verified = true, verified_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteBySbomId(sbomId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM sbom_attestations WHERE sbom_id = $1`,
      [sbomId],
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
