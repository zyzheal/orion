/**
 * PageHeader.tsx - 页面标题 + 刷新/清除错误
 * 抽取自 index.tsx (P2-9 Phase 232)
 */
import React from 'react';
import { Button, Space, Typography } from 'antd';
import { ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

interface Props {
  loading: boolean;
  error: string | null;
  setError: (v: string | null) => void;
  onRefresh: () => void;
}

export const PageHeader: React.FC<Props> = ({ loading, error, setError, onRefresh }) => (
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
        <Button danger size="small" onClick={() => setError(null)}>
          清除错误提示
        </Button>
      )}
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
    </Space>
  </div>
);
