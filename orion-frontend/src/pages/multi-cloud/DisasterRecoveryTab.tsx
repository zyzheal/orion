/**
 * DisasterRecoveryTab.tsx - Cross-Region DR Tab
 * 抽取自 MultiCloudAdvancedPage.tsx (P2-9 Phase 47)
 */
import React from 'react';
import { Card, Row, Col, Progress, Descriptions, Tag, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

export interface DisasterRecoveryTabProps {
  onCreateDrPlan: () => void;
}

export const DisasterRecoveryTab: React.FC<DisasterRecoveryTabProps> = ({ onCreateDrPlan }) => (
  <Card
    title="Cross-Region Disaster Recovery"
    style={{ borderRadius: 12 }}
    extra={
      <Button icon={<PlusOutlined />} onClick={onCreateDrPlan}>
        Create DR Plan
      </Button>
    }
  >
    <Row gutter={16} style={{ marginBottom: spacing.lg }}>
      <Col span={8}>
        <Card title="RPO (Recovery Point Objective)" size="small" style={{ borderRadius: 8 }}>
          <Progress type="dashboard" percent={95} format={() => '5 min'} />
          <p
            style={{
              textAlign: 'center',
              marginTop: spacing.sm,
              color: colors.neutral[500],
            }}
          >
            Target: {'<'} 10 min
          </p>
        </Card>
      </Col>
      <Col span={8}>
        <Card title="RTO (Recovery Time Objective)" size="small" style={{ borderRadius: 8 }}>
          <Progress
            type="dashboard"
            percent={90}
            format={() => '15 min'}
            strokeColor={colors.warning[500]}
          />
          <p
            style={{
              textAlign: 'center',
              marginTop: spacing.sm,
              color: colors.neutral[500],
            }}
          >
            Target: {'<'} 30 min
          </p>
        </Card>
      </Col>
      <Col span={8}>
        <Card title="DR Readiness" size="small" style={{ borderRadius: 8 }}>
          <Progress type="dashboard" percent={88} strokeColor={colors.success[500]} />
          <p
            style={{
              textAlign: 'center',
              marginTop: spacing.sm,
              color: colors.neutral[500],
            }}
          >
            Status: Ready
          </p>
        </Card>
      </Col>
    </Row>
    <Descriptions bordered column={1}>
      <Descriptions.Item label="Primary Region">
        <Tag color="green">us-east-1 (AWS)</Tag>
      </Descriptions.Item>
      <Descriptions.Item label="Failover Region">
        <Tag color="blue">ap-northeast-1 (AWS)</Tag>
        <Tag color="orange">eastasia (Azure)</Tag>
      </Descriptions.Item>
      <Descriptions.Item label="Replication">
        Async - Multi-region data replication enabled
      </Descriptions.Item>
      <Descriptions.Item label="Last DR Test">2026-05-01 - Passed</Descriptions.Item>
    </Descriptions>
  </Card>
);

export default DisasterRecoveryTab;
