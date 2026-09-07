/**
 * SBOM Stats Row
 * 抽取自 index.tsx (P2-9 Phase 134)
 */
import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import {
  SafetyOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { spacing } from '@/tokens';
import { cPrimary, cError, cWarning, cSuccess, cardStyle } from '../constants';
import type { SbomStats } from '../types';

interface SBOMStatsRowProps {
  stats: SbomStats;
}

export const SBOMStatsRow: React.FC<SBOMStatsRowProps> = ({ stats }) => {
  const iconStyle = (color: string): React.CSSProperties => ({
    color,
    marginLeft: spacing.md,
    fontSize: 16,
  });
  return (
    <Row gutter={[spacing.md, spacing.md]}>
      <Col span={6}>
        <Card style={cardStyle(cPrimary)}>
          <Statistic
            title="受管理组件数"
            value={stats.totalComponents}
            suffix="个"
            valueStyle={{ color: cPrimary }}
          />
          <SafetyOutlined style={iconStyle(cPrimary)} />
        </Card>
      </Col>
      <Col span={6}>
        <Card style={cardStyle(cError)}>
          <Statistic
            title="已知漏洞数"
            value={stats.totalVulns}
            suffix="个"
            valueStyle={{ color: cError }}
          />
          <ExclamationCircleOutlined style={iconStyle(cError)} />
        </Card>
      </Col>
      <Col span={6}>
        <Card style={cardStyle(cWarning)}>
          <Statistic
            title="许可证违规"
            value={stats.licenseViolations}
            suffix="个"
            valueStyle={{ color: cWarning }}
          />
          <WarningOutlined style={iconStyle(cWarning)} />
        </Card>
      </Col>
      <Col span={6}>
        <Card style={cardStyle(cSuccess)}>
          <Statistic
            title="合规率"
            value={stats.complianceRate}
            suffix="%"
            valueStyle={{ color: cSuccess }}
          />
          <CheckCircleOutlined style={iconStyle(cSuccess)} />
        </Card>
      </Col>
    </Row>
  );
};
