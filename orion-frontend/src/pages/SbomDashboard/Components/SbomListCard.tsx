/**
 * SBOM Dashboard list card
 * 抽取自 index.tsx (P2-9 Phase 148)
 */
import React from 'react';
import { Card } from 'antd';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar from '@/components/SearchFilterBar';
import { spacing } from '@/tokens';
import type { SbomDocument } from '../types';
import { FILTER_DEFS } from '../constants';

interface SbomListCardProps {
  columns: TableColumn<SbomDocument>[];
  filteredDocs: SbomDocument[];
  loading: boolean;
  searchQuery: string;
  filters: Record<string, string | string[] | undefined>;
  onSearch: (q: string) => void;
  onFilter: (f: Record<string, string | string[] | undefined>) => void;
}

export const SbomListCard: React.FC<SbomListCardProps> = ({
  columns,
  filteredDocs,
  loading,
  searchQuery,
  filters,
  onSearch,
  onFilter,
}) => (
  <Card title="SBOM 文档列表" style={{ marginBottom: spacing.lg }}>
    <div style={{ marginBottom: spacing.md }}>
      <SearchFilterBar
        onSearch={onSearch}
        onFilter={onFilter}
        filters={FILTER_DEFS}
        searchPlaceholder="搜索文档 ID、构建 ID..."
        initialQuery={searchQuery}
        initialFilters={filters}
      />
    </div>
    <Table
      columns={columns}
      dataSource={filteredDocs}
      loading={loading}
      rowKey="id"
      size="middle"
      striped
    />
  </Card>
);
