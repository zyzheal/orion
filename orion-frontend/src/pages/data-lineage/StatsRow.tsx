/**
 * StatsRow.tsx - 血缘统计卡片行
 * 抽取自 DataLineagePage.tsx (P2-9 Phase 61)
 */
import React from 'react';
import { Row, Col, Card, Statistic } from 'antd';
import { DatabaseOutlined, BranchesOutlined, CloudServerOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { DisplayNode } from './types';
import type { LineageEdge, LineageStats } from '@/api/data-lineage';

export interface StatsRowProps {
  stats: LineageStats | null;
  nodes: DisplayNode[];
  edges: LineageEdge[];
}

export const StatsRow: React.FC<StatsRowProps> = ({ stats, nodes, edges }) => {
  return (
    <Row gutter={16} style={{ marginBottom: spacing.lg }}>
      <Col span={6}>
        <Card>
          <Statistic
            title="数据节点"
            value={stats?.totalNodes ?? nodes.length}
            prefix={<DatabaseOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="血缘关系"
            value={stats?.totalEdges ?? edges.length}
            prefix={<BranchesOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="数据源"
            value={stats?.sourceCount ?? nodes.filter((n) => n.type === 'source').length}
            prefix={<DatabaseOutlined />}
            valueStyle={{ color: colors.info[500] }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="转换节点"
            value={stats?.transformCount ?? nodes.filter((n) => n.type === 'transform').length}
            prefix={<CloudServerOutlined />}
            valueStyle={{ color: colors.success[500] }}
          />
        </Card>
      </Col>
    </Row>
  );
};
