/**
 * 工作流画布
 *
 * 可视化节点展示、SVG 连线、节点详情
 */
import React, { useEffect, useState } from 'react';
import { Button, Empty, Space, Tag, Typography, message, Drawer, Descriptions, Divider, Input, Form, Modal, Select, Table } from 'antd';
import {
  PlayCircleOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  DeleteOutlined,
  EditOutlined,
  CopyOutlined,
  PlusOutlined,
  MinusOutlined,
  ArrowRightOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import {
  getWorkflow,
  executeWorkflow,
  deleteWorkflow,
  updateWorkflow,
  type WorkflowDefinition,
  type WorkflowNode,
  type WorkflowEdge,
} from '@/api/workflow';
import { colors } from '@/tokens';

const { Text } = Typography;

/**
 * 输入变量映射：上游节点变量 -> 当前节点本地变量
 */
interface InputVariableMapping {
  sourceNode: string;
  sourceVar: string;
  localVar: string;
}

/**
 * 输出变量定义
 */
interface OutputVariable {
  name: string;
  description: string;
}

interface WorkflowCanvasProps {
  workflowId: string | null;
}

const nodeTypeColors: Record<string, string> = {
  start: colors.success[500],
  approval: colors.purple[500],
  condition: colors.warning[500],
  notification: colors.info[500],
  webhook: colors.primary[500],
  task: colors.primary[600],
  'sub-workflow': '#722ED1',
  delay: '#13C2C2',
  timer: '#EB2F96',
  end: colors.neutral[500],
};

const nodeTypeLabels: Record<string, string> = {
  start: '开始节点',
  approval: '审批节点',
  condition: '条件分支',
  notification: '通知节点',
  webhook: 'Webhook',
  task: '人工任务',
  'sub-workflow': '子流程',
  delay: '延迟节点',
  timer: '定时器',
  end: '结束节点',
};

const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({ workflowId }) => {
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm] = Form.useForm();
  const [originalConfig, setOriginalConfig] = useState<Record<string, unknown> | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  /** 输入变量映射列表（存储在 node.config.inputVariableMapping） */
  const [inputMappings, setInputMappings] = useState<InputVariableMapping[]>([]);
  /** 输出变量列表（存储在 node.config.outputVariables） */
  const [outputVariables, setOutputVariables] = useState<OutputVariable[]>([]);
  /** 新增输入映射的临时状态 */
  const [newMappingSourceNode, setNewMappingSourceNode] = useState<string>('');
  const [newMappingSourceVar, setNewMappingSourceVar] = useState<string>('');
  const [newMappingLocalVar, setNewMappingLocalVar] = useState<string>('');
  /** 新增输出变量的临时状态 */
  const [newOutputName, setNewOutputName] = useState<string>('');
  const [newOutputDesc, setNewOutputDesc] = useState<string>('');
  /** 错误处理策略联动：响应式监听 onFailure 变化 */
  const errorHandlingOnFailure = Form.useWatch(['errorHandling', 'onFailure'], editForm);

  // ==================== 连线编辑状态 ====================
  /** 当前选中的连线 */
  const [selectedEdge, setSelectedEdge] = useState<WorkflowEdge | null>(null);
  /** 连线编辑 Modal 开关 */
  const [edgeModalOpen, setEdgeModalOpen] = useState(false);
  /** 正在编辑的连线数据 */
  const [editingEdge, setEditingEdge] = useState<WorkflowEdge | null>(null);
  const [edgeForm] = Form.useForm();
  /** 连线 Hover 状态 */
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  /** 添加连线 Modal 开关 */
  const [addEdgeModalOpen, setAddEdgeModalOpen] = useState(false);
  const [addEdgeForm] = Form.useForm();

  useEffect(() => {
    if (!workflowId) {
      setWorkflow(null);
      setSelectedNode(null);
      return;
    }
    setLoading(true);
    getWorkflow(workflowId)
      .then((data) => {
        setWorkflow(data);
        setSelectedNode(null);
      })
      .catch(() => message.error('获取工作流失败'))
      .finally(() => setLoading(false));
  }, [workflowId]);

  const handleExecute = async () => {
    if (!workflowId) return;
    setExecuting(true);
    try {
      await executeWorkflow(workflowId, { triggeredBy: 'user' });
      message.success('工作流已触发执行');
    } catch {
      message.error('执行失败');
    } finally {
      setExecuting(false);
    }
  };

  const handleDelete = async () => {
    if (!workflowId || !workflow) return;
    Modal.confirm({
      title: '确认删除',
      content: `确定删除工作流 "${workflow.name}" 吗？此操作不可撤销。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setDeleting(true);
        try {
          await deleteWorkflow(workflowId);
          message.success(`工作流 "${workflow.name}" 已删除`);
          setWorkflow(null);
        } catch {
          message.error('删除失败');
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  const handleNodeClick = (node: WorkflowNode) => {
    setSelectedNode(node);
    setOriginalConfig({ ...node.config });
    editForm.setFieldsValue({
      name: node.name,
      ...node.config,
    });
    setEditMode(false);
    setDrawerOpen(true);
  };

  const handleEditToggle = () => {
    if (editMode) {
      // 切换回查看模式，恢复原始值
      if (selectedNode && originalConfig) {
        editForm.setFieldsValue({
          name: selectedNode.name,
          ...originalConfig,
        });
      }
      setEditMode(false);
    } else {
      setEditMode(true);
    }
  };

  const handleSaveNode = async () => {
    if (!workflowId || !selectedNode || !workflow) return;
    try {
      const values = await editForm.validateFields();
      const { name, ...config } = values;
      const updatedNodes = workflow.nodes.map((node) =>
        node.id === selectedNode.id ? { ...node, name, config } : node
      );
      await updateWorkflow(workflowId, { nodes: updatedNodes });
      message.success('节点配置已保存');
      // 更新本地状态
      const updatedNode = { ...selectedNode, name, config };
      setSelectedNode(updatedNode);
      setWorkflow({ ...workflow, nodes: updatedNodes });
      setEditMode(false);
      setOriginalConfig({ ...config });
    } catch (error) {
      if ((error as any)?.errorFields) {
        message.error('请检查表单填写');
      } else {
        message.error('保存失败');
      }
    }
  };

  const handleCancelEdit = () => {
    if (selectedNode && originalConfig) {
      editForm.setFieldsValue({
        name: selectedNode.name,
        ...originalConfig,
      });
    }
    setEditMode(false);
  };

  /**
   * 判断节点是否已配置（config 有至少一个非空字段）
   */
  const isNodeConfigured = (node: WorkflowNode): boolean => {
    if (!node.config || Object.keys(node.config).length === 0) return false;
    return Object.values(node.config).some((v) => v !== null && v !== undefined && v !== '');
  };

  /**
   * 获取节点配置预览文本（前 2 行关键配置摘要）
   */
  const getNodeConfigPreview = (node: WorkflowNode): string => {
    const c = node.config || {};
    switch (node.type) {
      case 'approval':
        const approvers = c.approvers || c.assignee;
        const mode = c.mode === 'or' ? '或签' : c.mode === 'and' ? '会签' : '';
        return [approvers ? `审批人：${typeof approvers === 'string' ? approvers : String(approvers)}` : '', mode ? `模式：${mode}` : ''].filter(Boolean).join(' · ') || '未配置';
      case 'notification':
        const channel = c.channel ? { dingtalk: '钉钉', wecom: '企微', feishu: '飞书', email: '邮件', sms: '短信' }[c.channel as string] || c.channel : '';
        return channel ? `渠道：${channel}` : '未配置';
      case 'webhook':
        const url = c.url || '';
        const method = c.method || '';
        return `${method} ${url}`.trim() || '未配置';
      case 'condition':
        return c.expression ? `表达式：${String(c.expression).slice(0, 30)}${String(c.expression).length > 30 ? '...' : ''}` : '未配置';
      case 'task':
        return c.title ? `${c.title} · ${c.assignee || '未分配'}` : '未配置';
      case 'delay':
        return c.duration ? `延迟 ${c.duration} 秒` : '未配置';
      case 'timer':
        return c.cron ? `Cron：${c.cron}` : '未配置';
      case 'sub-workflow':
        return c.subWorkflowId ? `子流程：${c.subWorkflowId}` : '未配置';
      default:
        return Object.keys(c).length > 0 ? '已配置' : '未配置';
    }
  };

  /**
   * 删除当前选中的节点（含关联边清理）
   */
  const handleDeleteNode = async () => {
    if (!workflowId || !selectedNode || !workflow) return;
    Modal.confirm({
      title: '确认删除',
      content: `确定删除节点 "${selectedNode.name}" 吗？关联的上下游连线将被清除。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          const updatedNodes = workflow.nodes.filter((n) => n.id !== selectedNode.id);
          const updatedEdges = workflow.edges.filter(
            (e) => e.source !== selectedNode.id && e.target !== selectedNode.id
          );
          await updateWorkflow(workflowId, { nodes: updatedNodes, edges: updatedEdges });
          message.success('节点已删除');
          setWorkflow({ ...workflow, nodes: updatedNodes, edges: updatedEdges });
          setDrawerOpen(false);
          setEditMode(false);
          setSelectedNode(null);
        } catch {
          message.error('删除节点失败');
        }
      },
    });
  };

  /**
   * 复制节点
   */
  const handleDuplicateNode = async (node: WorkflowNode) => {
    if (!workflowId || !workflow) return;
    try {
      const newNode = {
        ...node,
        id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: `${node.name} (副本)`,
        position: { x: node.position.x + 40, y: node.position.y + 40 },
        config: { ...node.config },
      };
      const updatedNodes = [...workflow.nodes, newNode];
      await updateWorkflow(workflowId, { nodes: updatedNodes });
      message.success('节点已复制');
      setWorkflow({ ...workflow, nodes: updatedNodes });
    } catch {
      message.error('复制节点失败');
    }
  };

  // ==================== 连线编辑 Handlers ====================

  /**
   * 点击连线，打开编辑 Modal
   */
  const handleEdgeClick = (edge: WorkflowEdge) => {
    setSelectedEdge(edge);
    setEditingEdge({ ...edge });
    edgeForm.setFieldsValue({
      condition: edge.condition || '',
    });
    setEdgeModalOpen(true);
  };

  /**
   * 保存连线编辑
   */
  const handleSaveEdge = async () => {
    if (!workflowId || !editingEdge || !workflow) return;
    try {
      const values = await edgeForm.validateFields();
      const updatedEdges = workflow.edges.map((e) =>
        e.id === editingEdge.id
          ? { ...e, condition: values.condition || '' }
          : e
      );
      await updateWorkflow(workflowId, { edges: updatedEdges });
      message.success('连线已更新');
      setWorkflow({ ...workflow, edges: updatedEdges });
      setEdgeModalOpen(false);
      setSelectedEdge(null);
      setEditingEdge(null);
    } catch (error) {
      if ((error as any)?.errorFields) {
        message.error('请检查表单填写');
      } else {
        message.error('保存连线失败');
      }
    }
  };

  /**
   * 删除连线
   */
  const handleDeleteEdge = async () => {
    if (!workflowId || !editingEdge || !workflow) return;
    Modal.confirm({
      title: '确认删除连线',
      content: '确定删除此连线吗？',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          const updatedEdges = workflow.edges.filter((e) => e.id !== editingEdge.id);
          await updateWorkflow(workflowId, { edges: updatedEdges });
          message.success('连线已删除');
          setWorkflow({ ...workflow, edges: updatedEdges });
          setEdgeModalOpen(false);
          setSelectedEdge(null);
          setEditingEdge(null);
        } catch {
          message.error('删除连线失败');
        }
      },
    });
  };

  /**
   * 打开添加连线 Modal
   */
  const handleOpenAddEdge = () => {
    if (!workflow?.nodes?.length) {
      message.warning('请先添加节点');
      return;
    }
    addEdgeForm.resetFields();
    setAddEdgeModalOpen(true);
  };

  /**
   * 创建新连线
   */
  const handleAddEdge = async () => {
    if (!workflowId || !workflow) return;
    try {
      const values = await addEdgeForm.validateFields();
      const newEdge: WorkflowEdge = {
        id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        source: values.source,
        target: values.target,
        condition: values.condition || '',
      };
      const updatedEdges = [...(workflow.edges || []), newEdge];
      await updateWorkflow(workflowId, { edges: updatedEdges });
      message.success('连线已添加');
      setWorkflow({ ...workflow, edges: updatedEdges });
      setAddEdgeModalOpen(false);
    } catch (error) {
      if ((error as any)?.errorFields) {
        message.error('请检查表单填写');
      } else {
        message.error('添加连线失败');
      }
    }
  };

  /**
   * JSON 输入实时校验：在 onBlur 时校验 JSON 格式
   */
  const validateJsonOnBlur = (fieldName: string) => {
    return () => {
      const value = editForm.getFieldValue(fieldName);
      if (value && typeof value === 'string' && value.trim()) {
        try {
          JSON.parse(value);
        } catch {
          message.error(`${fieldName} JSON 格式不正确`);
        }
      }
    };
  };

  /**
   * 根据节点类型渲染对应的表单字段
   */
  const renderNodeForm = (node: WorkflowNode, editable: boolean) => {
    const config = node.config;
    switch (node.type) {
      case 'start':
        return (
          <>
            <Form.Item
              label="触发方式"
              name="triggerType"
              rules={[{ required: true, message: '请选择触发方式' }]}
            >
              <Select placeholder="请选择触发方式" disabled={!editable}>
                <Select.Option value="manual">手动触发</Select.Option>
                <Select.Option value="event">事件触发</Select.Option>
                <Select.Option value="schedule">定时触发</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="初始变量" name="initialVariables">
              <Input.TextArea
                rows={4}
                placeholder='{"key": "value"}，JSON 格式'
                disabled={!editable}
                onBlur={validateJsonOnBlur('initialVariables')}
              />
            </Form.Item>
          </>
        );
      case 'end':
        return (
          <>
            <Form.Item label="输出变量" name="outputVariables">
              <Input.TextArea
                rows={4}
                placeholder='{"key": "value"}，JSON 格式'
                disabled={!editable}
                onBlur={validateJsonOnBlur('outputVariables')}
              />
            </Form.Item>
          </>
        );
      case 'approval':
        return (
          <>
            <Form.Item
              label="审批人"
              name="approvers"
              rules={[{ required: true, message: '请输入审批人列表' }]}
            >
              <Input placeholder="请输入审批人（逗号分隔）" disabled={!editable} />
            </Form.Item>
            <Form.Item label="审批模式" name="mode" rules={[{ required: true, message: '请选择审批模式' }]}>
              <Select disabled={!editable}>
                <Select.Option value="or">或签</Select.Option>
                <Select.Option value="and">会签</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="超时策略" name="timeoutPolicy">
              <Select placeholder="请选择超时策略" disabled={!editable} allowClear>
                <Select.Option value="skip">跳过</Select.Option>
                <Select.Option value="escalate">升级</Select.Option>
                <Select.Option value="auto_approve">自动通过</Select.Option>
              </Select>
            </Form.Item>
          </>
        );
      case 'notification':
        return (
          <>
            <Form.Item
              label="通知渠道"
              name="channel"
              rules={[{ required: true, message: '请选择通知渠道' }]}
            >
              <Select placeholder="请选择通知渠道" disabled={!editable}>
                <Select.Option value="dingtalk">钉钉</Select.Option>
                <Select.Option value="wecom">企业微信</Select.Option>
                <Select.Option value="feishu">飞书</Select.Option>
                <Select.Option value="email">邮件</Select.Option>
                <Select.Option value="sms">短信</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              label="收件人"
              name="recipients"
              rules={[{ required: true, message: '请输入收件人' }]}
            >
              <Input placeholder="请输入收件人（逗号分隔）" disabled={!editable} />
            </Form.Item>
            <Form.Item label="消息模板" name="template">
              <Input.TextArea rows={3} placeholder="消息内容，支持 {variable} 变量" disabled={!editable} />
            </Form.Item>
          </>
        );
      case 'webhook':
        return (
          <>
            <Form.Item
              label="URL"
              name="url"
              rules={[{ required: true, message: '请输入 Webhook URL' }, { type: 'url', message: '请输入有效的URL' }]}
            >
              <Input placeholder="https://example.com/webhook" disabled={!editable} />
            </Form.Item>
            <Form.Item
              label="HTTP Method"
              name="method"
              rules={[{ required: true, message: '请选择 HTTP Method' }]}
            >
              <Select disabled={!editable}>
                <Select.Option value="GET">GET</Select.Option>
                <Select.Option value="POST">POST</Select.Option>
                <Select.Option value="PUT">PUT</Select.Option>
                <Select.Option value="DELETE">DELETE</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="Headers" name="headers">
              <Input.TextArea
                rows={2}
                placeholder='{"Content-Type": "application/json"}'
                disabled={!editable}
                onBlur={validateJsonOnBlur('headers')}
              />
            </Form.Item>
            <Form.Item label="Request Body" name="body">
              <Input.TextArea
                rows={4}
                placeholder="请求体，支持 JSON"
                disabled={!editable}
                onBlur={validateJsonOnBlur('body')}
              />
            </Form.Item>
          </>
        );
      case 'condition':
        return (
          <>
            <Form.Item
              label="条件表达式"
              name="expression"
              rules={[{ required: true, message: '请输入条件表达式' }]}
            >
              <Input.TextArea rows={3} placeholder="例如：${amount} > 1000" disabled={!editable} />
            </Form.Item>
            <Form.Item label="True 分支" name="trueBranch">
              <Input placeholder="条件为真时执行的节点" disabled={!editable} />
            </Form.Item>
            <Form.Item label="False 分支" name="falseBranch">
              <Input placeholder="条件为假时执行的节点" disabled={!editable} />
            </Form.Item>
          </>
        );
      case 'task':
        return (
          <>
            <Form.Item
              label="任务标题"
              name="title"
              rules={[{ required: true, message: '请输入任务标题' }]}
            >
              <Input placeholder="请输入任务标题" disabled={!editable} />
            </Form.Item>
            <Form.Item
              label="处理人"
              name="assignee"
              rules={[{ required: true, message: '请输入处理人' }]}
            >
              <Input placeholder="请输入处理人" disabled={!editable} />
            </Form.Item>
            <Form.Item label="优先级" name="priority">
              <Select placeholder="请选择优先级" disabled={!editable}>
                <Select.Option value="low">低</Select.Option>
                <Select.Option value="normal">普通</Select.Option>
                <Select.Option value="high">高</Select.Option>
                <Select.Option value="urgent">紧急</Select.Option>
              </Select>
            </Form.Item>
          </>
        );
      case 'delay':
        return (
          <>
            <Form.Item
              label="延迟时长"
              name="duration"
              rules={[
                { required: true, message: '请输入延迟时长' },
                {
                  validator: (_rule: any, value: any) => {
                    if (value === undefined || value === null || value === '') {
                      return Promise.resolve();
                    }
                    const num = Number(value);
                    if (!Number.isInteger(num) || num <= 0) {
                      return Promise.reject(new Error('延迟时长必须为正整数'));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <Input type="number" placeholder="例如：30" disabled={!editable} addonAfter="秒" />
            </Form.Item>
          </>
        );
      case 'timer':
        return (
          <>
            <Form.Item
              label="Cron 表达式"
              name="cron"
              rules={[{ required: true, message: '请输入 Cron 表达式' }]}
            >
              <Input placeholder="例如：0 */6 * * *" disabled={!editable} />
            </Form.Item>
          </>
        );
      case 'sub-workflow':
        return (
          <>
            <Form.Item label="子流程 ID" name="subWorkflowId" rules={[{ required: true, message: '请输入子流程 ID' }]}>
              <Input placeholder="请输入子流程 ID" disabled={!editable} />
            </Form.Item>
          </>
        );
      default:
        // 通用配置展示
        return Object.entries(config).map(([key, value]) => (
          <Form.Item key={key} label={key} name={key}>
            <Input
              defaultValue={typeof value === 'object' ? JSON.stringify(value) : String(value)}
              disabled={!editable}
            />
          </Form.Item>
        ));
    }
  };

  /**
   * 渲染错误处理策略配置表单
   *
   * 在所有节点类型配置之后调用，提供统一的错误处理配置。
   * 根据 onFailure 选择动态显示/隐藏相关字段（通过 Form.useWatch 响应式联动）。
   */
  const renderErrorHandlingForm = (editable: boolean) => {
    return (
      <>
        <Divider orientation="left" style={{ margin: '12px 0' }}>错误处理策略</Divider>
        <Form.Item
          label="失败后行为"
          name={['errorHandling', 'onFailure']}
          rules={[{ required: true, message: '请选择失败后行为' }]}
        >
          <Select placeholder="请选择失败后行为" disabled={!editable}>
            <Select.Option value="retry">重试（最多 3 次）</Select.Option>
            <Select.Option value="skip">跳过并继续</Select.Option>
            <Select.Option value="terminate">终止工作流</Select.Option>
            <Select.Option value="escalate">转人工处理</Select.Option>
          </Select>
        </Form.Item>

        {/* 重试次数 - 仅当选择 retry 时显示 */}
        {errorHandlingOnFailure === 'retry' && (
          <Form.Item
            label="重试次数"
            name={['errorHandling', 'retryCount']}
            rules={[
              { required: true, message: '请输入重试次数' },
              {
                validator: (_rule: unknown, value: unknown) => {
                  if (value === undefined || value === null || value === '') {
                    return Promise.resolve();
                  }
                  const num = Number(value);
                  if (!Number.isInteger(num) || num <= 0 || num > 3) {
                    return Promise.reject(new Error('重试次数必须为 1-3 之间的整数'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input
              type="number"
              placeholder="默认 3"
              disabled={!editable}
              addonAfter="次"
            />
          </Form.Item>
        )}

        {/* 重试间隔 - 仅当选择 retry 时显示 */}
        {errorHandlingOnFailure === 'retry' && (
          <Form.Item
            label="重试间隔"
            name={['errorHandling', 'retryInterval']}
            rules={[
              { required: true, message: '请输入重试间隔' },
              {
                validator: (_rule: unknown, value: unknown) => {
                  if (value === undefined || value === null || value === '') {
                    return Promise.resolve();
                  }
                  const num = Number(value);
                  if (!Number.isInteger(num) || num <= 0) {
                    return Promise.reject(new Error('重试间隔必须为正整数'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input
              type="number"
              placeholder="默认 30"
              disabled={!editable}
              addonAfter="秒"
            />
          </Form.Item>
        )}

        {/* 升级目标 - 仅当选择 escalate 时显示 */}
        {errorHandlingOnFailure === 'escalate' && (
          <Form.Item
            label="升级目标"
            name={['errorHandling', 'escalateTarget']}
            rules={[{ required: true, message: '请输入升级目标' }]}
          >
            <Input placeholder="请输入升级目标（人员或群组）" disabled={!editable} />
          </Form.Item>
        )}
      </>
    );
  };

  const calculateCanvasSize = () => {
    if (!workflow?.nodes?.length) return { width: 600, height: 400 };
    const nodes = workflow.nodes;
    const maxX = Math.max(...nodes.map((n) => n.position.x)) + 200;
    const maxY = Math.max(...nodes.map((n) => n.position.y)) + 120;
    return { width: Math.max(600, maxX), height: Math.max(400, maxY) };
  };

  if (!workflowId) {
    return (
      <div style={{ padding: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Empty description="请先从左侧选择一个工作流" />
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: 48, textAlign: 'center' }}>加载中...</div>;
  }

  if (!workflow) {
    return (
      <div style={{ padding: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Empty description="工作流不存在" />
      </div>
    );
  }

  const canvasSize = calculateCanvasSize();

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${colors.neutral[200]}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space>
          <Text strong>{workflow.name}</Text>
          <Tag>v{workflow.version}</Tag>
          {workflow.enabled ? (
            <Tag color={colors.success[500]}>已启用</Tag>
          ) : (
            <Tag color={colors.warning[500]}>已暂停</Tag>
          )}
        </Space>
        <Space>
          <Button
            icon={<ZoomOutOutlined />}
            size="small"
            onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}
          />
          <Text style={{ fontSize: 12 }}>{Math.round(zoom * 100)}%</Text>
          <Button
            icon={<ZoomInOutlined />}
            size="small"
            onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
          />
          <Button
            size="small"
            icon={<ArrowRightOutlined />}
            onClick={handleOpenAddEdge}
            title="添加连线"
          >
            添加连线
          </Button>
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={handleDelete}
            loading={deleting}
            disabled={deleting}
          >
            删除
          </Button>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            size="small"
            onClick={handleExecute}
            loading={executing}
            disabled={executing}
          >
            执行
          </Button>
        </Space>
      </div>

      {/* Canvas area */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          background: colors.light.bg.secondary,
          position: 'relative',
        }}
      >
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            width: canvasSize.width,
            minHeight: canvasSize.height,
            position: 'relative',
          }}
        >
          {/* SVG edges */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          >
            {workflow.edges?.map((edge) => {
              const sourceNode = workflow.nodes?.find((n) => n.id === edge.source);
              const targetNode = workflow.nodes?.find((n) => n.id === edge.target);
              if (!sourceNode || !targetNode) return null;

              const startX = sourceNode.position.x + 180;
              const startY = sourceNode.position.y + 40;
              const endX = targetNode.position.x;
              const endY = targetNode.position.y + 40;

              const cp1x = startX + 50;
              const cp1y = startY;
              const cp2x = endX - 50;
              const cp2y = endY;

              const isEdgeHovered = hoveredEdgeId === edge.id;
              const isEdgeSelected = selectedEdge?.id === edge.id;
              const edgePath = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;

              return (
                <g
                  key={edge.id}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdgeClick(edge);
                  }}
                  onMouseEnter={() => setHoveredEdgeId(edge.id)}
                  onMouseLeave={() => setHoveredEdgeId(null)}
                >
                  {/* 隐形加宽路径用于扩大点击区域 */}
                  <path
                    d={edgePath}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={16}
                  />
                  {/* 可见连线 */}
                  <path
                    d={edgePath}
                    fill="none"
                    stroke={isEdgeSelected ? colors.primary[500] : isEdgeHovered ? colors.primary[400] : colors.neutral[400]}
                    strokeWidth={isEdgeHovered || isEdgeSelected ? 3 : 2}
                    markerEnd="url(#arrowhead)"
                  />
                  {/* 连线条件标签 */}
                  {edge.condition && (
                    <text
                      x={(startX + endX) / 2}
                      y={(startY + endY) / 2 - 8}
                      textAnchor="middle"
                      fontSize={11}
                      fill={isEdgeHovered || isEdgeSelected ? colors.primary[500] : colors.neutral[500]}
                      fontWeight={isEdgeHovered || isEdgeSelected ? 600 : undefined}
                    >
                      {edge.condition}
                    </text>
                  )}
                  {/* Hover 时显示删除图标 */}
                  {isEdgeHovered && (
                    <g
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdgeClick(edge);
                      }}
                    >
                      <circle
                        cx={(startX + endX) / 2}
                        cy={(startY + endY) / 2 + 10}
                        r={10}
                        fill="#fff"
                        stroke={colors.neutral[300]}
                        strokeWidth={1}
                      />
                      <text
                        x={(startX + endX) / 2}
                        y={(startY + endY) / 2 + 14}
                        textAnchor="middle"
                        fontSize={12}
                        fill={colors.error[500]}
                      >
                        x
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="10"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill={colors.neutral[400]} />
              </marker>
            </defs>
          </svg>

          {/* Nodes */}
          {workflow.nodes?.map((node) => {
            const isHovered = hoveredNodeId === node.id;
            const isSelected = selectedNode?.id === node.id;
            const configured = isNodeConfigured(node);
            const configPreview = getNodeConfigPreview(node);

            return (
              <div
                key={node.id}
                onClick={() => handleNodeClick(node)}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                style={{
                  position: 'absolute',
                  left: node.position.x,
                  top: node.position.y,
                  minWidth: 200,
                  maxWidth: 280,
                  minHeight: configured ? 100 : 80,
                  background: isSelected ? colors.primary[50] : isHovered ? colors.neutral[10] || '#f5f5f5' : '#fff',
                  borderRadius: 12,
                  padding: '12px 16px',
                  boxShadow: isHovered
                    ? '0 3px 8px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)'
                    : '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
                  borderLeft: `3px solid ${nodeTypeColors[node.type] || colors.neutral[400]}`,
                  border: isSelected ? `2px solid ${colors.primary[500]}` : undefined,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {/* Header: status dot + name */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {/* 配置状态圆点 */}
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: configured ? colors.success[500] : colors.warning[500],
                        display: 'inline-block',
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: 13,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 160,
                      }}
                    >
                      {node.name}
                    </span>
                  </div>
                  {/* Hover 操作按钮 */}
                  {isHovered && (
                    <Space size={2} onClick={(e) => e.stopPropagation()}>
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined style={{ fontSize: 12 }} />}
                        onClick={() => handleNodeClick(node)}
                        style={{ padding: '0 4px', height: 20 }}
                        title="编辑"
                      />
                      <Button
                        type="text"
                        size="small"
                        icon={<CopyOutlined style={{ fontSize: 12 }} />}
                        onClick={() => handleDuplicateNode(node)}
                        style={{ padding: '0 4px', height: 20 }}
                        title="复制"
                      />
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                        onClick={() => {
                          setSelectedNode(node);
                          handleDeleteNode();
                        }}
                        style={{ padding: '0 4px', height: 20 }}
                        title="删除"
                      />
                    </Space>
                  )}
                </div>
                {/* Type tag */}
                <Tag color={nodeTypeColors[node.type]} style={{ fontSize: 10, marginBottom: 6 }}>
                  {nodeTypeLabels[node.type] || node.type}
                </Tag>
                {/* Config preview */}
                {configured && (
                  <div
                    style={{
                      fontSize: 12,
                      color: colors.neutral[500],
                      lineHeight: 1.4,
                      maxHeight: 40,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      borderTop: `1px solid ${colors.neutral[200]}`,
                      paddingTop: 6,
                      marginTop: 2,
                    }}
                  >
                    {configPreview}
                  </div>
                )}
              </div>
            );
          })}

          {(!workflow.nodes || workflow.nodes.length === 0) && (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <Empty description="该工作流暂无节点" />
            </div>
          )}
        </div>
      </div>

      {/* Node Detail Drawer */}
      <Drawer
        title={
          <Space>
            {selectedNode && (
              <Tag color={nodeTypeColors[selectedNode.type]}>
                {nodeTypeLabels[selectedNode.type] || selectedNode.type}
              </Tag>
            )}
            {selectedNode?.name || '节点详情'}
          </Space>
        }
        placement="right"
        width={480}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditMode(false);
        }}
        extra={
          selectedNode && (
            <Space>
              {!editMode && (
                <Button type="link" icon={<EditOutlined />} onClick={handleEditToggle}>
                  编辑
                </Button>
              )}
              <Button danger type="link" icon={<DeleteOutlined />} onClick={handleDeleteNode} size="small">
                删除
              </Button>
            </Space>
          )
        }
        footer={
          editMode && (
            <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
              <Button onClick={handleCancelEdit}>取消</Button>
              <Button type="primary" onClick={handleSaveNode}>
                保存
              </Button>
            </Space>
          )
        }
      >
        {selectedNode && (
          <Form form={editForm} layout="vertical" disabled={!editMode}>
            {/* 基本信息 */}
            <Divider orientation="left" style={{ margin: '0 0 12px' }}>基本信息</Divider>
            <Form.Item
              label="节点名称"
              name="name"
              rules={[{ required: true, message: '请输入节点名称' }]}
            >
              <Input placeholder="请输入节点名称" />
            </Form.Item>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="节点 ID">
                <Text code>{selectedNode.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="位置">
                X: {selectedNode.position.x}, Y: {selectedNode.position.y}
              </Descriptions.Item>
            </Descriptions>

            {/* 节点配置 - 根据类型渲染 */}
            {selectedNode.config && (
              <>
                <Divider orientation="left" style={{ margin: '12px 0' }}>节点配置</Divider>
                {renderNodeForm(selectedNode, editMode)}
              </>
            )}

            {/* 错误处理策略 - 所有节点通用 */}
            {renderErrorHandlingForm(editMode)}

            {/* 变量配置 */}
            <Divider orientation="left" style={{ margin: '12px 0' }}>变量配置</Divider>
            <div style={{ fontSize: 12 }}>
              <Text type="secondary">输入变量：</Text>
              <div style={{ marginTop: 4 }}>
                {workflow.edges
                  ?.filter((e) => e.target === selectedNode.id)
                  .map((e) => {
                    const src = workflow.nodes?.find((n) => n.id === e.source);
                    return src ? (
                      <Tag key={e.id} style={{ marginBottom: 4 }}>{src.name}.output</Tag>
                    ) : null;
                  })}
                {!workflow.edges?.some((e) => e.target === selectedNode.id) && (
                  <Text type="secondary">无（开始节点）</Text>
                )}
              </div>
            </div>
            <div style={{ fontSize: 12, marginTop: 8 }}>
              <Text type="secondary">输出变量：</Text>
              <div style={{ marginTop: 4 }}>
                <Tag>{selectedNode.name}.output</Tag>
              </div>
            </div>

            {/* 关联信息 */}
            <Divider orientation="left" style={{ margin: '12px 0' }}>关联信息</Divider>
            <div style={{ fontSize: 12 }}>
              <Text type="secondary">上游：</Text>
              <Text>
                {workflow.edges
                  ?.filter((e) => e.target === selectedNode.id)
                  .map((e) => {
                    const src = workflow.nodes?.find((n) => n.id === e.source);
                    return src ? src.name : e.source;
                  })
                  .join('、') || '无'}
              </Text>
            </div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              <Text type="secondary">下游：</Text>
              <Text>
                {workflow.edges
                  ?.filter((e) => e.source === selectedNode.id)
                  .map((e) => {
                    const tgt = workflow.nodes?.find((n) => n.id === e.target);
                    return tgt ? tgt.name : e.target;
                  })
                  .join('、') || '无'}
              </Text>
            </div>
          </Form>
        )}
      </Drawer>

      {/* ==================== 连线编辑 Modal ==================== */}
      <Modal
        title="编辑连线"
        open={edgeModalOpen}
        onOk={handleSaveEdge}
        onCancel={() => {
          setEdgeModalOpen(false);
          setSelectedEdge(null);
          setEditingEdge(null);
        }}
        okText="保存"
        cancelText="取消"
        width={480}
      >
        {editingEdge && (
          <>
            <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="源节点">
                {(() => {
                  const src = workflow?.nodes?.find((n) => n.id === editingEdge.source);
                  return src ? src.name : editingEdge.source;
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="目标节点">
                {(() => {
                  const tgt = workflow?.nodes?.find((n) => n.id === editingEdge.target);
                  return tgt ? tgt.name : editingEdge.target;
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="连线 ID">
                <Text code style={{ fontSize: 11 }}>{editingEdge.id}</Text>
              </Descriptions.Item>
            </Descriptions>
            <Divider style={{ margin: '12px 0' }} />
            <Form form={edgeForm} layout="vertical">
              <Form.Item
                label="条件表达式"
                name="condition"
                tooltip="用于条件分支，例如：${amount} > 1000"
              >
                <Input.TextArea
                  rows={3}
                  placeholder="条件表达式（可选），例如：${amount} > 1000"
                  allowClear
                />
              </Form.Item>
            </Form>
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={handleDeleteEdge}
              >
                删除连线
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* ==================== 添加连线 Modal ==================== */}
      <Modal
        title="添加连线"
        open={addEdgeModalOpen}
        onOk={handleAddEdge}
        onCancel={() => setAddEdgeModalOpen(false)}
        okText="创建"
        cancelText="取消"
        width={480}
      >
        <Form form={addEdgeForm} layout="vertical">
          <Form.Item
            label="源节点"
            name="source"
            rules={[{ required: true, message: '请选择源节点' }]}
          >
            <Select placeholder="请选择源节点" showSearch>
              {workflow?.nodes?.map((node) => (
                <Select.Option key={node.id} value={node.id}>
                  {node.name} ({nodeTypeLabels[node.type] || node.type})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="目标节点"
            name="target"
            rules={[{ required: true, message: '请选择目标节点' }]}
          >
            <Select placeholder="请选择目标节点" showSearch>
              {workflow?.nodes?.map((node) => (
                <Select.Option key={node.id} value={node.id}>
                  {node.name} ({nodeTypeLabels[node.type] || node.type})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="条件表达式（可选）"
            name="condition"
            tooltip="用于条件分支，例如：${amount} > 1000"
          >
            <Input.TextArea
              rows={3}
              placeholder="条件表达式（可选），例如：${amount} > 1000"
              allowClear
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WorkflowCanvas;
