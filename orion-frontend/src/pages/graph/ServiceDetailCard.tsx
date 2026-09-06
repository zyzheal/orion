/**
 * Service Detail Card
 * Displays metadata + upstream/downstream dependency tags for a selected
 * service. Rendered above the service dependency table when a row is picked.
 */
import React from 'react';
import { Button, Card, Descriptions, Space, Tag, Typography } from 'antd';
import { DeploymentUnitOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import type { ServiceDetail } from '@/api/graph';
import {
  serviceStatusColorMap,
  serviceStatusLabelMap,
} from './config';

const { Text } = Typography;

export interface ServiceDetailCardProps {
  detail: ServiceDetail;
  onClose: () => void;
}

const ServiceDetailCard: React.FC<ServiceDetailCardProps> = ({ detail, onClose }) => {
  return (
    <Card
      title={
        <Space>
          <DeploymentUnitOutlined style={{ color: colors.primary[500] }} />
          <Text>{detail.name}</Text>
          <Tag color={serviceStatusColorMap[detail.status]}>
            {serviceStatusLabelMap[detail.status]}
          </Tag>
        </Space>
      }
      size="small"
      extra={
        <Button type="link" size="small" onClick={onClose}>
          关闭
        </Button>
      }
      style={{ marginBottom: spacing.md }}
    >
      <Descriptions size="small" column={2} bordered>
        <Descriptions.Item label="服务ID">{detail.id}</Descriptions.Item>
        <Descriptions.Item label="版本">{detail.version ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="描述" span={2}>
          {detail.description ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label="负责人">{detail.owner ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="上游依赖数">
          {detail.upstreamDependencies.length}
        </Descriptions.Item>
        <Descriptions.Item label="下游依赖数">
          {detail.downstreamDependencies.length}
        </Descriptions.Item>
        <Descriptions.Item label="基础设施节点" span={2}>
          {detail.infrastructureNodes.length}
        </Descriptions.Item>
      </Descriptions>

      {detail.upstreamDependencies.length > 0 && (
        <div style={{ marginTop: spacing.md }}>
          <Text strong>上游依赖:</Text>
          <div style={{ marginTop: spacing.sm }}>
            {detail.upstreamDependencies.map((dep) => (
              <Tag
                key={dep.id}
                color={serviceStatusColorMap[dep.status]}
                style={{ marginBottom: 4 }}
              >
                {dep.name}
              </Tag>
            ))}
          </div>
        </div>
      )}

      {detail.downstreamDependencies.length > 0 && (
        <div style={{ marginTop: spacing.md }}>
          <Text strong>下游依赖:</Text>
          <div style={{ marginTop: spacing.sm }}>
            {detail.downstreamDependencies.map((dep) => (
              <Tag
                key={dep.id}
                color={serviceStatusColorMap[dep.status]}
                style={{ marginBottom: 4 }}
              >
                {dep.name}
              </Tag>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

export default ServiceDetailCard;
