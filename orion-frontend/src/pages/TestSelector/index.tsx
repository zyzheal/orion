/**
 * TestSelector Page
 * Test Case Selection & Management - 测试用例选择与管理
 * 组件化重构 (P2-9 Phase 173): 439→85 行
 */
import React, { useMemo } from 'react';
import { useTestSelectorState } from './useTestSelectorState';
import { buildColumns } from './columns';
import { STATUS_OPTIONS, SUITE_OPTIONS, TAG_OPTIONS } from './constants';
import { PageHeader } from './Components/PageHeader';
import { StatsCards } from './Components/StatsCards';
import { TestCaseCard } from './Components/TestCaseCard';
import type { FilterDefinition } from '@/components/SearchFilterBar';

const TestSelector: React.FC = () => {
  const {
    loading,
    testCases,
    testStats,
    selectedRowKeys,
    setSelectedRowKeys,
    setSearchQuery,
    setStatusFilter,
    setSuiteFilter,
    setTagFilter,
    filteredCases,
    handleRunSelected,
  } = useTestSelectorState();

  const columns = useMemo(() => buildColumns(), []);

  const filterDefinitions: FilterDefinition[] = useMemo(
    () => [
      {
        key: 'status',
        label: 'Status',
        options: STATUS_OPTIONS,
        placeholder: 'Filter by status',
      },
      {
        key: 'suite',
        label: 'Suite',
        options: [{ label: 'All Suites', value: '' }, ...SUITE_OPTIONS],
        placeholder: 'Filter by suite',
      },
      {
        key: 'tags',
        label: 'Tags',
        options: [{ label: 'All Tags', value: '' }, ...TAG_OPTIONS],
        placeholder: 'Filter by tags',
      },
    ],
    []
  );

  return (
    <div>
      <PageHeader
        selectedCount={selectedRowKeys.length}
        onRunSelected={handleRunSelected}
      />

      <StatsCards testStats={testStats} loading={loading} />

      <TestCaseCard
        columns={columns}
        dataSource={filteredCases}
        totalCount={testCases.length}
        loading={loading}
        selectedRowKeys={selectedRowKeys}
        setSelectedRowKeys={setSelectedRowKeys}
        onSearch={setSearchQuery}
        onFilter={(filters) => {
          if (filters.status) setStatusFilter(String(filters.status));
          if (filters.suite) setSuiteFilter(String(filters.suite));
          if (filters.tags) setTagFilter(String(filters.tags));
        }}
        filterDefinitions={filterDefinitions}
      />
    </div>
  );
};

export default TestSelector;
