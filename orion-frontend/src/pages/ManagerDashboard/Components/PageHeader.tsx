/**
 * ManagerDashboard PageHeader
 * 抽取自 index.tsx (P2-9 Phase 181)
 */
import { Typography } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export const PageHeader = () => (
  <div style={{ marginBottom: spacing.lg }}>
    <Title level={2} style={{ marginBottom: spacing.sm }}>
      <BarChartOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
      经理看板
    </Title>
    <Text type="secondary">团队管理与成员效能分析 — {dayjs().format('YYYY-MM-DD HH:mm')}</Text>
  </div>
);
