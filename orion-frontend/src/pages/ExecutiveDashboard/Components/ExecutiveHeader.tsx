/**
 * Executive Dashboard page header
 * 抽取自 index.tsx (P2-9 Phase 158)
 */
import { Typography } from 'antd';
import { FundOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export const ExecutiveHeader = () => (
  <div style={{ marginBottom: spacing.lg }}>
    <Title level={2} style={{ marginBottom: spacing.sm }}>
      <FundOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
      总览看板
    </Title>
    <Text type="secondary">
      全局工单系统运行指标 — {dayjs().format('YYYY-MM-DD HH:mm')}
    </Text>
  </div>
);
