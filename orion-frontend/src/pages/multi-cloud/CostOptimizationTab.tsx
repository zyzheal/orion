/**
 * CostOptimizationTab.tsx - Cost Optimization Tab
 * 抽取自 MultiCloudAdvancedPage.tsx (P2-9 Phase 47)
 */
import React from 'react';
import { Card, Row, Col, Statistic, Collapse, Timeline, Descriptions } from 'antd';
import { colors, spacing } from '@/tokens';

const { Panel } = Collapse;

export interface CostOptimizationTabProps {
  // 无 props — 内容当前为静态演示数据
}

export const CostOptimizationTab: React.FC<CostOptimizationTabProps> = () => (
  <Card title="Multi-Cloud Cost Optimization" style={{ borderRadius: 12 }}>
    <Row gutter={16} style={{ marginBottom: spacing.lg }}>
      <Col span={8}>
        <Card
          size="small"
          style={{ borderRadius: 8, borderTop: `2px solid ${colors.cloud.aws}` }}
        >
          <Statistic
            title="Monthly Cost (AWS)"
            value={12500}
            prefix="$"
            valueStyle={{ color: colors.primary[500] }}
          />
        </Card>
      </Col>
      <Col span={8}>
        <Card
          size="small"
          style={{ borderRadius: 8, borderTop: `2px solid ${colors.cloud.azure}` }}
        >
          <Statistic
            title="Monthly Cost (Azure)"
            value={8200}
            prefix="$"
            valueStyle={{ color: colors.purple[500] }}
          />
        </Card>
      </Col>
      <Col span={8}>
        <Card
          size="small"
          style={{ borderRadius: 8, borderTop: `2px solid ${colors.cloud.gcp}` }}
        >
          <Statistic
            title="Monthly Cost (GCP)"
            value={6300}
            prefix="$"
            valueStyle={{ color: colors.error[600] }}
          />
        </Card>
      </Col>
    </Row>
    <Collapse defaultActiveKey={['recommendations']}>
      <Panel header="Cost Optimization Recommendations" key="recommendations">
        <Timeline>
          <Timeline.Item color="green">
            <strong>Reserved Instances:</strong> Switch to 1-year reserved instances for stable
            workloads - estimated savings: $3,200/month
          </Timeline.Item>
          <Timeline.Item color="blue">
            <strong>Spot Instances:</strong> Use spot instances for batch processing - estimated
            savings: $1,800/month
          </Timeline.Item>
          <Timeline.Item color="orange">
            <strong>Right-sizing:</strong> 12 instances are over-provisioned - estimated savings:
            $900/month
          </Timeline.Item>
          <Timeline.Item color="red">
            <strong>Idle Resources:</strong> 3 unused load balancers detected - estimated savings:
            $150/month
          </Timeline.Item>
        </Timeline>
      </Panel>
      <Panel header="Cost Allocation by Service" key="allocation">
        <Descriptions bordered column={2}>
          <Descriptions.Item label="Compute">45%</Descriptions.Item>
          <Descriptions.Item label="Storage">25%</Descriptions.Item>
          <Descriptions.Item label="Network">15%</Descriptions.Item>
          <Descriptions.Item label="Database">10%</Descriptions.Item>
          <Descriptions.Item label="Other">5%</Descriptions.Item>
        </Descriptions>
      </Panel>
    </Collapse>
  </Card>
);

export default CostOptimizationTab;
