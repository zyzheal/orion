/**
 * Strengths & Weaknesses
 * 抽取自 index.tsx (P2-9 Phase 129)
 */
import React from 'react';
import { Row, Col, Card, Tag, Space, Typography } from 'antd';
import { RiseOutlined, WarningOutlined } from '@ant-design/icons';
import CardPanel from '@/components/CardPanel';
import { GaugeChart } from '@/components/charts';
import { spacing } from '@/tokens';
import type { EngineerDashboardData } from '@/types/pages';
import { COLORS, categoryName } from '../constants';

const { Text } = Typography;

interface StrengthsAndWeaknessesProps {
  data: EngineerDashboardData;
}

export const StrengthsAndWeaknesses: React.FC<StrengthsAndWeaknessesProps> = ({ data }) => (
  <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
    <Col xs={24} xl={12}>
      <CardPanel title="优势领域" extra={<RiseOutlined style={{ color: COLORS.success }} />}>
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          {data.strengths.map((s) => (
            <Card key={s.category} size="small">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing.sm,
                }}
              >
                <Tag color={COLORS.success}>{categoryName(s.category)}</Tag>
                <Space>
                  <Text style={{ fontSize: spacing[3] }}>解决 {s.resolvedCount} 个</Text>
                  <Text style={{ fontSize: spacing[3] }}>
                    SLA {(s.slaComplianceRate * 100).toFixed(0)}%
                  </Text>
                </Space>
              </div>
              <GaugeChart
                value={s.proficiencyScore}
                title={`熟练度 ${s.proficiencyScore}%`}
                max={100}
                size={120}
                unit="%"
              />
            </Card>
          ))}
        </Space>
      </CardPanel>
    </Col>

    <Col xs={24} xl={12}>
      <CardPanel
        title="待提升领域"
        extra={<WarningOutlined style={{ color: COLORS.warning }} />}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          {data.weaknesses.map((w) => (
            <Card
              key={w.category}
              size="small"
              style={{
                borderLeft: `3px solid ${
                  w.slaComplianceRate < 0.6 ? COLORS.error : COLORS.warning
                }`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing.sm,
                }}
              >
                <Tag color={w.slaComplianceRate < 0.6 ? 'error' : 'warning'}>
                  {categoryName(w.category)}
                </Tag>
                <Space>
                  <Text style={{ fontSize: spacing[3] }}>解决 {w.resolvedCount} 个</Text>
                  <Text style={{ fontSize: spacing[3] }}>
                    SLA {(w.slaComplianceRate * 100).toFixed(0)}%
                  </Text>
                </Space>
              </div>
              <GaugeChart
                value={Math.round(w.slaComplianceRate * 100)}
                title={`SLA ${Math.round(w.slaComplianceRate * 100)}%`}
                max={100}
                size={120}
                unit="%"
                thresholds={{ warning: 70, danger: 60 }}
              />
              <div style={{ marginTop: spacing.sm }}>
                <Text type="secondary" style={{ fontSize: spacing[3] }}>
                  <WarningOutlined style={{ marginRight: 4 }} />
                  建议: {w.suggestion}
                </Text>
              </div>
            </Card>
          ))}
        </Space>
      </CardPanel>
    </Col>
  </Row>
);
