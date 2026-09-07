/**
 * RecordingsTab - 流量录制列表 Tab
 * 抽取自 index.tsx (P2-9 Phase 116)
 */
import React, { useMemo } from 'react';
import { Button, Empty, Space, Table } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { TrafficRecording } from '@/api/digital-twin';
import { buildRecordingColumns } from '../columns';
import type { DigitalTwinState } from '../useDigitalTwinState';

interface RecordingsTabProps {
  state: DigitalTwinState;
}

export const RecordingsTab: React.FC<RecordingsTabProps> = ({ state }) => {
  const { recordings, loadRecordings } = state;

  const columns = useMemo(() => buildRecordingColumns(), []);

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={loadRecordings}>刷新</Button>
      </Space>
      <Table<TrafficRecording>
        columns={columns}
        dataSource={recordings}
        rowKey="id"
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: <Empty description="暂无录制记录" /> }}
        scroll={{ x: 900 }}
      />
    </div>
  );
};
