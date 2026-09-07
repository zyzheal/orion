/**
 * FormInstancePipeline StatsCards
 * 抽取自 index.tsx (P2-9 Phase 176)
 */
import { Card, Typography, Row, Col } from 'antd';
import { colors, spacing } from '@/tokens';

const { Text } = Typography;

interface StatsCardsProps {
  totalInstances: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

const StatCell = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <Col span={6}>
    <Card>
      <Text type="secondary">{label}</Text>
      <div style={{ fontSize: 24, fontWeight: 600, color }}>
        {value}
      </div>
    </Card>
  </Col>
);

export const StatsCards = ({
  totalInstances,
  pendingCount,
  approvedCount,
  rejectedCount,
}: StatsCardsProps) => (
  <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
    <StatCell label="实例总数" value={totalInstances} color={colors.primary[500]} />
    <StatCell label="待审批" value={pendingCount} color={colors.warning[500]} />
    <StatCell label="已通过" value={approvedCount} color={colors.success[500]} />
    <StatCell label="已拒绝" value={rejectedCount} color={colors.error[500]} />
  </Row>
);
