/**
 * types.ts - DataLineage 类型定义
 * 抽取自 DataLineagePage.tsx (P2-9 Phase 61)
 */
import type { LineageNode as ApiLineageNode } from '@/api/data-lineage';

export interface DisplayNode extends ApiLineageNode {
  upstreamIds: string[];
  downstreamIds: string[];
}

export interface ColumnDef {
  name: string;
  type: string;
  description?: string;
  upstreamSource?: string;
  upstreamColumn?: string;
  transformed?: boolean;
}
