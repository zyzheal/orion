/**
 * DiffTable - Diff 结果变更详情表
 * 抽取自 index.tsx (P2-9 Phase 122)
 */
import React from 'react';
import { Card, Table } from 'antd';
import { spacing } from '@/tokens';
import type { ConfigChange } from '@/api/config';
import { buildChangeColumns } from '../configColumns';
import type { ConfigDiffState } from '../useConfigDiffState';

interface DiffTableProps {
  state: ConfigDiffState;
}

export const DiffTable: React.FC<DiffTableProps> = ({ state }) => {
  const { diffResult, setChangeDetail } = state;

  if (!diffResult || !diffResult.changes) return null;

  const columns = buildChangeColumns({ setChangeDetail });

  return (
    <Card title="Change Details" style={{ marginBottom: spacing.md }}>
      <Table<ConfigChange>
        columns={columns}
        dataSource={diffResult.changes}
        rowKey="path"
        pagination={false}
        size="small"
      />
    </Card>
  );
};
