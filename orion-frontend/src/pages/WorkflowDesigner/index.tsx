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
} from '@ant-design/icons';
import WorkflowList from './WorkflowList';
import WorkflowCanvas from './WorkflowCanvas';
import ExecutionHistory from './ExecutionHistory';
import { colors } from '@/tokens';

const { Title, Paragraph } = Typography;

const WorkflowDesigner: React.FC = () => {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  const tabItems = [
    {
      key: 'designer',
      label: (
        <span>
          <BranchesOutlined />
          工作流设计
        </span>
      ),
      children: (
        <div style={{ display: 'flex', gap: 16 }}>
          <Card style={{ width: 300, flexShrink: 0 }}>
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
          <HistoryOutlined />
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
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          <BranchesOutlined style={{ marginRight: 8, color: colors.purple[500] }} />
          工作流设计器
        </Title>
        <Paragraph type="secondary">可视化设计和管理工作流流程，支持审批、条件分支和自动化节点</Paragraph>
      </div>

      <Tabs defaultActiveKey="designer" items={tabItems} />
    </div>
  );
};

export default WorkflowDesigner;
