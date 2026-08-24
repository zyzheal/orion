/**
 * DigitalTwin — 数字孪生
 * P0 修复：空目录 → 开发中占位页
 */
import React from 'react';
import { Typography } from 'antd';
import { ClusterOutlined } from '@ant-design/icons';
import EmptyState from '@/components/EmptyState';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;

const DigitalTwin: React.FC = () => (
  <div style={{ padding: 24 }}>
    <Title level={2} style={{ marginBottom: 8 }}>
      <ClusterOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
      数字孪生
    </Title>
    <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
      基础设施数字孪生模型
    </Text>
    <EmptyState
      icon={<ClusterOutlined />}
      iconColor={colors.primary[500]}
      title="数字孪生开发中"
      description="数字孪生功能预计 Q1 2027 交付，届时将支持拓扑模型实时映射和仿真"
      primaryAction={{
        label: '查看开发计划',
        type: 'default',
      }}
    />
  </div>
);

export default DigitalTwin;
