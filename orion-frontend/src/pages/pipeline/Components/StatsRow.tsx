/**
 * StatsRow - 顶部统计
 * 抽取自 PipelineRetryRollback.tsx (P2-9 Phase 111)
 */
import React from 'react';
import { Row, Col, Card, Statistic } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';
import type { PipelineRetryRollbackState } from '../usePipelineRetryRollbackState';

interface StatsRowProps {
  state: PipelineRetryRollbackState;
}

export const StatsRow: React.FC<StatsRowProps> = ({ state }) => {
  const { stats } = state;
  return (
    <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
      <Col span={6}>
        <Card bordered={false} style={{ textAlign: 'center' }}>
          <Statistic
            title="总执行数"
            value={stats.total}
            valueStyle={{ color: colors.neutral[900] }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card bordered={false} style={{ textAlign: 'center' }}>
          <Statistic
            title="成功数"
            value={stats.success}
            valueStyle={{ color: colors.success[500] }}
            prefix={<CheckCircleOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card bordered={false} style={{ textAlign: 'center' }}>
          <Statistic
            title="失败数"
            value={stats.failed}
            valueStyle={{ color: colors.error[500] }}
            prefix={<CloseCircleOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card bordered={false} style={{ textAlign: 'center' }}>
          <Statistic
            title="成功率"
            value={stats.successRate}
            suffix="%"
            valueStyle={
              {
                color: stats.successRate >= 70 ? colors.success[500] : colors.warning[500],
              }
            }
            prefix=<ExclamationCircleOutlined />
          />
        </Card>
      </Col>
    </Row>
  );
};
