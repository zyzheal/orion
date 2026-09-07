/**
 * PipelineRunList constants
 * 抽取自 index.tsx (P2-9 Phase 140)
 */
import type { FilterDefinition } from '@/components/SearchFilterBar';

/** Trigger type display labels */
export const TRIGGER_LABEL: Record<string, string> = {
  manual: '手动触发',
  push: 'Push 触发',
  schedule: '定时触发',
  api: 'API 触发',
};

/** Status color map for trigger tags */
export const TRIGGER_TAG_COLORS: Record<string, string> = {
  manual: 'blue',
  push: 'green',
  schedule: 'orange',
  api: 'purple',
};

/** Filter definitions for SearchFilterBar */
export const FILTER_DEFS: FilterDefinition[] = [
  {
    key: 'status',
    label: '状态',
    options: [
      { label: '全部', value: 'all' },
      { label: '运行中', value: 'running' },
      { label: '成功', value: 'success' },
      { label: '失败', value: 'failed' },
      { label: '已取消', value: 'cancelled' },
      { label: '等待中', value: 'pending' },
    ],
  },
];
