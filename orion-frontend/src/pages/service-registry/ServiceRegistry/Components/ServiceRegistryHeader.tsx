/**
 * ServiceRegistry Header
 * 抽取自 index.tsx (P2-9 Phase 142)
 */
import React from 'react';
import { Typography, Button, Space } from 'antd';
import { SettingOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface ServiceRegistryHeaderProps {
  total: number;
  loading: boolean;
  onRefresh: () => void;
  onOpenRegister: () => void;
}

export const ServiceRegistryHeader: React.FC<ServiceRegistryHeaderProps> = ({
  total,
  loading,
  onRefresh,
  onOpenRegister,
}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.lg,
    }}
  >
    <div>
      <Title level={2} style={{ marginBottom: spacing.sm }} >
        <SettingOutlined style={{ marginRight: spacing[3], color: colors.purple[500] }} />
        服务注册中心
      </Title>
      <Text type="secondary">共 {total} 个已注册服务</Text>
    </div>
    <Space>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
      <Button type="primary" icon={<PlusOutlined />} onClick={onOpenRegister}>
        注册新服务
      </Button>
    </Space>
  </div>
);
