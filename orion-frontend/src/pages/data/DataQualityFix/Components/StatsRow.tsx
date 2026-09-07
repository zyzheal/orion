/**
 * DataQualityFix top stats row
 * 抽取自 index.tsx (P2-9 Phase 146)
 */
import React from 'react';
import { Card, Col, Row, Statistic } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

export interface StatsRowProps {
  ruleCount: number;
  problemCount: number;
  fixedCount: number;
  pendingCount: number;
}

export const StatsRow: React.FC<StatsRowProps> = ({
  ruleCount,
  problemCount,
  fixedCount,
  pendingCount,
}) => (
  <Row gutter={[spacing.md, spacing.md]} style={{ marginTop: spacing.lg }}>
    <Col span={6}>
      <Card>
        <Statistic
          title="检测规则数"
          value={ruleCount}
          suffix="条"
          valueStyle={{ color: colors.primary[500] }}
          prefix={<DatabaseOutlined />}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="发现问题数"
          value={problemCount}
          suffix="个"
          valueStyle={{ color: colors.error[500] }}
          prefix={<WarningOutlined />}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="已修复数"
          value={fixedCount}
          suffix="个"
          valueStyle={{ color: colors.success[500] }}
          prefix={<CheckCircleOutlined />}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="待处理数"
          value={pendingCount}
          suffix="个"
          valueStyle={{ color: colors.warning[500] }}
          prefix={<ClockCircleOutlined />}
        />
      </Card>
    </Col>
  </Row>
);
