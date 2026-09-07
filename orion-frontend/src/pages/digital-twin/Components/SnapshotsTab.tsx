/**
 * SnapshotsTab - 快照列表 Tab
 * 抽取自 index.tsx (P2-9 Phase 116)
 */
import React, { useMemo } from 'react';
import { Button, Empty, Space, Table } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { TwinSnapshot } from '@/api/digital-twin';
import { buildSnapshotColumns } from '../columns';
import type { DigitalTwinState } from '../useDigitalTwinState';

interface SnapshotsTabProps {
  state: DigitalTwinState;
}

export const SnapshotsTab: React.FC<SnapshotsTabProps> = ({ state }) => {
  const { snapshots, loadSnapshots, handleDeleteSnapshot } = state;

  const columns = useMemo(
    () => buildSnapshotColumns({ handleDeleteSnapshot }),
    [handleDeleteSnapshot]
  );

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={loadSnapshots}>刷新</Button>
      </Space>
      <Table<TwinSnapshot>
        columns={columns}
        dataSource={snapshots}
        rowKey="id"
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: <Empty description="暂无快照" /> }}
        scroll={{ x: 900 }}
      />
    </div>
  );
};
