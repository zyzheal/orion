import { Typography } from 'antd';
import { ClusterOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

export function PageHeader() {
  return (
    <>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <ClusterOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
        服务边界与模块耦合分析
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        模块耦合度 · 接口层覆盖 · 配置化启动成熟度 · 循环依赖检测
      </Text>
    </>
  );
}
