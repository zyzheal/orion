/**
 * SLAStatsBar.tsx - SLA 4 张统计卡片
 * 抽取自 SLA/index.tsx (P2-9 Phase 55)
 */
import React from 'react';
import { Typography, Card, Row, Col, Progress } from 'antd';
import {
  SafetyCertificateOutlined,
  FieldTimeOutlined,
  FireOutlined,
} from '@ant-design/icons';
import { colors, spacing, componentRadius, shadows } from '@/tokens';
import type { SLAStats } from '@/api/sla';

const { Text } = Typography;

export interface SLAStatsBarProps {
  stats: SLAStats | null;
  defTotal: number;
}

const iconBox = (bg: string): React.CSSProperties => ({
  width: 48,
  height: 48,
  borderRadius: componentRadius.card,
  background: bg,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export const SLAStatsBar: React.FC<SLAStatsBarProps> = ({ stats, defTotal }) => (
  <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.lg }}>
    <Col xs={24} sm={12} lg={6}>
      <Card
        style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
        styles={{ body: { padding: spacing.lg } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Text type="secondary" style={{ fontSize: 13 }}>SLA 定义总数</Text>
            <div style={{ fontSize: 28, fontWeight: 600, color: colors.neutral[900], marginTop: 4 }}>
              {stats?.totalDefinitions ?? defTotal}
            </div>
          </div>
          <div style={iconBox(colors.primary[50])}>
            <SafetyCertificateOutlined style={{ fontSize: 22, color: colors.primary[500] }} />
          </div>
        </div>
      </Card>
    </Col>
    <Col xs={24} sm={12} lg={6}>
      <Card
        style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
        styles={{ body: { padding: spacing.lg } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Text type="secondary" style={{ fontSize: 13 }}>活跃追踪</Text>
            <div style={{ fontSize: 28, fontWeight: 600, color: colors.info[600], marginTop: 4 }}>
              {stats?.activeTrackings ?? 0}
            </div>
          </div>
          <div style={iconBox(colors.info[50])}>
            <FieldTimeOutlined style={{ fontSize: 22, color: colors.info[500] }} />
          </div>
        </div>
      </Card>
    </Col>
    <Col xs={24} sm={12} lg={6}>
      <Card
        style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
        styles={{ body: { padding: spacing.lg } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Text type="secondary" style={{ fontSize: 13 }}>违约次数</Text>
            <div style={{ fontSize: 28, fontWeight: 600, color: colors.error[600], marginTop: 4 }}>
              {stats?.breachedCount ?? 0}
            </div>
          </div>
          <div style={iconBox(colors.error[50])}>
            <FireOutlined style={{ fontSize: 22, color: colors.error[500] }} />
          </div>
        </div>
      </Card>
    </Col>
    <Col xs={24} sm={12} lg={6}>
      <Card
        style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
        styles={{ body: { padding: spacing.lg } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Text type="secondary" style={{ fontSize: 13 }}>合规率</Text>
            <div style={{ fontSize: 28, fontWeight: 600, color: colors.success[600], marginTop: 4 }}>
              {stats?.complianceRate != null ? `${stats.complianceRate.toFixed(1)}%` : '-'}
            </div>
          </div>
          <Progress
            type="circle"
            percent={stats?.complianceRate ?? 0}
            size={48}
            strokeColor={colors.success[500]}
            trailColor={colors.neutral[200]}
            format={(p) => `${p?.toFixed(0) ?? 0}%`}
          />
        </div>
      </Card>
    </Col>
  </Row>
);
