/**
 * SummaryCards - 成本汇总卡片 (4 张)
 * 抽取自 index.tsx (P2-9 Phase 220)
 */
import { Card, Col, Row, Statistic, Typography } from 'antd';
import { DollarOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Text } = Typography;

export const summaryCardStyle: React.CSSProperties = {
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
};

interface Summary {
  totalCost?: number;
  computeCost?: number;
  storageCost?: number;
  networkCost?: number;
}

interface Props {
  summary: Summary | null;
}

export const SummaryCards = ({ summary }: Props) => (
  <Row gutter={16} style={{ marginBottom: spacing.lg }}>
    <Col xs={24} sm={12} lg={6}>
      <Card style={summaryCardStyle}>
        <Statistic
          title={<Text style={{ color: colors.neutral[500] }}>本月总费用</Text>}
          value={summary?.totalCost ?? 0}
          precision={2}
          prefix={<DollarOutlined style={{ color: colors.primary[500] }} />}
          suffix="CNY"
          valueStyle={{ color: colors.neutral[900], fontWeight: 700 }}
        />
      </Card>
    </Col>
    <Col xs={24} sm={12} lg={6}>
      <Card style={summaryCardStyle}>
        <Statistic
          title={<Text style={{ color: colors.neutral[500] }}>计算费用</Text>}
          value={summary?.computeCost ?? 0}
          precision={2}
          prefix="&#x2699;"
          suffix="CNY"
          valueStyle={{ color: colors.primary[500], fontWeight: 700 }}
        />
      </Card>
    </Col>
    <Col xs={24} sm={12} lg={6}>
      <Card style={summaryCardStyle}>
        <Statistic
          title={<Text style={{ color: colors.neutral[500] }}>存储费用</Text>}
          value={summary?.storageCost ?? 0}
          precision={2}
          prefix="&#x1f4c1;"
          suffix="CNY"
          valueStyle={{ color: colors.warning[500], fontWeight: 700 }}
        />
      </Card>
    </Col>
    <Col xs={24} sm={12} lg={6}>
      <Card style={summaryCardStyle}>
        <Statistic
          title={<Text style={{ color: colors.neutral[500] }}>网络费用</Text>}
          value={summary?.networkCost ?? 0}
          precision={2}
          prefix="&#x1f310;"
          suffix="CNY"
          valueStyle={{ color: colors.success[500], fontWeight: 700 }}
        />
      </Card>
    </Col>
  </Row>
);
