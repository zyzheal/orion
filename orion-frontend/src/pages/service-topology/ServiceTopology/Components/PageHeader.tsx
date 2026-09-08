/**
 * PageHeader.tsx - 服务拓扑页面头部
 * 抽取自 index.tsx (P2-9 Phase 226)
 */
import React from 'react';
import { Button, Space, Typography } from 'antd';
import { ClusterOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface Props {
  loading: boolean;
  onRefresh: () => void;
}

export const PageHeader: React.FC<Props> = ({ loading, onRefresh }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.lg,
    }}
  >
    <div>
      <Title
        level={2}
        style={{ marginBottom: spacing.sm, display: 'flex', alignItems: 'center' }}
      >
        <ClusterOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        服务拓扑
      </Title>
      <Text type="secondary">可视化服务间依赖关系与调用链路</Text>
    </div>
    <Space>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
    </Space>
  </div>
);
