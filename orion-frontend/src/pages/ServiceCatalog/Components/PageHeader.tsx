/**
 * ServiceCatalog PageHeader
 * 抽取自 index.tsx (P2-9 Phase 189)
 */
import { Typography } from 'antd';
import { AppstoreOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

export const PageHeader = () => (
  <>
    <Title level={2} style={{ marginBottom: 8 }}>
      <AppstoreOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
      服务目录
    </Title>
    <Text type="secondary" style={{ marginBottom: spacing.md, display: 'block' }}>
      服务注册管理 · 请求生命周期 · SLA 违约追踪
    </Text>
  </>
);
