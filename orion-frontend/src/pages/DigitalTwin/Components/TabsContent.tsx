/**
 * TabsContent.tsx - Digital Twin 两个 Tab 的内容
 * 抽取自 index.tsx (P2-9 Phase 244)
 */
import { Card, Table, Button, Tabs } from 'antd';
import { CameraOutlined, ControlOutlined } from '@ant-design/icons';
import type { TwinSnapshot, TrafficRecording } from '@/api/digital-twin';
import { buildSnapshotColumns, buildRecordingColumns } from '../Columns';

interface Props {
  snapshots: TwinSnapshot[];
  recordings: TrafficRecording[];
  loading: boolean;
  onOpenSnapshotModal: () => void;
  onOpenRecordingModal: () => void;
  onStopRecording: (id: string) => void;
}

export function TabsContent({
  snapshots, recordings, loading,
  onOpenSnapshotModal, onOpenRecordingModal, onStopRecording,
}: Props) {
  return (
    <Tabs
      items={[
        {
          key: 'snapshots',
          label: (<><CameraOutlined /> Snapshots</>),
          children: (
            <Card extra={<Button onClick={onOpenSnapshotModal}>Create Snapshot</Button>}>
              <Table columns={buildSnapshotColumns()} dataSource={snapshots} rowKey="id" loading={loading} />
            </Card>
          ),
        },
        {
          key: 'recordings',
          label: (<><ControlOutlined /> Traffic Recording</>),
          children: (
            <Card extra={<Button onClick={onOpenRecordingModal}>Start Recording</Button>}>
              <Table
                columns={buildRecordingColumns({ onStopRecording })}
                dataSource={recordings}
                rowKey="id"
                loading={loading}
              />
            </Card>
          ),
        },
      ]}
    />
  );
}
