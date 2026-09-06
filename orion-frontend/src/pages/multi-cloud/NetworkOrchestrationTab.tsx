/**
 * NetworkOrchestrationTab.tsx - Network Orchestration Tab
 * 抽取自 MultiCloudAdvancedPage.tsx (P2-9 Phase 47)
 */
import React from 'react';
import { Card, Descriptions, Tag, Row, Col } from 'antd';
import { spacing } from '@/tokens';

export interface NetworkOrchestrationTabProps {
  // 无 props — 内容当前为静态演示数据
}

export const NetworkOrchestrationTab: React.FC<NetworkOrchestrationTabProps> = () => (
  <Card title="Cloud Network Orchestration" style={{ borderRadius: 12 }}>
    <Descriptions bordered column={1}>
      <Descriptions.Item label="VPC Peering">
        <Tag color="green">Active</Tag> - 3 peering connections established
      </Descriptions.Item>
      <Descriptions.Item label="Cross-Cloud Connectivity">
        <Tag color="green">Active</Tag> - AWS Direct Connect + Azure ExpressRoute
      </Descriptions.Item>
      <Descriptions.Item label="DNS Management">
        Multi-cloud DNS routing enabled with latency-based failover
      </Descriptions.Item>
      <Descriptions.Item label="Security Groups">
        Unified policy across 5 cloud accounts
      </Descriptions.Item>
    </Descriptions>
    <Card
      size="small"
      title="Network Topology"
      style={{ marginTop: spacing.md, borderRadius: 8 }}
    >
      <Row gutter={16}>
        <Col span={8}>
          <Card size="small" title="AWS VPC" style={{ borderRadius: 8 }}>
            <Tag>us-east-1</Tag> <Tag>us-west-2</Tag>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title="Azure VNet" style={{ borderRadius: 8 }}>
            <Tag>eastus</Tag> <Tag>westeurope</Tag>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title="GCP VPC" style={{ borderRadius: 8 }}>
            <Tag>us-central1</Tag>
          </Card>
        </Col>
      </Row>
    </Card>
  </Card>
);

export default NetworkOrchestrationTab;
