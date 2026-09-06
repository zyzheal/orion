/**
 * SearchFilterPanel - 搜索与筛选 Card
 * 抽取自 index.tsx (P2-9 Phase 108)
 */
import React from 'react';
import { Card } from 'antd';
import SearchFilterBar from '@/components/SearchFilterBar';
import { spacing } from '@/tokens';
import { FILTER_DEFINITIONS } from '../constants';
import type { PipelineListState } from '../usePipelineListState';

interface SearchFilterPanelProps {
  state: PipelineListState;
}

export const SearchFilterPanel: React.FC<SearchFilterPanelProps> = ({ state }) => (
  <Card size="small" style={{ marginBottom: spacing.md }}>
    <SearchFilterBar
      filters={FILTER_DEFINITIONS}
      onSearch={state.setSearchQuery}
      onFilter={(f) =>
        state.setFilters({
          status: f.status as string | undefined,
          environment: f.environment as string | undefined,
        })
      }
      searchPlaceholder="搜索 Pipeline 名称..."
      initialQuery={state.searchQuery}
      initialFilters={state.filters as Record<string, string | string[] | undefined>}
    />
  </Card>
);
