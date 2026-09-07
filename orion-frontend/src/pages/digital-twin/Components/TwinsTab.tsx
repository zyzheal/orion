/**
 * TwinsTab - 数字孪生列表 Tab
 * 抽取自 index.tsx (P2-9 Phase 116)
 */
import React, { useMemo } from 'react';
import { Button, Empty, Space, Table } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { DigitalTwin } from '@/api/digital-twin';
import { buildTwinColumns } from '../columns';
import type { DigitalTwinState } from '../useDigitalTwinState';

interface TwinsTabProps {
  state: DigitalTwinState;
}

export const TwinsTab: React.FC<TwinsTabProps> = ({ state }) => {
  const { loading, twins, handleCreateTwin, loadTwins, handleViewDetail, openSnapshotModal } = state;

  const columns = useMemo(
    () => buildTwinColumns({ handleViewDetail, openSnapshotModal }),
    [handleViewDetail, openSnapshotModal]
  );

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateTwin}>创建孪生</Button>
        <Button icon={<ReloadOutlined />} onClick={loadTwins} loading={loading}>刷新</Button>
      </Space>
      <Table<DigitalTwin>
        columns={columns}
        dataSource={twins}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 项` }}
        locale={{ emptyText: <Empty description="暂无数字孪生" /> }}
        scroll={{ x: 900 }}
      />
    </div>
  );
};
