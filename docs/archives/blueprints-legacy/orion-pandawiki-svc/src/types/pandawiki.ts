/**
 * PandaWiki Service - Type Definitions
 */

export interface WikiSpace {
  id: string;
  name: string;
  description?: string;
  tenantId: string;
  createdAt: string;
}

export interface WikiDocument {
  id: string;
  spaceId: string;
  title: string;
  content: string;
  parentId?: string;
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WikiSearchResult {
  id: string;
  title: string;
  excerpt: string;
  score: number;
  spaceId: string;
}

export interface WikiQuery {
  spaceId?: string;
  tenantId?: string;
  q?: string;
  page?: number;
  limit?: number;
}
