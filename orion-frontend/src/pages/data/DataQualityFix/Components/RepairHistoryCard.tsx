/**
 * DataQualityFix repair history card
 * 抽取自 index.tsx (P2-9 Phase 146)
 */
import React, { useMemo } from 'react';
import { Card, Empty, Table } from 'antd';
import { spacing } from '@/tokens';
import { MOCK_REPAIR_HISTORY } from '../constants';
import { buildRepairHistoryColumns } from '../issueColumns';

export const RepairHistoryCard: React.FC = () => {
  const columns = useMemo(() => buildRepairHistoryColumns(), []);

  return (
    <Card title="修复历史" style={{ marginTop: spacing.md }}>
      <Table
        dataSource={MOCK_REPAIR_HISTORY}
        rowKey="id"
        size="small"
        pagination={false}
        locale={{ emptyText: <Empty description="暂无修复历史记录" /> }}
        columns={columns}
      />
    </Card>
  );
};
