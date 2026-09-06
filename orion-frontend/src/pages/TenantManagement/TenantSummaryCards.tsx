/**
 * TenantSummaryCards.tsx - 4 张摘要统计卡片
 * 抽取自 TenantManagement/index.tsx (P2-9 Phase 57)
 */
import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import { TeamOutlined } from '@ant-design/icons';
import { colors } from '@/tokens';
import type { TenantQuota, PoolStatus } from '@/api/tenant';
import type { TenantUsage } from '@/api/tenant';

export interface TenantSummaryCardsProps {
  quota: TenantQuota | null;
  tenantId: string | null;
  poolStatus: PoolStatus | null;
  namespacesCount: number;
  usage: TenantUsage | null;
}

export const TenantSummaryCards: React.FC<TenantSummaryCardsProps> = ({
  quota,
  tenantId,
  poolStatus,
  namespacesCount,
  usage,
}) => (
  <Row gutter={16} style={{ marginBottom: 24 }} key="summary-cards">
    <Col span={6}>
      <Card>
        <Statistic
          title="租户 ID"
          value={quota?.tenantId || tenantId?.slice(0, 8) || '无效'}
          prefix=<TeamOutlined />
          valueStyle={{ fontSize: 20 }}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="可用 Namespace"
          value={poolStatus?.availableNamespaces || 0}
          valueStyle={{ color: colors.success[500] }}
          suffix={`/ ${poolStatus?.totalNamespaces || 0}`}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="已分配 Namespace"
          value={namespacesCount}
          valueStyle={{ color: colors.primary[500] }}
          suffix={`/ ${usage?.usage.namespaces.limit || 0}`}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="池利用率"
          value={poolStatus?.utilizationPercent || 0}
          precision={1}
          suffix="%"
          valueStyle={{
            color:
              (poolStatus?.utilizationPercent || 0) > 80
                ? colors.error[500]
                : colors.success[500],
          }}
        />
      </Card>
    </Col>
  </Row>
);
