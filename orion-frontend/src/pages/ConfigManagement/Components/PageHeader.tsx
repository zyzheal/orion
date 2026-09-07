/**
 * ConfigManagement PageHeader
 * 抽取自 index.tsx (P2-9 Phase 174)
 */
import { Typography, Space, Button } from 'antd';
import {
  ReloadOutlined,
  PlusOutlined,
  CloudSyncOutlined,
  ScanOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface PageHeaderProps {
  loading: boolean;
  driftLoading: boolean;
  onRefresh: () => void;
  onSync: () => void;
  onDriftDetect: () => void;
  onCreate: () => void;
}

export const PageHeader = ({
  loading,
  driftLoading,
  onRefresh,
  onSync,
  onDriftDetect,
  onCreate,
}: PageHeaderProps) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
    <div>
      <Title level={2}>配置管理</Title>
      <Text type="secondary">GitOps 工作流、变更审批、差异分析、漂移检测</Text>
    </div>
    <Space>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
      <Button icon={<CloudSyncOutlined />} onClick={onSync} loading={loading}>
        Git 同步
      </Button>
      <Button icon={<ScanOutlined />} onClick={onDriftDetect} loading={driftLoading}>
        漂移检测
      </Button>
      <Button icon={<PlusOutlined />} type="primary" onClick={onCreate}>
        新建配置
      </Button>
    </Space>
  </div>
);
