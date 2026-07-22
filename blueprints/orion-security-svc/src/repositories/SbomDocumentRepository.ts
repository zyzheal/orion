/**
 * SBOM Document Repositories - PostgreSQL data access layer
 */

export interface SbomDocumentEntity {
  id: string;
  buildId: string;
  pipelineRunId: string;
  format: string;
  specVersion: string;
  documentId: string;
  content: Record<string, unknown>;
  packageCount: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface SbomPackageEntity {
  id: string;
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
  certificate?: string;
  transparencyLogUrl?: string;
  signedAt: Date;
  verified: boolean;
  verifiedAt?: Date;
}

interface DbClient {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
}

export interface SbomDocumentListOptions {
  buildId?: string;
  pipelineRunId?: string;
  format?: string;
  status?: string;
  page?: number;
  perPage?: number;
}

export class SbomDocumentRepository {
  constructor(private db: DbClient) {}

  async findById(id: string): Promise<SbomDocumentEntity | undefined> {
    const result = await this.db.query('SELECT * FROM sbom_documents WHERE id = $1', [id]);
    if (result.rows.length === 0) return undefined;
    return this.mapRow(result.rows[0]);
  }

  async list(options: SbomDocumentListOptions = {}): Promise<{ documents: SbomDocumentEntity[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (options.buildId) { conditions.push(`build_id = $${paramIdx}`); params.push(options.buildId); paramIdx++; }
    if (options.pipelineRunId) { conditions.push(`pipeline_run_id = $${paramIdx}`); params.push(options.pipelineRunId); paramIdx++; }
    if (options.format) { conditions.push(`format = $${paramIdx}`); params.push(options.format); paramIdx++; }
    if (options.status) { conditions.push(`status = $${paramIdx}`); params.push(options.status); paramIdx++; }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options.perPage || 20;
    const offset = ((options.page || 1) - 1) * limit;

    const countResult = await this.db.query(`SELECT COUNT(*) FROM sbom_documents ${whereClause}`, params);
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    const dataResult = await this.db.query(
      `SELECT * FROM sbom_documents ${whereClause} ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    return {
      documents: dataResult.rows.map((row: any) => this.mapRow(row)),
      total,
    };
  }

  async incrementPackageCount(sbomId: string): Promise<void> {
    await this.db.query(
      'UPDATE sbom_documents SET package_count = package_count + 1, updated_at = NOW() WHERE id = $1',
      [sbomId]
    );
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query('DELETE FROM sbom_documents WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async update(id: string, data: Partial<SbomDocumentEntity>): Promise<SbomDocumentEntity | undefined> {
    const fields: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${col} = $${paramIdx}`);
        params.push(value);
        paramIdx++;
      }
    }
    fields.push(`updated_at = $${paramIdx}`);
    params.push(new Date());
    params.unshift(id);
    const setClause = fields.map((f, i) => i === 0 ? f : f.replace('$', '$' + (i + 1))).join(', ');
    const result = await this.db.query(`UPDATE sbom_documents SET ${setClause} WHERE id = $1 RETURNING *`, params);
    if (result.rows.length === 0) return undefined;
    return this.mapRow(result.rows[0]);
  }

  private mapRow(row: any): SbomDocumentEntity {
    return {
      id: row.id,
      buildId: row.build_id,
      pipelineRunId: row.pipeline_run_id,
      format: row.format,
      specVersion: row.spec_version,
      documentId: row.document_id,
      content: row.content || {},
      packageCount: row.package_count || 0,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at || undefined,
    };
  }
}

export class SbomPackageRepository {
  constructor(private db: DbClient) {}

  async findBySbomId(sbomId: string): Promise<SbomPackageEntity[]> {
    const result = await this.db.query('SELECT * FROM sbom_packages WHERE sbom_id = $1 ORDER BY name', [sbomId]);
    return result.rows.map((row: any) => ({
      id: row.id,
      sbomId: row.sbom_id,
      name: row.name,
      version: row.version,
      purl: row.purl || undefined,
      cpe: row.cpe || undefined,
      license: row.license || undefined,
      supplier: row.supplier || undefined,
      sourceLocation: row.source_location || undefined,
      checksum: row.checksum || undefined,
    }));
  }

  async create(data: {
    sbomId: string;
    name: string;
    version: string;
    purl?: string;
    cpe?: string;
    license?: string;
    supplier?: string;
    sourceLocation?: string;
    checksum?: string;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO sbom_packages (id, sbom_id, name, version, purl, cpe, license, supplier, source_location, checksum)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [`pkg-${Date.now()}`, data.sbomId, data.name, data.version, data.purl || null, data.cpe || null, data.license || null, data.supplier || null, data.sourceLocation || null, data.checksum || null]
    );
  }

  async deleteBySbomId(sbomId: string): Promise<void> {
    await this.db.query('DELETE FROM sbom_packages WHERE sbom_id = $1', [sbomId]);
  }
}

export class SbomAttestationRepository {
  constructor(private db: DbClient) {}

  async findBySbomId(sbomId: string): Promise<SbomAttestationEntity | undefined> {
    const result = await this.db.query('SELECT * FROM sbom_attestations WHERE sbom_id = $1 ORDER BY signed_at DESC LIMIT 1', [sbomId]);
    if (result.rows.length === 0) return undefined;
    return this.mapRow(result.rows[0]);
  }

  async verify(id: string): Promise<SbomAttestationEntity | undefined> {
    const result = await this.db.query(
      'UPDATE sbom_attestations SET verified = true, verified_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRow(result.rows[0]);
  }

  async create(data: {
    sbomId: string;
    attestationType: string;
    signature: string;
    certificate?: string;
    transparencyLogUrl?: string;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO sbom_attestations (id, sbom_id, attestation_type, signature, certificate, transparency_log_url, signed_at, verified)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), false)`,
      [`att-${Date.now()}`, data.sbomId, data.attestationType, data.signature, data.certificate || null, data.transparencyLogUrl || null]
    );
  }

  async deleteBySbomId(sbomId: string): Promise<void> {
    await this.db.query('DELETE FROM sbom_attestations WHERE sbom_id = $1', [sbomId]);
  }

  private mapRow(row: any): SbomAttestationEntity {
    return {
      id: row.id,
      sbomId: row.sbom_id,
      attestationType: row.attestation_type,
      signature: row.signature,
      certificate: row.certificate || undefined,
      transparencyLogUrl: row.transparency_log_url || undefined,
      signedAt: row.signed_at,
      verified: row.verified,
      verifiedAt: row.verified_at || undefined,
    };
  }
}
