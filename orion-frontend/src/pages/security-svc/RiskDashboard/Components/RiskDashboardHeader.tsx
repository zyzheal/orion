/**
 * RiskDashboard header
 * 抽取自 index.tsx (P2-9 Phase 143)
 */
import React from 'react';
import { Button, Space, Typography } from 'antd';
import {
  ExclamationCircleOutlined,
  ReloadOutlined,
  SafetyOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

interface RiskDashboardHeaderProps {
  loading: boolean;
  onRefresh: () => void;
  onQuickCheck: () => void;
  onFullCheck: () => void;
  onOpenAssess: () => void;
}

export const RiskDashboardHeader: React.FC<RiskDashboardHeaderProps> = ({
  loading,
  onRefresh,
  onQuickCheck,
  onFullCheck,
  onOpenAssess,
}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
    <div>
      <Title level={2}>风险管理</Title>
      <Text type="secondary">风险评估、健康检查、风险事件监控</Text>
    </div>
    <Space>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
      <Button icon={<SafetyOutlined />} onClick={onQuickCheck}>
        快速检查
      </Button>
      <Button icon={<ExclamationCircleOutlined />} onClick={onFullCheck}>
        全面检查
      </Button>
      <Button icon={<WarningOutlined />} type="primary" onClick={onOpenAssess}>
        风险评估
      </Button>
    </Space>
  </div>
);
