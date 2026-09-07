/**
 * SubAppTable - 子应用表
 * 抽取自 index.tsx (P2-9 Phase 127)
 */
import React from 'react';
import { Card, Empty, Table } from 'antd';
import type { SubAppManagementState } from '../useSubAppManagementState';
import { buildSubAppColumns } from '../subAppColumns';

interface SubAppTableProps {
  state: SubAppManagementState;
}

export const SubAppTable: React.FC<SubAppTableProps> = ({ state }) => {
  const { apps, loading, handleCopyLink, handleToggleStatus, handleShowHistory, handleEdit, handleDelete } =
    state;
  const columns = buildSubAppColumns({
    handleCopyLink,
    handleToggleStatus,
    handleShowHistory,
    handleEdit,
    handleDelete,
  });

  return (
    <Card>
      <Table
        columns={columns}
        dataSource={apps}
        loading={loading}
        rowKey="key"
        pagination={false}
        locale={{ emptyText: <Empty description="暂无子应用配置，点击「新增子应用」创建" /> }}
      />
    </Card>
  );
};
