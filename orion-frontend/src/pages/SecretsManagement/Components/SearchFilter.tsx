/**
 * SearchFilter - 搜索与筛选栏
 * 抽取自 index.tsx (P2-9 Phase 124)
 */
import React from 'react';
import SearchFilterBar from '@/components/SearchFilterBar';
import { spacing } from '@/tokens';
import type { SecretsManagementState } from '../useSecretsManagementState';

interface SearchFilterProps {
  state: SecretsManagementState;
}

export const SearchFilter: React.FC<SearchFilterProps> = ({ state }) => {
  const { filterDefs, setSearchQuery, setFilters } = state;

  return (
    <div style={{ marginBottom: spacing.md }}>
      <SearchFilterBar
        onSearch={setSearchQuery}
        onFilter={setFilters}
        filters={filterDefs}
        searchPlaceholder="搜索 Secret 名称、描述..."
      />
    </div>
  );
};
