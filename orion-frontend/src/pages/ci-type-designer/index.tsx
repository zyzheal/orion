/**
 * CITypeDesigner — CI 类型设计器
 * P0 修复：空目录 → 开发中占位页
 */
import React from 'react';
import { Typography } from 'antd';
import { BuildOutlined } from '@ant-design/icons';
import EmptyState from '@/components/EmptyState';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;

const CITypeDesigner: React.FC = () => (
  <div style={{ padding: 24 }}>
    <Title level={2} style={{ marginBottom: 8 }}>
      <BuildOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
      CI 类型设计器
    </Title>
    <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
      可视化设计 CI 类型属性与关系
    </Text>
    <EmptyState
      icon={<BuildOutlined />}
      iconColor={colors.primary[500]}
      title="CI 类型设计器开发中"
      description="CI 类型设计器预计 Q4 交付，届时将支持拖拽式字段配置和类型关系图"
      primaryAction={{
        label: '查看开发计划',
        type: 'default',
      }}
    />
  </div>
);

export default CITypeDesigner;
