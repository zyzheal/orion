/**
 * service-portal PageHeader
 * 抽取自 index.tsx (P2-9 Phase 182)
 */
import { Typography } from 'antd';
import { AppstoreOutlined } from '@ant-design/icons';
import { colors } from '@/tokens';

const { Title, Text } = Typography;

export const PageHeader = () => (
  <>
    <Title level={2} style={{ marginBottom: 8 }}>
      <AppstoreOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
      开发者门户
    </Title>
    <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
      一站式开发者服务入口 — 服务注册、发现与健康监控
    </Text>
  </>
);
