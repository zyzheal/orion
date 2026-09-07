/**
 * Dashboard Core page header
 * 抽取自 index.tsx (P2-9 Phase 156)
 */
import { Typography } from 'antd';
import { DashboardOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

export const DashboardCoreHeader = () => (
  <div style={{ marginBottom: spacing.lg }}>
    <Title level={2} style={{ marginBottom: spacing.sm }}>
      <DashboardOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
      工作台
    </Title>
    <Text type="secondary">
      平台运行概览 — {dayjs().format('YYYY-MM-DD HH:mm')}
    </Text>
  </div>
);
