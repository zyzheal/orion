/**
 * AggregateStatsRow.tsx - 4 张 AI 域聚合数据卡
 * 抽取自 index.tsx (P2-9 Phase 224)
 */
import { Alert, Card, Col, Row, Statistic } from 'antd';
import {
  CloseCircleOutlined,
  CodeOutlined,
  DollarOutlined,
  RobotOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { AggregateStats } from '../useAIDashboardState';

interface Props {
  stats: AggregateStats;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export const AggregateStatsRow = ({ stats, loading, error, onRetry }: Props) => {
  if (error) {
    return (
      <Alert
        message="聚合数据加载异常"
        description={error}
        type="warning"
        showIcon
        style={{ marginBottom: spacing.lg }}
        action={(
          <a
            onClick={(e) => {
              e.preventDefault();
              onRetry();
            }}
          >
            重试
          </a>
        )}
      />
    );
  }

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
      <Col xs={24} sm={6}>
        <Card size="small" loading={loading}>
          <Statistic
            title="AI Agents 在线"
            value={stats.agentCount}
            prefix={<RobotOutlined style={{ color: colors.primary[500] }} />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={6}>
        <Card size="small" loading={loading}>
          <Statistic
            title="模型数量"
            value={stats.modelCount}
            prefix={<CodeOutlined style={{ color: colors.purple[500] }} />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={6}>
        <Card size="small" loading={loading}>
          <Statistic
            title="今日成本"
            value={stats.todayCost}
            prefix={<DollarOutlined style={{ color: colors.success[500] }} />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={6}>
        <Card size="small" loading={loading}>
          <Statistic
            title="合规评分"
            suffix="%"
            valueStyle={{
              color: stats.complianceScore < 60 ? colors.error[500] : colors.success[500],
            }}
            prefix={
              stats.complianceScore < 60 ? (
                <CloseCircleOutlined style={{ color: colors.error[500] }} />
              ) : (
                <SafetyOutlined style={{ color: colors.success[500] }} />
              )
            }
          />
        </Card>
      </Col>
    </Row>
  );
};
