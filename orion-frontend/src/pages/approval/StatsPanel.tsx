/**
 * StatsPanel - 4 张统计卡片
 * 抽取自 ApprovalPage.tsx (P2-9 Phase 40)
 */
import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import { ClockCircleOutlined, CheckCircleOutlined, StopOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import type { ApprovalRequest } from '@/api/approvals';

export const StatsPanel: React.FC<{ approvals: ApprovalRequest[] }> = ({ approvals }) => {
  const stats = {
    total: approvals.length,
    pending: approvals.filter((a) => a.status === 'pending').length,
    approved: approvals.filter((a) => a.status === 'approved').length,
    rejected: approvals.filter((a) => a.status === 'rejected').length,
  };

  return (
    <Card size="small" style={{ marginBottom: spacing.md }}>
      <Row gutter={16}>
        <Col span={6}>
          <Statistic title="总计" value={stats.total} />
        </Col>
        <Col span={6}>
          <Statistic
            title="待审批"
            value={stats.pending}
            valueStyle={{ color: colors.primary[500] }}
            prefix={<ClockCircleOutlined />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="已通过"
            value={stats.approved}
            valueStyle={{ color: colors.success[500] }}
            prefix={<CheckCircleOutlined />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="已拒绝"
            value={stats.rejected}
            valueStyle={{ color: colors.error[400] }}
            prefix={<StopOutlined />}
          />
        </Col>
      </Row>
    </Card>
  );
};
