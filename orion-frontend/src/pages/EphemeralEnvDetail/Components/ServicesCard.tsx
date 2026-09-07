/**
 * ServicesCard - 服务列表卡片
 * 抽取自 index.tsx (P2-9 Phase 115)
 */
import React from 'react';
import { Card, Space, Badge, Tag, Typography, Table as AntTable } from 'antd';
import { CodeOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { EphemeralEnvDetailState } from '../useEphemeralEnvDetailState';

const { Text } = Typography;

const serviceColumns = [
  {
    title: '服务名称',
    dataIndex: 'name',
    key: 'name',
    width: 160,
    render: (value: string) => (
      <Space>
        <CodeOutlined style={{ color: colors.purple[500] }} />
        <Text strong>{value}</Text>
      </Space>
    ),
  },
  {
    title: '镜像',
    dataIndex: 'image',
    key: 'image',
    ellipsis: true,
    render: (value: string) => (
      <Text code style={{ fontSize: spacing[2] }}>
        {value}
      </Text>
    ),
  },
  {
    title: '副本数',
    dataIndex: 'replicas',
    key: 'replicas',
    width: 80,
    render: (value: number) => <Tag>{value}</Tag>,
  },
  {
    title: '健康状态',
    dataIndex: 'health',
    key: 'health',
    width: 100,
    render: (value: string) => (
      <Badge
        status={value === 'healthy' ? 'success' : value === 'unhealthy' ? 'error' : 'warning'}
        text={value === 'healthy' ? '健康' : value === 'unhealthy' ? '异常' : '检测中'}
      />
    ),
  },
];

interface ServicesCardProps {
  state: EphemeralEnvDetailState;
}

export const ServicesCard: React.FC<ServicesCardProps> = ({ state }) => {
  const { env, services } = state;
  if (!env) return null;

  return (
    <Card
      title={
        <Space>
          <CodeOutlined />
          服务列表
        </Space>
      }
      size="small"
      style={{ marginBottom: spacing.lg }}
    >
      {services.length > 0 ? (
        <AntTable
          columns={serviceColumns}
          dataSource={services}
          rowKey="key"
          size="small"
          pagination={false}
        />
      ) : (
        <Text type="secondary">
          {env.status === 'destroyed' ? '环境已销毁，无服务信息' : '暂无服务信息'}
        </Text>
      )}
    </Card>
  );
};
