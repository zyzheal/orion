/**
 * PageHeader.tsx - 页面标题 + 刷新/新建按钮
 * 抽取自 index.tsx (P2-9 Phase 231)
 */
import React from 'react';
import { Button, Space, Typography } from 'antd';
import { GatewayOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface Props {
  loading: boolean;
  onRefresh: () => void;
  onCreate: () => void;
}

export const PageHeader: React.FC<Props> = ({ loading, onRefresh, onCreate }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
      alignItems: 'flex-start',
    }}
  >
    <div>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <GatewayOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        API 网关路由
      </Title>
      <Text type="secondary">管理和监控 API Gateway 路由规则</Text>
    </div>
    <Space>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
      <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
        新建路由
      </Button>
    </Space>
  </div>
);
