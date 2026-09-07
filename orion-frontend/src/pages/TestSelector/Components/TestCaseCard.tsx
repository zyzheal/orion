/**
 * TestSelector TestCaseCard
 * 抽取自 index.tsx (P2-9 Phase 173)
 */
import { Card, Table as AntTable } from 'antd';
import type { Key } from 'react';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import type { TestCase } from '../types';

interface TestCaseCardProps {
  columns: TableColumn<TestCase>[];
  dataSource: TestCase[];
  totalCount: number;
  loading: boolean;
  selectedRowKeys: Key[];
  setSelectedRowKeys: (v: Key[]) => void;
  onSearch: (v: string) => void;
  onFilter: (filters: Record<string, string | string[] | undefined>) => void;
  filterDefinitions: FilterDefinition[];
}

export const TestCaseCard = ({
  columns,
  dataSource,
  totalCount,
  loading,
  selectedRowKeys,
  setSelectedRowKeys,
  onSearch,
  onFilter,
  filterDefinitions,
}: TestCaseCardProps) => (
  <Card title={`Test Cases (${dataSource.length} of ${totalCount})`} size="small">
    <SearchFilterBar
      onSearch={onSearch}
      filters={filterDefinitions}
      searchPlaceholder="Search tests by name..."
      onFilter={onFilter}
      initialFilters={{ status: 'all', suite: '', tags: '' }}
    />

    <Table<TestCase>
      columns={columns}
      dataSource={dataSource}
      rowKey="key"
      loading={loading}
      size="small"
      rowSelection={
        {
          selectedRowKeys,
          onChange: (keys: Key[]) => setSelectedRowKeys(keys),
          selections: [
            AntTable.SELECTION_ALL,
            AntTable.SELECTION_INVERT,
            AntTable.SELECTION_NONE,
          ],
        } as any
      }
    />
  </Card>
);
