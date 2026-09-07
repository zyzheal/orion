/**
 * PoliciesTab - 策略列表 Tab
 * 抽取自 index.tsx (P2-9 Phase 114)
 */
import React, { useMemo } from 'react';
import Table from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { spacing } from '@/tokens';
import type { PolicyDefinition } from '@/api/policies';
import { buildPolicyColumns } from '../policyColumns';
import type { PolicyManagementState } from '../usePolicyManagementState';

interface PoliciesTabProps {
  state: PolicyManagementState;
}

const FILTER_DEFS: FilterDefinition[] = [
  {
    key: 'category',
    label: '分类',
    options: [
      { label: '全部', value: 'all' },
      { label: 'Security', value: 'security' },
      { label: 'Cost', value: 'cost' },
      { label: 'Quality', value: 'quality' },
      { label: 'Governance', value: 'governance' },
    ],
  },
  {
    key: 'severity',
    label: '严重级别',
    options: [
      { label: '全部', value: 'all' },
      { label: 'Block', value: 'block' },
      { label: 'Warning', value: 'warning' },
      { label: 'Info', value: 'info' },
    ],
  },
];

export const PoliciesTab: React.FC<PoliciesTabProps> = ({ state }) => {
  const {
    loading,
    filteredPolicies,
    setSearchQuery,
    setFilters,
    form,
    setEditingPolicy,
    setPolicyModalVisible,
    handleTogglePolicy,
    handleDeletePolicy,
  } = state;

  const onEdit = (record: PolicyDefinition) => {
    setEditingPolicy(record);
    form.setFieldsValue(record);
    setPolicyModalVisible(true);
  };

  const columns = useMemo(
    () =>
      buildPolicyColumns({ handleTogglePolicy, handleDeletePolicy, onEdit }),
    [handleTogglePolicy, handleDeletePolicy]
  );

  return (
    <>
      <div style={{ marginBottom: spacing.md }} className="policies-search-wrap">
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={FILTER_DEFS}
          searchPlaceholder="搜索策略名称、描述..."
        />
      </div>
      <Table
        columns={columns}
        dataSource={filteredPolicies}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
      />
    </>
  );
};
