/**
 * AISecurityTable - 策略列表 + SearchFilterBar
 * 抽取自 index.tsx (P2-9 Phase 118)
 */
import React, { useMemo } from 'react';
import { Card, Empty } from 'antd';
import { spacing } from '@/tokens';
import Table from '@/components/Table';
import SearchFilterBar from '@/components/SearchFilterBar';
import { FILTER_DEFS, buildPolicyColumns } from '../policyColumns';
import type { AISecurityState } from '../useAISecurityState';

interface AISecurityTableProps {
  state: AISecurityState;
}

export const AISecurityTable: React.FC<AISecurityTableProps> = ({ state }) => {
  const {
    loading,
    filteredData,
    setSearchQuery,
    setFilters,
    handleDelete,
    handleTogglePolicy,
    openEdit,
    openDetail,
  } = state;

  const columns = useMemo(
    () => buildPolicyColumns({ handleDelete, handleTogglePolicy, openEdit, openDetail }),
    [handleDelete, handleTogglePolicy, openEdit, openDetail]
  );

  return (
    <Card>
      <div style={{ marginBottom: spacing[4] }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={FILTER_DEFS}
          searchPlaceholder="搜索策略名称或描述..."
        />
      </div>
      {filteredData.length > 0 ? (
        <Table
          columns={columns}
          dataSource={filteredData}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
        />
      ) : (
        !loading && <Empty description="暂无安全策略" />
      )}
    </Card>
  );
};
