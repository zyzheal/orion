/**
 * WorkflowTriggers Header
 * 抽取自 index.tsx (P2-9 Phase 131)
 */
import React from 'react';
import { Typography, Button, Space } from 'antd';
import { ThunderboltOutlined, ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface WorkflowTriggersHeaderProps {
  loading: boolean;
  loadTriggers: () => void;
  openCreate: () => void;
}

export const WorkflowTriggersHeader: React.FC<WorkflowTriggersHeaderProps> = ({
  loading,
  loadTriggers,
  openCreate,
}) => (
  <div
    style={{
      marginBottom: spacing.lg,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.md,
    }}
  >
    <div>
      <Title level={2} style={{ margin: 0, fontSize: 22 }}>
        <ThunderboltOutlined style={{ color: colors.primary[500], marginRight: 8 }} />
        工作流触发器
      </Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Workflow Trigger Management
      </Text>
    </div>
    <Space>
      <Button icon={<ReloadOutlined />} onClick={loadTriggers} loading={loading}>
        刷新
      </Button>
      <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
        新建触发器
      </Button>
    </Space>
  </div>
);
