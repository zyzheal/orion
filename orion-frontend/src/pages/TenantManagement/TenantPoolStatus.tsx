/**
 * TenantPoolStatus.tsx - Namespace 池状态
 * 抽取自 TenantManagement/index.tsx (P2-9 Phase 57)
 */
import React from 'react';
import { Card, Row, Col, Space, Tag, Progress } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';
import { Typography } from 'antd';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import type { PoolStatus } from '@/api/tenant';

const { Text } = Typography;

export interface TenantPoolStatusProps {
  poolStatus: PoolStatus | null;
}

export const TenantPoolStatus: React.FC<TenantPoolStatusProps> = ({ poolStatus }) => (
  <Card
    title={
      <Space>
        <DatabaseOutlined style={{ color: colors.success[500] }} />
        Namespace 池状态
      </Space>
    }
    style={{ marginBottom: spacing.lg }}
  >
    <Row gutter={16}>
      <Col span={6}>
        <Text type="secondary">总数量:</Text>{' '}
        <Text strong>{poolStatus?.totalNamespaces || 0}</Text>
      </Col>
      <Col span={6}>
        <Text type="secondary">可用:</Text>{' '}
        <Tag color="green">{poolStatus?.availableNamespaces || 0}</Tag>
      </Col>
      <Col span={6}>
        <Text type="secondary">已分配:</Text>{' '}
        <Tag color="blue">{poolStatus?.allocatedNamespaces || 0}</Tag>
      </Col>
      <Col span={6}>
        <Text type="secondary">保留:</Text>{' '}
        <Tag color="orange">{poolStatus?.reservedNamespaces || 0}</Tag>
      </Col>
    </Row>
    <div style={{ marginTop: spacing.md }}>
      <Progress
        percent={poolStatus?.utilizationPercent || 0}
        strokeColor={{
          '0%': colors.success[500],
          '100%':
            poolStatus?.utilizationPercent && poolStatus.utilizationPercent > 80
              ? colors.error[500]
              : colors.primary[500],
        }}
        format={(percent) => `${(percent ?? 0).toFixed(1)}% 已使用`}
      />
    </div>
  </Card>
);
