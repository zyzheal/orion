/**
 * KnowledgeBase API adapters
 * 抽取自 index.tsx (P2-9 Phase 169)
 */
import {
  getDocs,
  getDocTags,
  searchDocs,
} from '@/api/knowledge';
import type {
  KnowledgeItem,
  KnowledgeListResponse,
  KnowledgeSearchResponse,
} from './types';

// API adapter — 使用 API 客户端替代 raw fetch
const mapDocToItem = (d: any): KnowledgeItem => ({
  id: d.id,
  title: d.title,
  content: d.content,
  category: d.type || 'default',
  tags: d.tags || [],
  createdBy: d.author_id || 'system',
  createdAt: d.created_at || '',
  updatedAt: d.updated_at || '',
});

export async function fetchKnowledgeList(
  category?: string,
  limit = 50,
  offset = 0
): Promise<KnowledgeListResponse> {
  const page = Math.floor(offset / limit) + 1;
  const res = await getDocs({ pageSize: limit, page, tag: category });
  return { items: (res.data || []).map(mapDocToItem), total: res.total || 0 };
}

export async function fetchKnowledgeCategories(): Promise<string[]> {
  return getDocTags();
}

export async function searchKnowledge(q: string, limit = 10): Promise<KnowledgeSearchResponse> {
  const result = await searchDocs(q, undefined, limit);
  return {
    results: (result.results || []).map((r) => ({
      item: {
        id: r.docId,
        title: r.title,
        content: r.snippet,
        category: '',
        tags: [],
        createdBy: '',
        createdAt: '',
        updatedAt: '',
      },
      similarity: r.score,
    })),
  };
}
