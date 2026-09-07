/**
 * DigitalTwin — 数字孪生
 * 对接后端 /api/v1/digital-twins 完整能力
 * 含孪生管理、快照、流量录制回放、沙箱环境
 *
 * P2-9 Phase 116 拆分:
 * - useDigitalTwinState.tsx  状态 hook (12 useState + 3 Form + 5 loaders + 8 handlers)
 * - columns.tsx              5 组列定义 + STATUS_COLORS + StatusCell + formatSize
 * - Components/TwinsTab.tsx
 * - Components/SnapshotsTab.tsx
 * - Components/SandboxesTab.tsx
 * - Components/RecordingsTab.tsx
 * - Components/ReplaysTab.tsx
 * - Components/DigitalTwinModals.tsx  (3 Modals)
 */
import React, { useMemo } from 'react';
import { Card, Tabs, Typography } from 'antd';
import { ClusterOutlined } from '@ant-design/icons';
import { colors } from '@/tokens';
import { useDigitalTwinState } from './useDigitalTwinState';
import { TwinsTab } from './Components/TwinsTab';
import { SnapshotsTab } from './Components/SnapshotsTab';
import { SandboxesTab } from './Components/SandboxesTab';
import { RecordingsTab } from './Components/RecordingsTab';
import { ReplaysTab } from './Components/ReplaysTab';
import { DigitalTwinModals } from './Components/DigitalTwinModals';

const { Title, Text } = Typography;

const DigitalTwinPage: React.FC = () => {
  const state = useDigitalTwinState();
  const { activeTab, setActiveTab } = state;

  const tabItems = useMemo(
    () => [
      { key: 'twins', label: '数字孪生', children: <TwinsTab state={state} /> },
      { key: 'snapshots', label: '快照', children: <SnapshotsTab state={state} /> },
      { key: 'sandboxes', label: '沙箱', children: <SandboxesTab state={state} /> },
      { key: 'recordings', label: '流量录制', children: <RecordingsTab state={state} /> },
      { key: 'replays', label: '流量回放', children: <ReplaysTab state={state} /> },
    ],
    [state]
  );

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ marginBottom: 8 }}>
        <ClusterOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        数字孪生
      </Title>
      <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
        基础设施数字孪生模型 — 快照管理、沙箱环境、流量录制与回放
      </Text>

      <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 0 } }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ padding: '16px 16px 0' }}
          items={tabItems}
        />
      </Card>

      <DigitalTwinModals state={state} />
    </div>
  );
};

export default DigitalTwinPage;
