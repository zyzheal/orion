/**
 * ServiceCatalog — 服务目录
 * P0 修复：空目录 → 开发中占位页（Google/AWS 最佳实践：透明展示开发状态）
 */
import React from 'react';
import { Typography, Tag } from 'antd';
import { CloudServerOutlined } from '@ant-design/icons';
import EmptyState from '@/components/EmptyState';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;

const ServiceCatalog: React.FC = () => (
  <div style={{ padding: 24 }}>
    <Title level={2} style={{ marginBottom: 8 }}>
      <CloudServerOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
      服务目录
    </Title>
    <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
      管理可复用的服务模板和元数据
    </Text>
    <EmptyState
      icon={<CloudServerOutlined />}
      iconColor={colors.primary[500]}
      title="服务目录开发中"
      description="服务目录管理功能预计 Q4 交付，届时将支持服务模板创建、版本管理和发布"
      primaryAction={{
        label: '查看开发计划',
        type: 'default',
      }}
    />
    <div style={{ textAlign: 'center', marginTop: 24 }}>
      <Tag color="orange">开发中</Tag>
      <Text type="secondary">API 尚未对接，预计 2026 Q4 上线</Text>
    </div>
  </div>
);

export default ServiceCatalog;
