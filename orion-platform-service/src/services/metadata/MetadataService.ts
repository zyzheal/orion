/**
 * Metadata Management Service (Phase 4 Batch 2)
 * Data asset catalog, lineage tracking
 *
 * Persistence strategy:
 * - Writes: fire-and-forget to PostgreSQL (non-blocking), always update in-memory Map
 * - Reads: try DB first, fall back to in-memory Map on DB failure
 * - Startup: load from DB to hydrate in-memory Maps
 */

import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';
import { MetadataRepository } from '../../repositories/MetadataRepository';

const logger = pino({ name: 'MetadataService' });

export interface CatalogItem {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  type: 'table' | 'view' | 'pipeline' | 'dashboard' | 'api' | 'other';
  owner?: string;
  tags?: string[];
  properties?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface LineageRelation {
  id: string;
  tenantId: string;
  sourceId: string;
  targetId: string;
  relation: 'transforms' | 'reads' | 'writes' | 'depends_on';
  description?: string;
  createdAt: string;
}

export class MetadataService {
  private catalogItems = new Map<string, CatalogItem>();
  private lineageRelations = new Map<string, LineageRelation>();
  private repo?: MetadataRepository;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.repo = new MetadataRepository(db);
      this.loadFromDb().catch(err => {
        logger.warn({ err }, 'Failed to load metadata from DB on startup');
      });
    }
  }

  private async loadFromDb(): Promise<void> {
    if (!this.repo) return;
    try {
      const itemResult = await this.repo['db'].query(
        `SELECT * FROM metadata_catalog_items ORDER BY name ASC`,
      );
      for (const row of itemResult.rows) {
        const item = this.mapCatalogItemRow(row);
        this.catalogItems.set(item.id, item);
      }

      const lineageResult = await this.repo['db'].query(
        `SELECT * FROM metadata_lineage_relations ORDER BY created_at ASC`,
      );
      for (const row of lineageResult.rows) {
        const relation = this.mapLineageRow(row);
        this.lineageRelations.set(relation.id, relation);
      }

      logger.info({
        items: this.catalogItems.size,
        lineages: this.lineageRelations.size,
      }, 'Loaded metadata from DB');
    } catch (err) {
      logger.warn({ err }, 'Failed to load metadata from DB');
    }
  }

  async createCatalogItem(input: { name: string; description?: string; type: string; owner?: string; tags?: string[]; properties?: Record<string, any> }, tenantId: string): Promise<CatalogItem> {
    const item: CatalogItem = {
      id: uuidv4(), tenantId, name: input.name, description: input.description,
      type: input.type as CatalogItem['type'], owner: input.owner, tags: input.tags,
      properties: input.properties, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    this.catalogItems.set(item.id, item);

    // Fire-and-forget to PostgreSQL
    if (this.repo) {
      this.repo.saveCatalogItem({
        id: item.id,
        tenantId: item.tenantId,
        name: item.name,
        description: item.description ?? null,
        type: item.type,
        owner: item.owner ?? null,
        tags: item.tags || [],
        properties: item.properties ?? null,
      }).catch(err => {
        logger.warn({ err, itemId: item.id }, 'Failed to persist catalog item to DB');
      });
    }

    return item;
  }

  async listCatalogItems(tenantId: string, params?: { type?: string }): Promise<CatalogItem[]> {
    if (this.repo) {
      try {
        const rows = await this.repo.findCatalogItemsByTenant(tenantId);
        let result = rows.map(r => ({
          id: r.id,
          tenantId: r.tenantId,
          name: r.name,
          description: r.description ?? undefined,
          type: r.type as CatalogItem['type'],
          owner: r.owner ?? undefined,
          tags: r.tags,
          properties: r.properties as any,
          createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
          updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
        }));
        if (params?.type) result = result.filter((i) => i.type === params.type);
        return result;
      } catch (err) {
        logger.warn({ err, tenantId }, 'DB listCatalogItems failed, falling back to memory');
      }
    }
    let result = Array.from(this.catalogItems.values()).filter((i) => i.tenantId === tenantId);
    if (params?.type) result = result.filter((i) => i.type === params.type);
    return result;
  }

  async getCatalogItem(id: string): Promise<CatalogItem | undefined> {
    if (this.repo) {
      try {
        const row = await this.repo.findCatalogItemById(id);
        if (row) {
          return {
            id: row.id,
            tenantId: row.tenantId,
            name: row.name,
            description: row.description ?? undefined,
            type: row.type as CatalogItem['type'],
            owner: row.owner ?? undefined,
            tags: row.tags,
            properties: row.properties as any,
            createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
            updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
          };
        }
      } catch (err) {
        logger.warn({ err, id }, 'DB getCatalogItem failed, falling back to memory');
      }
    }
    return this.catalogItems.get(id);
  }

  async updateCatalogItem(id: string, input: Partial<CatalogItem>): Promise<CatalogItem | undefined> {
    const item = this.catalogItems.get(id);
    if (!item) return undefined;
    Object.assign(item, input, { updatedAt: new Date().toISOString() });
    this.catalogItems.set(id, item);

    // Fire-and-forget to PostgreSQL
    if (this.repo) {
      this.repo.saveCatalogItem({
        id: item.id,
        tenantId: item.tenantId,
        name: item.name,
        description: item.description ?? null,
        type: item.type,
        owner: item.owner ?? null,
        tags: item.tags || [],
        properties: item.properties ?? null,
      }).catch(err => {
        logger.warn({ err, itemId: id }, 'Failed to persist updated catalog item to DB');
      });
    }

    return item;
  }

  async deleteCatalogItem(id: string): Promise<boolean> {
    const deleted = this.catalogItems.delete(id);
    if (deleted && this.repo) {
      this.repo.deleteCatalogItem(id).catch(err => {
        logger.warn({ err, itemId: id }, 'Failed to delete catalog item from DB');
      });
    }
    return deleted;
  }

  async createLineage(input: { sourceId: string; targetId: string; relation: string; description?: string }, tenantId: string): Promise<LineageRelation> {
    const relation: LineageRelation = {
      id: uuidv4(), tenantId, sourceId: input.sourceId, targetId: input.targetId,
      relation: input.relation as LineageRelation['relation'], description: input.description,
      createdAt: new Date().toISOString(),
    };
    this.lineageRelations.set(relation.id, relation);

    // Fire-and-forget to PostgreSQL
    if (this.repo) {
      this.repo.saveLineageRelation({
        id: relation.id,
        tenantId: relation.tenantId,
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        relation: relation.relation,
        description: relation.description ?? null,
      }).catch(err => {
        logger.warn({ err, lineageId: relation.id }, 'Failed to persist lineage relation to DB');
      });
    }

    return relation;
  }

  async getLineage(tenantId: string, params?: { itemId?: string }): Promise<LineageRelation[]> {
    if (this.repo) {
      try {
        if (params?.itemId) {
          const rows = await this.repo.findLineageByItem(params.itemId);
          return rows.filter(r => r.tenantId === tenantId).map(r => ({
            id: r.id,
            tenantId: r.tenantId,
            sourceId: r.sourceId,
            targetId: r.targetId,
            relation: r.relation as LineageRelation['relation'],
            description: r.description ?? undefined,
            createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
          }));
        }
        const rows = await this.repo.findLineageByTenant(tenantId);
        return rows.map(r => ({
          id: r.id,
          tenantId: r.tenantId,
          sourceId: r.sourceId,
          targetId: r.targetId,
          relation: r.relation as LineageRelation['relation'],
          description: r.description ?? undefined,
          createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
        }));
      } catch (err) {
        logger.warn({ err, tenantId }, 'DB getLineage failed, falling back to memory');
      }
    }
    let result = Array.from(this.lineageRelations.values()).filter((r) => r.tenantId === tenantId);
    if (params?.itemId) result = result.filter((r) => r.sourceId === params.itemId || r.targetId === params.itemId);
    return result;
  }

  async deleteLineage(id: string): Promise<boolean> {
    const deleted = this.lineageRelations.delete(id);
    if (deleted && this.repo) {
      this.repo.deleteLineageRelation(id).catch(err => {
        logger.warn({ err, lineageId: id }, 'Failed to delete lineage relation from DB');
      });
    }
    return deleted;
  }

  // ========== Row Mappers ==========

  private mapCatalogItemRow(row: any): CatalogItem {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description ?? undefined,
      type: row.type,
      owner: row.owner ?? undefined,
      tags: row.tags || [],
      properties: typeof row.properties === 'string' ? JSON.parse(row.properties) : row.properties,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    };
  }

  private mapLineageRow(row: any): LineageRelation {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      sourceId: row.source_id,
      targetId: row.target_id,
      relation: row.relation,
      description: row.description ?? undefined,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    };
  }
}
