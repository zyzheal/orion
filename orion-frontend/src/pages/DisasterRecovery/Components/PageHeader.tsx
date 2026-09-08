import { Typography } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import { colors } from '@/tokens';

const { Title, Text } = Typography;

export function PageHeader() {
  return (
    <>
      <Title level={2} style={{ marginBottom: 8 }}>
        <SafetyCertificateOutlined style={{ marginRight: 12, color: colors.error[500] }} />
        灾备管理
      </Title>
      <Text type="secondary">RTO/RPO 配置 · 灾备演练 · 恢复计划</Text>
    </>
  );
}
