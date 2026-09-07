/**
 * KnowledgeBase types
 * 抽取自 index.tsx (P2-9 Phase 169)
 */
export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeListResponse {
  items: KnowledgeItem[];
  total: number;
}

export interface KnowledgeSearchResponse {
  results: Array<{
    item: KnowledgeItem;
    similarity: number;
  }>;
}
