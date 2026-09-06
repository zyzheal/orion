/**
 * StatsCards.tsx - Multi-Cloud Advanced 顶部 4 张统计卡
 * 抽取自 MultiCloudAdvancedPage.tsx (P2-9 Phase 47)
 */
import React from 'react';
import { Card, Statistic, Row, Col } from 'antd';
import {
  CloudOutlined,
  GlobalOutlined,
  SafetyOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { CloudAccount, CloudResource } from '@/api/multi-cloud';

export interface StatsCardsProps {
  accounts: CloudAccount[];
  resources: CloudResource[];
}

export const StatsCards: React.FC<StatsCardsProps> = ({ accounts, resources }) => {
  const activeProviders = new Set(
    accounts.map((a) => a.provider_id || a.credential_type || (a as any).provider),
  ).size;
  const regionCount = new Set(accounts.map((a) => a.region)).size;

  return (
    <Row gutter={16} style={{ marginBottom: spacing.lg }}>
      <Col span={6}>
        <Card
          size="small"
          style={{ borderRadius: 12, borderTop: `3px solid ${colors.primary[500]}` }}
        >
          <Statistic
            title="云账号"
            value={accounts.length}
            prefix={<CloudOutlined style={{ color: colors.primary[500] }} />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card
          size="small"
          style={{ borderRadius: 12, borderTop: `3px solid ${colors.success[500]}` }}
        >
          <Statistic
            title="活跃厂商"
            value={activeProviders}
            prefix={<GlobalOutlined style={{ color: colors.success[500] }} />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card
          size="small"
          style={{ borderRadius: 12, borderTop: `3px solid ${colors.info[500]}` }}
        >
          <Statistic
            title="总资源"
            value={resources.length}
            prefix={<SafetyOutlined style={{ color: colors.info[500] }} />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card
          size="small"
          style={{ borderRadius: 12, borderTop: `3px solid ${colors.warning[500]}` }}
        >
          <Statistic
            title="覆盖区域"
            value={regionCount}
            prefix={<SwapOutlined style={{ color: colors.warning[500] }} />}
          />
        </Card>
      </Col>
    </Row>
  );
};

export default StatsCards;
