/**
 * ChaosEngineering Header
 * 抽取自 index.tsx (P2-9 Phase 132)
 */
import React from 'react';
import { Typography, Button, Space } from 'antd';
import { ThunderboltOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

interface ChaosEngineeringHeaderProps {
  loading: boolean;
  error: string | null;
  loadData: () => void;
  clearError: () => void;
}

export const ChaosEngineeringHeader: React.FC<ChaosEngineeringHeaderProps> = ({
  loading,
  error,
  loadData,
  clearError,
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
        <ThunderboltOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        混沌工程
      </Title>
      <Text type="secondary">故障注入实验与系统弹性测试</Text>
    </div>
    <Space>
      {error && (
        <Button danger size="small" onClick={clearError}>
          清除错误提示
        </Button>
      )}
      <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
        刷新
      </Button>
    </Space>
  </div>
);
