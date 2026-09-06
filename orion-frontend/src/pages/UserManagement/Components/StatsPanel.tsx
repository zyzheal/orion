/**
 * StatsPanel.tsx - 用户管理统计面板
 * 抽取自 UserManagement/index.tsx (P2-9 Phase 97)
 */
import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import {
  UserOutlined,
  CheckCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { spacing } from '@/tokens';
import { colors } from '@/tokens/colors';

interface StatsPanelProps {
  stats: {
    total: number;
    active: number;
    inactive: number;
    admins: number;
  };
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats }) => (
  <Card size="small" style={{ marginBottom: spacing.md }}>
    <Row gutter={16}>
      <Col span={6}>
        <Statistic title="用户总数" value={stats.total} prefix={<UserOutlined />} />
      </Col>
      <Col span={6}>
        <Statistic
          title="已启用"
          value={stats.active}
          valueStyle={{ color: colors.success[500] }}
          prefix={<CheckCircleOutlined />}
        />
      </Col>
      <Col span={6}>
        <Statistic
          title="已禁用/锁定"
          value={stats.inactive}
          valueStyle={{ color: colors.warning[500] }}
          prefix={<StopOutlined />}
        />
      </Col>
      <Col span={6}>
        <Statistic
          title="管理员"
          value={stats.admins}
          valueStyle={{ color: colors.error[500] }}
        />
      </Col>
    </Row>
  </Card>
);
