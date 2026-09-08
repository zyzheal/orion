/**
 * GlobalParams PageHeader
 * 抽取自 index.tsx (P2-9 Phase 201)
 */
import { Button, Space, Typography } from 'antd';
import {
  ApiOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface Props {
  loading: boolean;
  onCreate: () => void;
  onRefresh: () => void;
  onResolve: () => void;
}

export const PageHeader = ({ loading, onCreate, onRefresh, onResolve }: Props) => (
  <div
    style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}
  >
    <div style={{ flex: 1 }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <ApiOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        全局参数管理
      </Title>
      <Text type="secondary">
        跨 Pipeline 共享的参数配置，支持 tenant / pipeline / global 三级作用域
      </Text>
    </div>
    <Space>
      <Button icon={<PlayCircleOutlined />} onClick={onResolve}>
        批量解析
      </Button>
      <Button icon={<PlusOutlined />} type="primary" onClick={onCreate}>
        创建参数
      </Button>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
    </Space>
  </div>
);
