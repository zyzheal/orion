/**
 * PolicyHeader - 策略管理页顶部
 * 抽取自 index.tsx (P2-9 Phase 114)
 */
import React from 'react';
import { Button, Space, Tooltip, Typography } from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  SyncOutlined,
  PlayCircleOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface PolicyHeaderProps {
  loading: boolean;
  onLoadData: () => void;
  onEvaluate: () => void;
  onCreate: () => void;
}

export const PolicyHeader: React.FC<PolicyHeaderProps> = ({
  loading,
  onLoadData,
  onEvaluate,
  onCreate,
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
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <SafetyCertificateOutlined
          style={{ marginRight: spacing[3], color: colors.primary[500] }}
        />
        OPA 策略管理
      </Title>
      <Text type="secondary">策略即代码，统一治理全链路</Text>
    </div>
    <Space>
      <Button icon={<ReloadOutlined />} onClick={onLoadData} loading={loading}>
        刷新
      </Button>
      <Tooltip title="Bundle 同步功能开发中">
        <Button icon={<SyncOutlined />} disabled>
          同步 Bundle
        </Button>
      </Tooltip>
      <Button icon={<PlayCircleOutlined />} onClick={onEvaluate}>
        评估策略
      </Button>
      <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
        创建策略
      </Button>
    </Space>
  </div>
);
