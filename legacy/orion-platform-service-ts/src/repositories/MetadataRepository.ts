/**
 * MetadataRepository - PostgreSQL persistence for metadata catalog and lineage
 *
 * Persists catalog items and lineage relations.
 * Writes are fire-and-forget; reads try DB first then fall back to memory.
 */

import { BaseRepository } from '../db/base-repository';

export interface CatalogItemEntity {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  type: string;
  owner: string | null;
  tags: string[];
  properties: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LineageRelationEntity {
  id: string;
  tenantId: string;
  sourceId: string;
  targetId: string;
  relation: string;
  description: string | null;
  createdAt: Date;
}

export class MetadataRepository extends BaseRepository<CatalogItemEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'metadata_catalog_items');
  }

  // ========== Catalog Items ==========

  async saveCatalogItem(item: Omit<CatalogItemEntity, 'createdAt' | 'updatedAt'>): Promise<void> {
    await this.db.query(
      `INSERT INTO metadata_catalog_items (id, tenant_id, name, description, type, owner, tags, properties)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description,
         type = EXCLUDED.type, owner = EXCLUDED.owner, tags = EXCLUDED.tags,
         properties = EXCLUDED.properties, updated_at = now()`,
      [item.id, item.tenantId, item.name, item.description, item.type, item.owner, item.tags || [], item.properties ? JSON.stringify(item.properties) : null],
    );
  }

  async findCatalogItemsByTenant(tenantId: string): Promise<CatalogItemEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM metadata_catalog_items WHERE tenant_id = $1 ORDER BY name ASC`,
      [tenantId],
    );
    return result.rows.map(r => this.mapCatalogItemRow(r));
  }

  async findCatalogItemById(id: string): Promise<CatalogItemEntity | null> {
    const result = await this.db.query(`SELECT * FROM metadata_catalog_items WHERE id = $1`, [id]);
    return result.rows.length > 0 ? this.mapCatalogItemRow(result.rows[0]) : null;
  }

  async deleteCatalogItem(id: string): Promise<boolean> {
    const result = await this.db.query(`DELETE FROM metadata_catalog_items WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ========== Lineage Relations ==========

  async saveLineageRelation(relation: Omit<LineageRelationEntity, 'createdAt'>): Promise<void> {
    await this.db.query(
      `INSERT INTO metadata_lineage_relations (id, tenant_id, source_id, target_id, relation, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET relation = EXCLUDED.relation, description = EXCLUDED.description`,
      [relation.id, relation.tenantId, relation.sourceId, relation.targetId, relation.relation, relation.description],
    );
  }

  async findLineageByTenant(tenantId: string): Promise<LineageRelationEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM metadata_lineage_relations WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(r => this.mapLineageRow(r));
  }

  async findLineageByItem(itemId: string): Promise<LineageRelationEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM metadata_lineage_relations WHERE source_id = $1 OR target_id = $1 ORDER BY created_at DESC`,
      [itemId],
    );
    return result.rows.map(r => this.mapLineageRow(r));
  }

  async deleteLineageRelation(id: string): Promise<boolean> {
    const result = await this.db.query(`DELETE FROM metadata_lineage_relations WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ========== Row Mappers ==========

  private mapCatalogItemRow(row: any): CatalogItemEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      type: row.type,
      owner: row.owner,
      tags: row.tags || [],
      properties: typeof row.properties === 'string' ? JSON.parse(row.properties) : row.properties,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }

  private mapLineageRow(row: any): LineageRelationEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      sourceId: row.source_id,
      targetId: row.target_id,
      relation: row.relation,
      description: row.description,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  protected mapRowToEntity(row: any): CatalogItemEntity {
    return this.mapCatalogItemRow(row);
  }
}
