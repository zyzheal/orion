/**
 * PageHeader - APK 上传历史 页头
 * 抽取自 index.tsx (P2-9 Phase 215)
 */
import { Typography } from 'antd';
import { AppstoreOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

export const PageHeader = () => (
  <div style={{ marginBottom: spacing.lg }}>
    <Title
      level={2}
      style={{ marginBottom: spacing.sm, display: 'flex', alignItems: 'center' }}
    >
      <AppstoreOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
      APK 上传历史
    </Title>
    <Text type="secondary">查看和管理 APK 上传到各应用市场的历史记录</Text>
  </div>
);
