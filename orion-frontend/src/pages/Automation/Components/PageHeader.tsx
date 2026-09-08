/**
 * PageHeader.tsx - 页面标题 + 刷新按钮
 * 抽取自 index.tsx (P2-9 Phase 236)
 */
import React from 'react';
import { Button, Tooltip, Typography } from 'antd';
import { ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
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
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <ThunderboltOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        自动化作业
      </Title>
      <Text type="secondary">
        管理和执行自动化作业，支持脚本、工具调用、复合工具与 API 调用
      </Text>
    </div>
    <Tooltip title="刷新作业列表">
      <Button icon={<ReloadOutlined />} loading={loading} disabled={loading} onClick={onRefresh}>
        刷新
      </Button>
    </Tooltip>
  </div>
);
