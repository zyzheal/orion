/**
 * Session Header
 * 抽取自 index.tsx (P2-9 Phase 130)
 */
import React from 'react';
import { Typography, Button, Space } from 'antd';
import { ClockCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';

const { Title, Text } = Typography;

interface SessionHeaderProps {
  loading: boolean;
  loadData: () => void;
}

export const SessionHeader: React.FC<SessionHeaderProps> = ({ loading, loadData }) => (
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
        <ClockCircleOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        Session Management
      </Title>
      <Text type="secondary">用户会话管理</Text>
    </div>
    <Space>
      <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
        刷新
      </Button>
    </Space>
  </div>
);
