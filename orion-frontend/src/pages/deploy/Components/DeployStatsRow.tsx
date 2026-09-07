/**
 * DeployStatsRow - 部署统计卡片行
 * 抽取自 DeployPage.tsx (P2-9 Phase 113)
 */
import React from 'react';
import { Row, Col, Statistic, Typography } from 'antd';
import {
  RocketOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { StatCard } from '../config';

const { Text } = Typography;

interface DeployStatsRowProps {
  stats: {
    total: number;
    deploying: number;
    success: number;
    failed: number;
    successRate: string;
  };
}

export const DeployStatsRow: React.FC<DeployStatsRowProps> = ({ stats }) => (
  <Row gutter={16} style={{ marginBottom: spacing.lg }}>
    <Col span={5}>
      <StatCard title="总部署数" value={stats.total} icon={<RocketOutlined />} />
    </Col>
    <Col span={5}>
      <StatCard
        title="部署中"
        value={stats.deploying}
        icon={<SyncOutlined spin />}
        color={colors.primary[500]}
      />
    </Col>
    <Col span={5}>
      <StatCard
        title="成功"
        value={stats.success}
        icon={<CheckCircleOutlined />}
        color={colors.success[500]}
      />
    </Col>
    <Col span={5}>
      <StatCard
        title="失败"
        value={stats.failed}
        icon={<CloseCircleOutlined />}
        color={colors.error[500]}
      />
    </Col>
    <Col span={4}>
      <Statistic
        title={<Text type="secondary">成功率</Text>}
        value={stats.successRate}
        suffix="%"
        valueStyle={{
          color:
            parseFloat(stats.successRate) >= 90
              ? colors.success[500]
              : colors.warning[500],
        }}
      />
    </Col>
  </Row>
);
