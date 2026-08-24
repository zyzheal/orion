/**
 * ServicePortal — 开发者服务门户
 * P0 修复：空目录 → 开发中占位页
 */
import React from 'react';
import { Typography } from 'antd';
import { AppstoreOutlined } from '@ant-design/icons';
import EmptyState from '@/components/EmptyState';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;

const ServicePortal: React.FC = () => (
  <div style={{ padding: 24 }}>
    <Title level={2} style={{ marginBottom: 8 }}>
      <AppstoreOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
      开发者门户
    </Title>
    <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
      一站式开发者服务入口
    </Text>
    <EmptyState
      icon={<AppstoreOutlined />}
      iconColor={colors.primary[500]}
      title="开发者门户开发中"
      description="开发者门户预计 Q4 交付，届时将提供 API 文档、服务发现、开发工具集成"
      primaryAction={{
        label: '查看开发计划',
        type: 'default',
      }}
    />
  </div>
);

export default ServicePortal;
