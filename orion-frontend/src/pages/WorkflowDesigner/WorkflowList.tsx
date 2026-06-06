/**
 * 工作流列表
 */
import React, { useEffect, useState } from 'react';
import { Button, Empty, List, Tag, Space, message, Input, Select, Modal, Form } from 'antd';
import { PlusOutlined, PlayCircleOutlined, PauseCircleOutlined, SearchOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  getWorkflowList,
  suspendWorkflow,
  resumeWorkflow,
  createWorkflow,
  deleteWorkflow,
  type WorkflowDefinition,
} from '@/api/workflow';
import { colors, spacing } from '@/tokens';

const statusMap: Record<string, { color: string; text: string }> = {
  active: { color: colors.success[500], text: '已启用' },
  paused: { color: colors.warning[500], text: '已暂停' },
};

interface WorkflowListProps {
  onSelect: (id: string) => void;
}

const WorkflowList: React.FC<WorkflowListProps> = ({ onSelect }) => {
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [creating, setCreating] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    setTogglingId(id);
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
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (item: WorkflowDefinition) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除工作流 "${item.name}" 吗？此操作不可撤销。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setDeletingId(item.id);
        try {
          await deleteWorkflow(item.id);
          message.success(`工作流 "${item.name}" 已删除`);
          fetchWorkflows();
        } catch {
          message.error('删除失败');
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const handleCreate = async (values: { name: string; description?: string }) => {
    setCreating(true);
    try {
      // 创建工作流时至少需要一个开始节点
      const defaultSteps = [
        {
          id: 'start-1',
          type: 'start',
          name: '开始',
          config: {},
        },
        {
          id: 'end-1',
          type: 'end',
          name: '结束',
          config: {},
        },
      ];

      await createWorkflow({
        name: values.name,
        description: values.description,
        steps: defaultSteps,
      });
      message.success('工作流创建成功');
      setCreateModalOpen(false);
      createForm.resetFields();
      fetchWorkflows();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const filteredWorkflows = workflows.filter((w) => {
    const matchesSearch = !searchText || w.name.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? w.enabled : !w.enabled);
    return matchesSearch && matchesStatus;
  });

  if (filteredWorkflows.length === 0 && !loading) {
    return (
      <div>
        <Button type="primary" icon={<PlusOutlined />} block onClick={() => setCreateModalOpen(true)}>
          新建工作流
        </Button>
        <div style={{ marginTop: spacing.md }}>
          <Empty description="暂无工作流" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Button type="primary" icon={<PlusOutlined />} block onClick={() => setCreateModalOpen(true)}>
        新建工作流
      </Button>

      <Input
        prefix={<SearchOutlined />}
        placeholder="搜索工作流..."
        style={{ marginTop: spacing[3], marginBottom: spacing.sm }}
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
      />

      <Select
        style={{ width: '100%', marginBottom: spacing[3] }}
        value={statusFilter}
        onChange={setStatusFilter}
        options={[
          { label: '全部状态', value: 'all' },
          { label: '已启用', value: 'active' },
          { label: '已暂停', value: 'paused' },
        ]}
      />

      <List
        size="small"
        loading={loading}
        dataSource={filteredWorkflows}
        renderItem={(item) => {
          const status = statusMap[item.enabled ? 'active' : 'paused'] || statusMap.active;
          return (
            <List.Item
              key={item.id}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelect(item.id)}
              actions={[
                <Button
                  key="toggle"
                  type="text"
                  size="small"
                  icon={item.enabled ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                  loading={togglingId === item.id}
                  disabled={togglingId === item.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleStatus(item.id, !item.enabled);
                  }}
                />,
                <Button
                  key="delete"
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  loading={deletingId === item.id}
                  disabled={deletingId === item.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(item);
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

      <Modal
        title="新建工作流"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={creating}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="工作流名称" name="name" rules={[{ required: true, message: '请输入工作流名称' }]}>
            <Input placeholder="例如：代码审核流程" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} placeholder="工作流用途描述（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WorkflowList;
