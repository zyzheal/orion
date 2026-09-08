/**
 * PageHeader.tsx - 二方库 页面标题栏
 * 抽取自 index.tsx (P2-9 Phase 243)
 */
import { Typography, Button, Space } from 'antd';
import { PlusOutlined, ReloadOutlined, BookOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface Props {
  loading: boolean;
  onRefresh: () => void;
  onCreate: () => void;
}

export function PageHeader({ loading, onRefresh, onCreate }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.lg,
      }}
    >
      <div>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <BookOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          二方库管理
        </Title>
        <Text type="secondary">管理内部二方库的生命周期、版本发布和依赖追踪</Text>
      </div>
      <Space>
        <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
          刷新
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          创建二方库
        </Button>
      </Space>
    </div>
  );
}
