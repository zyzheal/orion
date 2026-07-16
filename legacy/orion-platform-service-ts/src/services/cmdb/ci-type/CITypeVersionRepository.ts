/**
 * CITypeVersionRepository — ci_type_versions table repository
 *
 * Manages version history for CI type definitions.
 * Uses BaseRepository pattern aligned with ComplianceRepository.
 */

import { BaseRepository } from '../../../db/base-repository';
import { getCurrentTenantId } from '../../../db/tenant-context-storage';

export interface CITypeVersionEntity {
  id: string;
  tenantId: string;
  ciTypeId: string;
  version: number;
  designerData: Record<string, any> | null;
  attributes: any[] | null;
  relations: any[] | null;
  changeSummary: string | null;
  createdBy: string | null;
  createdAt: Date;
}

export interface CreateVersionInput {
  ciTypeId: string;
  version: number;
  designerData?: Record<string, any>;
  attributes?: any[];
  relations?: any[];
  changeSummary?: string;
  createdBy?: string;
}

export class CITypeVersionRepository extends BaseRepository<CITypeVersionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ci_type_versions');
  }

  /**
   * List all versions for a given CI type, ordered by version descending.
   */
  async listByType(typeId: string): Promise<CITypeVersionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ci_type_versions WHERE ci_type_id = $1 ORDER BY version DESC`,
      [typeId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Get a single version by ID.
   */
  async getVersionById(id: string): Promise<CITypeVersionEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ci_type_versions WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Get the latest version for a CI type.
   */
  async getLatest(typeId: string): Promise<CITypeVersionEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ci_type_versions WHERE ci_type_id = $1 ORDER BY version DESC LIMIT 1`,
      [typeId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Create a new version record.
   */
  async createVersion(input: CreateVersionInput): Promise<CITypeVersionEntity> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `INSERT INTO ci_type_versions
        (tenant_id, ci_type_id, version, designer_data, attributes, relations, change_summary, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        tenantId,
        input.ciTypeId,
        input.version,
        input.designerData ? JSON.stringify(input.designerData) : null,
        input.attributes ? JSON.stringify(input.attributes) : null,
        input.relations ? JSON.stringify(input.relations) : null,
        input.changeSummary ?? null,
        input.createdBy ?? null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): CITypeVersionEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      ciTypeId: row.ci_type_id,
      version: row.version,
      designerData: typeof row.designer_data === 'string' ? JSON.parse(row.designer_data) : (row.designer_data ?? null),
      attributes: typeof row.attributes === 'string' ? JSON.parse(row.attributes) : (row.attributes ?? null),
      relations: typeof row.relations === 'string' ? JSON.parse(row.relations) : (row.relations ?? null),
      changeSummary: row.change_summary ?? null,
      createdBy: row.created_by ?? null,
      createdAt: row.created_at,
    };
  }
}
