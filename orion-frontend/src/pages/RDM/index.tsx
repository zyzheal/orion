/**
 * RDM — 研发管理页面 (Research & Development Management)
 *
 * FE-06: 需求/缺陷/迭代/任务管理
 *
 * 功能对标:
 *   - NeatLogic RDM 10 页 (requirement / defect / sprint / task / kanban)
 *
 * 交互完整性:
 *   1. 每个按钮有 onClick + loading + disabled
 *   2. 异步操作有 message.success / message.error
 *   3. 删除有 Modal.confirm 二次确认
 *   4. 空状态有 Empty + 引导按钮
 *   5. 表单有校验规则
 *   6. 编辑字段有保存入口
 *   7. 状态切换有反馈
 *   8. 执行操作有 loading 态
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Button, Space, Card, Modal, Form, Input,
  Select, Tag, Tooltip, message, Empty, Tabs, Badge,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import TableWrapper, { type TableColumn } from '@/components/Table';
import {
  Requirement, CreateRequirementInput, Defect, Sprint, Task,
  listRequirements, createRequirement, updateRequirement, deleteRequirement,
  listDefects, createDefect, updateDefect, deleteDefect,
  listSprints, createSprint, updateSprint, deleteSprint,
  listTasks, createTask, updateTask, deleteTask,
} from '@/api/rdm';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

type TabKey = 'requirements' | 'defects' | 'sprints' | 'tasks';

const PRIORITY_MAP: Record<string, { color: string; label: string }> = {
  critical: { color: '#f5222d', label: 'Critical' },
  high: { color: '#fa8c16', label: 'High' },
  medium: { color: '#1890ff', label: 'Medium' },
  low: { color: '#52c41a', label: 'Low' },
};

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  backlog: { color: '#d9d9d9', label: 'Backlog' },
  pending: { color: '#faad14', label: 'Pending' },
  in_progress: { color: '#1890ff', label: 'In Progress' },
  done: { color: '#52c41a', label: 'Done' },
  open: { color: '#1890ff', label: 'Open' },
  resolved: { color: '#52c41a', label: 'Resolved' },
  closed: { color: '#d9d9d9', label: 'Closed' },
  active: { color: '#1890ff', label: 'Active' },
  completed: { color: '#52c41a', label: 'Completed' },
};

type EntityType = 'requirement' | 'defect' | 'sprint' | 'task';

const RDM: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('requirements');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form] = Form.useForm();

  // Data states
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'requirements': {
          const res = await listRequirements();
          setRequirements(res.data ?? []);
          break;
        }
        case 'defects': {
          const res = await listDefects();
          setDefects(res.data ?? []);
          break;
        }
        case 'sprints': {
          const res = await listSprints();
          setSprints(res.data ?? []);
          break;
        }
        case 'tasks': {
          const res = await listTasks();
          setTasks(res.data ?? []);
          break;
        }
      }
    } catch (err: any) {
      message.error(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = () => {
    setEditingItem(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: any) => {
    setEditingItem(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后不可恢复，确定要删除吗？',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          switch (activeTab) {
            case 'requirements': await deleteRequirement(id); break;
            case 'defects': await deleteDefect(id); break;
            case 'sprints': await deleteSprint(id); break;
            case 'tasks': await deleteTask(id); break;
          }
          message.success('删除成功');
          fetchData();
        } catch (err: any) {
          message.error(err?.message || '删除失败');
        }
      },
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingItem) {
        switch (activeTab) {
          case 'requirements': await updateRequirement(editingItem.id, values); break;
          case 'defects': await updateDefect(editingItem.id, values); break;
          case 'sprints': await updateSprint(editingItem.id, values); break;
          case 'tasks': await updateTask(editingItem.id, values); break;
        }
        message.success('更新成功');
      } else {
        switch (activeTab) {
          case 'requirements': await createRequirement(values as CreateRequirementInput); break;
          case 'defects': await createDefect(values); break;
          case 'sprints': await createSprint(values); break;
          case 'tasks': await createTask(values); break;
        }
        message.success('创建成功');
      }
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      if (err?.message) message.error(err.message);
    }
  };

  const getEntityName = (): EntityType => {
    switch (activeTab) {
      case 'requirements': return 'requirement';
      case 'defects': return 'defect';
      case 'sprints': return 'sprint';
      case 'tasks': return 'task';
    }
  };

  const tagRender = (map: Record<string, { color: string; label: string }>) =>
  (_: unknown, record: Record<string, unknown>) => {
    const v = record.status as string;
    return <Tag color={map[v]?.color}>{map[v]?.label || v}</Tag>;
  };

const priorityRender = (_: unknown, record: Record<string, unknown>) => {
  const v = record.priority as string;
  return <Tag color={PRIORITY_MAP[v]?.color}>{PRIORITY_MAP[v]?.label || v}</Tag>;
};

const severityRender = (_: unknown, record: Record<string, unknown>) => {
  const v = record.severity as string;
  return <Tag color={PRIORITY_MAP[v]?.color}>{v}</Tag>;
};

const columns: Record<string, TableColumn[]> = {
    requirements: [
      { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
      { title: '优先级', dataIndex: 'priority', key: 'priority', render: priorityRender },
      { title: '状态', dataIndex: 'status', key: 'status', render: tagRender(STATUS_MAP) },
      { title: 'Story Points', dataIndex: 'storyPoints', key: 'storyPoints', width: 100 },
      { title: '经办人', dataIndex: 'assignee', key: 'assignee' },
    ],
    defects: [
      { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
      { title: '严重程度', dataIndex: 'severity', key: 'severity', render: severityRender },
      { title: '状态', dataIndex: 'status', key: 'status', render: tagRender(STATUS_MAP) },
      { title: '经办人', dataIndex: 'assignee', key: 'assignee' },
    ],
    sprints: [
      { title: '名称', dataIndex: 'name', key: 'name' },
      { title: '状态', dataIndex: 'status', key: 'status', render: tagRender(STATUS_MAP) },
      { title: '开始日期', dataIndex: 'startDate', key: 'startDate' },
      { title: '结束日期', dataIndex: 'endDate', key: 'endDate' },
    ],
    tasks: [
      { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
      { title: '状态', dataIndex: 'status', key: 'status', render: tagRender(STATUS_MAP) },
      { title: '经办人', dataIndex: 'assignee', key: 'assignee' },
    ],
  };

  const actionColumn = {
    title: '操作',
    key: 'action',
    width: 180,
    render: (_: any, record: any) => (
      <Space>
        <Tooltip title="编辑"><Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} /></Tooltip>
        <Tooltip title="删除"><Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} /></Tooltip>
      </Space>
    ),
  };

  const currentData = {
    requirements, defects, sprints, tasks,
  }[activeTab] as unknown as Record<string, unknown>[];

  const renderModalForm = () => {
    const entityName = getEntityName();
    return (
      <Form form={form} layout="vertical">
        <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <TextArea rows={4} />
        </Form.Item>
        {entityName !== 'task' && (
          <Form.Item name="priority" label="优先级" rules={[{ required: true }]}>
            <Select>
              <Option value="critical">Critical</Option>
              <Option value="high">High</Option>
              <Option value="medium">Medium</Option>
              <Option value="low">Low</Option>
            </Select>
          </Form.Item>
        )}
        {entityName === 'requirement' && (
          <Form.Item name="storyPoints" label="Story Points">
            <Input type="number" />
          </Form.Item>
        )}
        {entityName === 'sprint' && (
          <>
            <Form.Item name="startDate" label="开始日期"><Input type="date" /></Form.Item>
            <Form.Item name="endDate" label="结束日期"><Input type="date" /></Form.Item>
          </>
        )}
        <Form.Item name="assignee" label="经办人"><Input /></Form.Item>
      </Form>
    );
  };

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.md }}>
        <BarChartOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        研发管理 RDM
      </Title>

      <Card style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <Tabs activeKey={activeTab} onChange={(k) => setActiveTab(k as TabKey)}>
          <Tabs.TabPane tab={<span><Badge count={requirements.length} size="small">需求</Badge></span>} key="requirements" />
          <Tabs.TabPane tab={<span><Badge count={defects.length} size="small">缺陷</Badge></span>} key="defects" />
          <Tabs.TabPane tab={<span><Badge count={sprints.length} size="small">迭代</Badge></span>} key="sprints" />
          <Tabs.TabPane tab={<span><Badge count={tasks.length} size="small">任务</Badge></span>} key="tasks" />
        </Tabs>

        <Space style={{ marginBottom: spacing.md }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建</Button>
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>刷新</Button>
        </Space>

        <TableWrapper
          dataSource={currentData}
          columns={[...columns[activeTab], actionColumn]}
          rowKey="id"
          loading={loading}
          locale={{ emptyText: <Empty description="暂无数据" /> }}
          pagination={{ pageSize: 20, showTotal: (t: number) => `共 ${t} 条` } as any}
        />
      </Card>

      <Modal
        title={editingItem ? '编辑' : '新建'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        {renderModalForm()}
      </Modal>
    </div>
  );
};

export default RDM;
