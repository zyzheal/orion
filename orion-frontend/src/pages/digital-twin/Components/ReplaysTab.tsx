/**
 * ReplaysTab - 流量回放列表 Tab
 * 抽取自 index.tsx (P2-9 Phase 116)
 */
import React, { useMemo } from 'react';
import { Button, Empty, Space, Table } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { TrafficReplay } from '@/api/digital-twin';
import { buildReplayColumns } from '../columns';
import type { DigitalTwinState } from '../useDigitalTwinState';

interface ReplaysTabProps {
  state: DigitalTwinState;
}

export const ReplaysTab: React.FC<ReplaysTabProps> = ({ state }) => {
  const { replays, loadReplays } = state;

  const columns = useMemo(() => buildReplayColumns(), []);

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={loadReplays}>刷新</Button>
      </Space>
      <Table<TrafficReplay>
        columns={columns}
        dataSource={replays}
        rowKey="id"
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: <Empty description="暂无回放记录" /> }}
        scroll={{ x: 1000 }}
      />
    </div>
  );
};
