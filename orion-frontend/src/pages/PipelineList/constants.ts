/**
 * PipelineList 常量
 * 抽取自 index.tsx (P2-9 Phase 108)
 */
import type { FilterDefinition } from '@/components/SearchFilterBar';

export const FILTER_DEFINITIONS: FilterDefinition[] = [
  {
    key: 'status',
    label: '状态',
    options: [
      { label: 'Active', value: 'active' },
      { label: 'Inactive', value: 'inactive' },
      { label: 'Archived', value: 'archived' },
      { label: 'Draft', value: 'draft' },
    ],
  },
  {
    key: 'environment',
    label: '环境',
    options: [
      { label: 'Production', value: 'production' },
      { label: 'Staging', value: 'staging' },
      { label: 'Development', value: 'development' },
      { label: 'Testing', value: 'testing' },
    ],
  },
];

export const DEFAULT_COLUMN_VISIBLE: Record<string, boolean> = {
  name: true,
  status: true,
  version: true,
  stages: true,
  creator: true,
  environment: true,
  createdAt: true,
  updatedAt: true,
};

export const STATUS_COLOR_MAP: Record<string, string> = {
  active: 'green',
  inactive: 'default',
  archived: 'orange',
  draft: 'blue',
};

export const SAVED_VIEWS_STORAGE_KEY = 'pipeline_views';
