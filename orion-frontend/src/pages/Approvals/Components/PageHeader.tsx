import { Typography, Button, Space } from 'antd';
import { PlusOutlined, ReloadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

interface PageHeaderProps {
  loading: boolean;
  onRefresh: () => void;
  onCreateClick: () => void;
}

export function PageHeader({ loading, onRefresh, onCreateClick }: PageHeaderProps) {
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
          <CheckCircleOutlined
            style={{ marginRight: spacing[3], color: colors.primary[500] }}
          />
          审批管理
        </Title>
        <Text type="secondary">管理多级审批流程，包括创建、审批和跟踪</Text>
      </div>
      <Space>
        <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
          刷新
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreateClick}>
          创建审批
        </Button>
      </Space>
    </div>
  );
}
