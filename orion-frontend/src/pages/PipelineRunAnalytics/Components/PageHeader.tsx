import { Typography } from 'antd';
import { DashboardOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

export function PageHeader() {
  return (
    <>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <DashboardOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        流水线运行分析
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        运行历史成功率、耗时趋势与瓶颈分析
      </Text>
    </>
  );
}
