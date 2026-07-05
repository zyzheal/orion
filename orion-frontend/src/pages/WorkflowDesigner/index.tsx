/**
 * 工作流设计器入口
 *
 * 工作流列表 + 画布编辑器 + 执行历史
 */
import React, { useState } from 'react';
import { Card, Typography, Tabs } from 'antd';
import {
  BranchesOutlined,
  HistoryOutlined,
  DragOutlined,
} from '@ant-design/icons';
import WorkflowList from './WorkflowList';
import WorkflowCanvas from './WorkflowCanvas';
import ExecutionHistory from './ExecutionHistory';
import { colors, spacing } from '@/tokens';

const { Title, Paragraph } = Typography;

const WorkflowDesigner: React.FC = () => {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  const tabItems = [
    {
      key: 'designer',
      label: (
        <span>
          <BranchesOutlined style={{ marginRight: spacing.sm }} />
          工作流设计
        </span>
      ),
      children: (
        <div style={{ display: 'flex', gap: spacing.md, height: 600 }}>
          <Card style={{ width: 300, flexShrink: 0, overflow: 'auto' }}>
            <WorkflowList onSelect={(id) => setSelectedWorkflowId(id)} />
          </Card>
          <Card style={{ flex: 1 }} styles={{ body: { padding: 0 } }}>
            <WorkflowCanvas workflowId={selectedWorkflowId} />
          </Card>
        </div>
      ),
    },
    {
      key: 'history',
      label: (
        <span>
          <HistoryOutlined style={{ marginRight: spacing.sm }} />
          执行历史
        </span>
      ),
      children: (
        <Card>
          <ExecutionHistory workflowId={selectedWorkflowId} />
        </Card>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ marginBottom: spacing.lg }}>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <DragOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          工作流设计器
        </Title>
        <Paragraph type="secondary">可视化设计和管理工作流流程，支持审批、条件分支和自动化节点</Paragraph>
      </div>

      <Tabs defaultActiveKey="designer" items={tabItems} />
    </div>
  );
};

export default WorkflowDesigner;
