import { Typography } from 'antd';
import { BugOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

export function PageHeader() {
  return (
    <div style={{ marginBottom: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <BugOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        问题管理
      </Title>
      <Text type="secondary">管理问题生命周期，关联事件和变更，维护已知错误数据库</Text>
    </div>
  );
}
