/**
 * MCPManagement stats row
 * 抽取自 index.tsx (P2-9 Phase 147)
 */
import React from 'react';
import { Card, Col, Row, Statistic } from 'antd';
import { CloudServerOutlined, ThunderboltOutlined, ToolOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

interface StatsRowProps {
  total: number;
  activeCount: number;
  toolsCount: number;
  coverage: string;
}

export const StatsRow: React.FC<StatsRowProps> = ({ total, activeCount, toolsCount, coverage }) => (
  <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
    <Col span={6}>
      <Card size="small">
        <Statistic title="服务总数" value={total} prefix={<CloudServerOutlined />} />
      </Card>
    </Col>
    <Col span={6}>
      <Card size="small">
        <Statistic
          title="活跃服务"
          value={activeCount}
          valueStyle={{ color: colors.success[500] }}
          prefix={<ThunderboltOutlined />}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card size="small">
        <Statistic title="工具总数" value={toolsCount} prefix={<ToolOutlined />} />
      </Card>
    </Col>
    <Col span={6}>
      <Card size="small">
        <Statistic
          title="工具覆盖率"
          value={coverage}
          valueStyle={{ color: colors.purple[500] }}
        />
      </Card>
    </Col>
  </Row>
);
