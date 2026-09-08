import { Typography } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;

export function PageHeader() {
  return (
    <>
      <Title level={2} style={{ marginBottom: 8 }}>
        <ClockCircleOutlined style={{ marginRight: 12, color: colors.warning[500] }} />
        审批超时升级
      </Title>
      <Text type="secondary">SLA 监控 · 超时自动升级 · 审批时效分析</Text>
      <br />
    </>
  );
}
