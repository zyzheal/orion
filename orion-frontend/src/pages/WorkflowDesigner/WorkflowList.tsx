/**
 * 工作流列表
 */
import React, { useEffect, useState } from 'react';
import { Button, Empty, List, Tag, Space, message } from 'antd';
import { PlusOutlined, PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { getWorkflowList, suspendWorkflow, resumeWorkflow, WorkflowDefinition } from '@/api/workflow';
import { colors } from '@/tokens';

interface WorkflowListProps {
  onSelect: (id: string) => void;
}

const statusMap: Record<string, { color: string; text: string }> = {
  active: { color: colors.success[500], text: '已启用' },
  paused: { color: colors.warning[500], text: '已暂停' },
  completed: { color: colors.neutral[500], text: '已完成' },
  failed: { color: colors.error[500], text: '失败' },
};

const WorkflowList: React.FC<WorkflowListProps> = ({ onSelect }) => {
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const data = await getWorkflowList();
      setWorkflows(data);
    } catch {
      message.error('获取工作流列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handleToggleStatus = async (id: string, enabled: boolean) => {
    try {
      if (enabled) {
        await resumeWorkflow(id);
      } else {
        await suspendWorkflow(id);
      }
      message.success('操作成功');
      fetchWorkflows();
    } catch {
      message.error('操作失败');
    }
  };

  if (workflows.length === 0 && !loading) {
    return (
      <Empty
        description="暂无工作流"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      >
        <Button type="primary" icon={<PlusOutlined />}>
          新建工作流
        </Button>
      </Empty>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} block>
          新建工作流
        </Button>
      </div>
      <List
        size="small"
        loading={loading}
        dataSource={workflows}
        renderItem={(item) => {
          const status = statusMap[item.enabled ? 'active' : 'paused'] || statusMap.active;
          return (
            <List.Item
              style={{ cursor: 'pointer' }}
              onClick={() => onSelect(item.id)}
              actions={[
                <Button
                  key="toggle"
                  type="text"
                  size="small"
                  icon={item.enabled ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleStatus(item.id, !item.enabled);
                  }}
                />,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    {item.name}
                    <Tag color={status.color}>{status.text}</Tag>
                  </Space>
                }
                description={`v${item.version} · ${item.description || '无描述'}`}
              />
            </List.Item>
          );
        }}
      />
    </div>
  );
};

export default WorkflowList;
