/**
 * PipelineList 类型定义
 * 抽取自 index.tsx (P2-9 Phase 108)
 */
export interface PipelineListFilters {
  status?: string;
  creator?: string;
  environment?: string;
  createdAfter?: string;
  createdBefore?: string;
  search?: string;
}

export interface SavedView {
  id: string;
  name: string;
  filters: PipelineListFilters;
  columns: string[];
  isDefault?: boolean;
}
