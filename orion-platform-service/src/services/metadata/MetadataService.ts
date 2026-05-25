/**
 * Metadata Management Service (Phase 4 Batch 2)
 * Data asset catalog, lineage tracking
 */

import { v4 as uuidv4 } from 'uuid';

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

const catalogItems = new Map<string, CatalogItem>();
const lineageRelations = new Map<string, LineageRelation>();

export class MetadataService {
  async createCatalogItem(input: { name: string; description?: string; type: string; owner?: string; tags?: string[]; properties?: Record<string, any> }, tenantId: string): Promise<CatalogItem> {
    const item: CatalogItem = {
      id: uuidv4(), tenantId, name: input.name, description: input.description,
      type: input.type as CatalogItem['type'], owner: input.owner, tags: input.tags,
      properties: input.properties, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    catalogItems.set(item.id, item);
    return item;
  }

  async listCatalogItems(tenantId: string, params?: { type?: string }): Promise<CatalogItem[]> {
    let result = Array.from(catalogItems.values()).filter((i) => i.tenantId === tenantId);
    if (params?.type) result = result.filter((i) => i.type === params.type);
    return result;
  }

  async getCatalogItem(id: string): Promise<CatalogItem | undefined> {
    return catalogItems.get(id);
  }

  async updateCatalogItem(id: string, input: Partial<CatalogItem>): Promise<CatalogItem | undefined> {
    const item = catalogItems.get(id);
    if (!item) return undefined;
    Object.assign(item, input, { updatedAt: new Date().toISOString() });
    catalogItems.set(id, item);
    return item;
  }

  async deleteCatalogItem(id: string): Promise<boolean> {
    return catalogItems.delete(id);
  }

  async createLineage(input: { sourceId: string; targetId: string; relation: string; description?: string }, tenantId: string): Promise<LineageRelation> {
    const relation: LineageRelation = {
      id: uuidv4(), tenantId, sourceId: input.sourceId, targetId: input.targetId,
      relation: input.relation as LineageRelation['relation'], description: input.description,
      createdAt: new Date().toISOString(),
    };
    lineageRelations.set(relation.id, relation);
    return relation;
  }

  async getLineage(tenantId: string, params?: { itemId?: string }): Promise<LineageRelation[]> {
    let result = Array.from(lineageRelations.values()).filter((r) => r.tenantId === tenantId);
    if (params?.itemId) result = result.filter((r) => r.sourceId === params.itemId || r.targetId === params.itemId);
    return result;
  }

  async deleteLineage(id: string): Promise<boolean> {
    return lineageRelations.delete(id);
  }
}
