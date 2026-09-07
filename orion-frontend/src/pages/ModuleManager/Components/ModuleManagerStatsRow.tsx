/**
 * ModuleManagerStatsRow - 4 个 MetricCard 统计
 * 抽取自 index.tsx (P2-9 Phase 117)
 */
import React from 'react';
import { Col, Row } from 'antd';
import {
  CheckCircleOutlined,
  ClusterOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import MetricCard from '@/components/MetricCard';
import { colors, spacing } from '@/tokens';
import type { ModuleManagerState } from '../useModuleManagerState';

interface ModuleManagerStatsRowProps {
  state: ModuleManagerState;
}

export const ModuleManagerStatsRow: React.FC<ModuleManagerStatsRowProps> = ({ state }) => {
  const { stats } = state;

  return (
    <div style={{ marginBottom: spacing[6] }}>
      <Row gutter={spacing[4]}>
        <Col span={6}>
          <MetricCard
            title="模块总数"
            value={stats.total}
            icon={<ClusterOutlined style={{ fontSize: 20 }} />}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="活跃模块"
            value={stats.active}
            color={colors.success[500]}
            icon={<CheckCircleOutlined style={{ fontSize: 20 }} />}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="已启用"
            value={stats.enabled}
            icon={<ThunderboltOutlined style={{ fontSize: 20 }} />}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="失败模块"
            value={stats.failed}
            color={stats.failed > 0 ? colors.error[500] : undefined}
            icon={<WarningOutlined style={{ fontSize: 20 }} />}
          />
        </Col>
      </Row>
    </div>
  );
};
