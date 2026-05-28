/**
 * 审批流程配置表单
 *
 * 用于创建和编辑审批流程，包含：
 * - 流程名称、能力ID、环境、风险等级
 * - 多级审批节点配置
 * - 审批模式（串行/并行/或签）
 */
import React, { useState } from 'react';
import {
  Form,
  Input,
  Select,
  Button,
  Space,
  Card,
  Table,
  Tag,
  InputNumber,
  Collapse,
  message,
  Modal,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import {
  type ApprovalFlowConfig,
  type ApprovalLevel,
  type ApprovalMode,
  type Environment,
  type RiskLevel,
  createApprovalFlow,
  updateApprovalFlow,
} from '@/api/approval';
import { colors } from '@/tokens/colors';

const { Panel } = Collapse;

// ---- 风险等级映射 ----
const riskLevelMap: Record<RiskLevel, { label: string; color: string }> = {
  1: { label: '低风险', color: colors.primary[500] },
  2: { label: '中风险', color: colors.warning[500] },
  3: { label: '高风险', color: colors.error[400] },
  4: { label: '极高风险', color: colors.error[700] },
};

// ---- 审批模式映射 ----
const modeMap: Record<ApprovalMode, string> = {
  sequential: '串行审批',
  parallel: '并行审批',
  or_gate: '或签审批',
};

interface FlowConfigFormProps {
  flows: ApprovalFlowConfig[];
  onRefresh: () => void;
}

/**
 * 审批流程配置管理面板
 */
const FlowConfigForm: React.FC<FlowConfigFormProps> = ({ flows, onRefresh }) => {
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingFlow, setEditingFlow] = useState<ApprovalFlowConfig | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // ---- 内部审批节点状态 ----
  const [nodes, setNodes] = useState<ApprovalLevel[]>([]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      if (nodes.length === 0) {
        message.warning('请至少添加一个审批节点');
        return;
      }
      setCreateLoading(true);
      await createApprovalFlow({
        name: values.name,
        description: values.description,
        capabilityId: values.capabilityId,
        environment: values.environment,
        riskLevel: values.riskLevel,
        levels: nodes,
        mode: values.mode,
        enabled: values.enabled ?? true,
        timeoutHours: values.timeoutHours,
      });
      message.success('审批流程创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      setNodes([]);
      onRefresh();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!editingFlow) return;
    try {
      const values = await editForm.validateFields();
      setEditLoading(true);
      await updateApprovalFlow(editingFlow.id, {
        name: values.name,
        description: values.description,
        mode: values.mode,
        enabled: values.enabled,
        timeoutHours: values.timeoutHours,
      });
      message.success('审批流程更新成功');
      setEditModalVisible(false);
      setEditingFlow(null);
      onRefresh();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`更新失败: ${(error as Error).message}`);
      }
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，是否继续？',
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const { deleteApprovalFlow } = await import('@/api/approval');
          await deleteApprovalFlow(id);
          message.success('审批流程已删除');
          onRefresh();
        } catch (error: unknown) {
          message.error(`删除失败: ${(error as Error).message}`);
        }
      },
    });
  };

  const openEditModal = (flow: ApprovalFlowConfig) => {
    setEditingFlow(flow);
    editForm.setFieldsValue({
      name: flow.name,
      description: flow.description,
      mode: flow.mode,
      enabled: flow.enabled,
      timeoutHours: flow.timeoutHours,
    });
    setEditModalVisible(true);
  };

  // ---- 审批节点管理 ----
  const addNode = () => {
    setNodes([...nodes, { levelIndex: nodes.length, approverIds: [], requiredApprovals: 1 }]);
  };

  const removeNode = (index: number) => {
    setNodes(nodes.filter((_, i) => i !== index).map((n, i) => ({ ...n, levelIndex: i })));
  };

  const updateNode = (index: number, field: keyof ApprovalLevel, value: unknown) => {
    const updated = [...nodes];
    if (field === 'approverIds') {
      updated[index] = {
        ...updated[index],
        approverIds: (value as string)
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean),
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setNodes(updated);
  };

  const nodeColumns = [
    {
      title: '节点',
      dataIndex: 'levelIndex',
      width: 80,
      render: (v: number) => `第 ${v + 1} 级`,
    },
    {
      title: '审批人 (逗号分隔)',
      dataIndex: 'approverIds',
      render: (ids: string[], _r: unknown, index: number) => (
        <Input
          size="small"
          value={ids.join(', ')}
          onChange={(e) => updateNode(index, 'approverIds', e.target.value)}
          placeholder="如: tech-lead, ops-manager"
        />
      ),
    },
    {
      title: '需通过数',
      dataIndex: 'requiredApprovals',
      width: 120,
      render: (v: number, _r: unknown, index: number) => (
        <InputNumber
          size="small"
          min={1}
          max={10}
          value={v}
          onChange={(val) => updateNode(index, 'requiredApprovals', val || 1)}
        />
      ),
    },
    {
      title: '超时(小时)',
      dataIndex: 'timeout_hours',
      width: 120,
      render: (v: number | undefined, _r: unknown, index: number) => (
        <InputNumber
          size="small"
          min={1}
          value={v}
          onChange={(val) => updateNode(index, 'timeout_hours', val)}
          placeholder="可选"
        />
      ),
    },
    {
      title: '操作',
      width: 80,
      render: (_v: unknown, _r: unknown, index: number) => (
        <Button
          type="link"
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeNode(index)}
        />
      ),
    },
  ];

  // ---- 流程表格列 ----
  const columns = [
    {
      title: '流程名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (v: string, record: ApprovalFlowConfig) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>{v}</span>
          {record.description && (
            <span style={{ fontSize: 12, color: colors.neutral[500] }}>{record.description}</span>
          )}
        </Space>
      ),
    },
    {
      title: '能力ID',
      dataIndex: 'capabilityId',
      key: 'capabilityId',
      width: 140,
      ellipsis: true,
    },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      width: 80,
      render: (v: Environment) => {
        const colorMap: Record<Environment, string> = { dev: 'blue', staging: 'orange', prod: 'red' };
        const labelMap: Record<Environment, string> = { dev: '开发', staging: '预发', prod: '生产' };
        return <Tag color={colorMap[v]}>{labelMap[v]}</Tag>;
      },
    },
    {
      title: '风险等级',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      width: 100,
      render: (v: RiskLevel) => (
        <Tag color={riskLevelMap[v]?.color}>{riskLevelMap[v]?.label}</Tag>
      ),
    },
    {
      title: '审批模式',
      dataIndex: 'mode',
      key: 'mode',
      width: 120,
      render: (v: ApprovalMode) => <Tag>{modeMap[v]}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (v: boolean) => (
        <Tag color={v ? colors.success[500] : colors.neutral[400]}>
          {v ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_v: unknown, record: ApprovalFlowConfig) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 操作栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ color: colors.neutral[500], fontSize: 13 }}>
          共 {flows.length} 个审批流程
        </span>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setNodes([]);
            setCreateModalVisible(true);
          }}
        >
          新建流程
        </Button>
      </div>

      {/* 流程表格 */}
      <Table
        columns={columns}
        dataSource={flows}
        rowKey="id"
        size="middle"
        pagination={{ pageSize: 10 }}
      />

      {/* 创建弹窗 */}
      <Modal
        title="新建审批流程"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
          setNodes([]);
        }}
        onOk={handleCreate}
        confirmLoading={createLoading}
        width={720}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="流程名称"
            rules={[{ required: true, message: '请输入流程名称' }]}
          >
            <Input placeholder="如: 生产部署审批流程" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="流程说明..." />
          </Form.Item>
          <Form.Item
            name="capabilityId"
            label="能力ID"
            rules={[{ required: true, message: '请输入关联能力ID' }]}
          >
            <Input placeholder="如: deploy.production" />
          </Form.Item>
          <Form.Item
            name="environment"
            label="环境"
            rules={[{ required: true, message: '请选择环境' }]}
          >
            <Select
              options={[
                { label: '开发环境 (Dev)', value: 'dev' },
                { label: '预发环境 (Staging)', value: 'staging' },
                { label: '生产环境 (Prod)', value: 'prod' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="riskLevel"
            label="风险等级"
            rules={[{ required: true, message: '请选择风险等级' }]}
          >
            <Select
              options={[
                { label: '1 - 低风险', value: 1 },
                { label: '2 - 中风险', value: 2 },
                { label: '3 - 高风险', value: 3 },
                { label: '4 - 极高风险', value: 4 },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="mode"
            label="审批模式"
            rules={[{ required: true, message: '请选择审批模式' }]}
          >
            <Select
              options={[
                { label: '串行审批 (逐级)', value: 'sequential' },
                { label: '并行审批 (同时)', value: 'parallel' },
                { label: '或签审批 (任一人)', value: 'or_gate' },
              ]}
            />
          </Form.Item>
          <Form.Item name="timeoutHours" label="全局超时(小时)">
            <InputNumber min={1} style={{ width: '100%' }} placeholder="可选" />
          </Form.Item>
          <Form.Item name="enabled" label="启用状态" valuePropName="checked" initialValue={true}>
            <Select
              options={[
                { label: '启用', value: true },
                { label: '禁用', value: false },
              ]}
            />
          </Form.Item>

          {/* 审批节点 */}
          <Card
            size="small"
            title={
              <Space>
                <span>审批节点 ({nodes.length})</span>
                <Button type="link" size="small" icon={<PlusOutlined />} onClick={addNode}>
                  添加节点
                </Button>
              </Space>
            }
          >
            {nodes.length > 0 ? (
              <Table
                columns={nodeColumns}
                dataSource={nodes}
                rowKey="levelIndex"
                size="small"
                pagination={false}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0', color: colors.neutral[400] }}>
                暂无审批节点，请点击"添加节点"
              </div>
            )}
          </Card>
        </Form>
      </Modal>

      {/* 编辑弹窗 */}
      <Modal
        title="编辑审批流程"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingFlow(null);
        }}
        onOk={handleEdit}
        confirmLoading={editLoading}
        width={560}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="流程名称"
            rules={[{ required: true, message: '请输入流程名称' }]}
          >
            <Input placeholder="流程名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="流程说明..." />
          </Form.Item>
          <Form.Item name="mode" label="审批模式">
            <Select
              options={[
                { label: '串行审批', value: 'sequential' },
                { label: '并行审批', value: 'parallel' },
                { label: '或签审批', value: 'or_gate' },
              ]}
            />
          </Form.Item>
          <Form.Item name="timeoutHours" label="全局超时(小时)">
            <InputNumber min={1} style={{ width: '100%' }} placeholder="可选" />
          </Form.Item>
          <Form.Item name="enabled" label="启用状态" valuePropName="checked">
            <Select
              options={[
                { label: '启用', value: true },
                { label: '禁用', value: false },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FlowConfigForm;
