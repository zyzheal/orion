/**
 * Metadata Management API Service (Phase 4 Batch 2)
 */
import { api } from './client';

export interface CatalogItem {
  id: string;
  name: string;
  description?: string;
  type: string;
  owner?: string;
  tags?: string[];
  properties?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface LineageRelation {
  id: string;
  sourceId: string;
  targetId: string;
  relation: string;
  description?: string;
  createdAt: string;
}

// Catalog
export function createCatalogItem(data: { name: string; description?: string; type: string; owner?: string; tags?: string[] }) {
  return api.post('/metadata/catalog', data);
}

export function listCatalogItems(params?: { type?: string }) {
  return api.get<{ data: CatalogItem[] }>('/metadata/catalog', { params });
}

export function getCatalogItem(id: string) {
  return api.get<{ data: CatalogItem }>(`/metadata/catalog/${id}`);
}

export function updateCatalogItem(id: string, data: Partial<CatalogItem>) {
  return api.put(`/metadata/catalog/${id}`, data);
}

export function deleteCatalogItem(id: string) {
  return api.delete(`/metadata/catalog/${id}`);
}

// Lineage
export function createLineage(data: { sourceId: string; targetId: string; relation: string; description?: string }) {
  return api.post('/metadata/lineage', data);
}

export function getLineage(params?: { itemId?: string }) {
  return api.get<{ data: LineageRelation[] }>('/metadata/lineage', { params });
}

export function deleteLineage(id: string) {
  return api.delete(`/metadata/lineage/${id}`);
}
