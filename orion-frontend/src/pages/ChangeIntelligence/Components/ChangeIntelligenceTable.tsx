/**
 * ChangeIntelligenceTable - 报告列表 (SearchFilterBar + Table)
 * 抽取自 index.tsx (P2-9 Phase 119)
 */
import React, { useMemo } from 'react';
import { Card } from 'antd';
import Table from '@/components/Table';
import SearchFilterBar from '@/components/SearchFilterBar';
import { spacing } from '@/tokens';
import type { ChangeIntelligenceReport } from '@/api/change-intelligence';
import { buildChangeColumns, FILTER_DEFS } from '../changeColumns';
import type { ChangeIntelligenceState } from '../useChangeIntelligenceState';

interface ChangeIntelligenceTableProps {
  state: ChangeIntelligenceState;
}

export const ChangeIntelligenceTable: React.FC<ChangeIntelligenceTableProps> = ({ state }) => {
  const { loading, filteredReports, setSearchQuery, setFilters, handleViewDetail } = state;

  const columns = useMemo(
    () => buildChangeColumns({ handleViewDetail }),
    [handleViewDetail]
  );

  return (
    <Card title="变更智能报告">
      <div style={{ marginBottom: spacing.md }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={FILTER_DEFS}
          searchPlaceholder="搜索 PR、仓库、Commit..."
        />
      </div>
      <Table<ChangeIntelligenceReport>
        columns={columns}
        dataSource={filteredReports}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
      />
    </Card>
  );
};
