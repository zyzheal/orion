/**
 * 工作流画布 — ReactFlow v11 版
 *
 * 可视化节点展示、拖拽连线、节点详情
 * 替换原有自定义 SVG+absolute div 渲染层，使用 ReactFlow 提供：
 *   - 节点拖拽（built-in）
 *   - 连线创建（connection line + connection indicator）
 *   - 缩放/平移（built-in transform）
 *   - 自定义节点渲染
 *   - 连线 hover/selected 状态
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Button, Empty, Space, Tag, Typography, message, Drawer, Form, Modal, Select, Table, Input, Divider } from 'antd';
import {
  PlayCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import ReactFlow, {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Connection,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  getWorkflow,
  executeWorkflow,
  deleteWorkflow,
  type WorkflowDefinition,
  type WorkflowNode,
  type WorkflowEdge,
} from '@/api/workflow';
import { colors } from '@/tokens';

const { Text } = Typography;

// ==================== 输入/输出变量类型 ====================

interface InputVariableMapping {
  sourceNode: string;
  sourceVar: string;
  localVar: string;
}

interface OutputVariable {
  name: string;
  description: string;
}

// ==================== 自定义节点组件 ====================

interface CustomNodeProps {
  data: {
    node: WorkflowNode;
    isHovered: boolean;
    isSelected: boolean;
    configured: boolean;
    configPreview: string;
    onNodeClick: () => void;
  };
}

function CustomNode({ data }: CustomNodeProps) {
  const { node, isHovered, isSelected, configured, configPreview, onNodeClick } = data;

  const color = nodeTypeColors[node.type];

  return (
    <div
      onClick={onNodeClick}
      style={{
        minWidth: 200,
        maxWidth: 280,
        background: isSelected ? colors.primary[50] : isHovered ? colors.neutral[50] : colors.neutral[0],
        borderRadius: 12,
        padding: '12px 16px',
        border: isSelected ? `2px solid ${colors.primary[500]}` : `1px solid ${colors.neutral[200]}`,
        boxShadow: isHovered
          ? '0 3px 8px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)'
          : '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* Type badge */}
      <div
        style={{
          position: 'absolute',
          top: -8,
          left: 16,
          background: color,
          color: colors.neutral[0],
          borderRadius: 12,
          padding: '3px 12px',
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        {nodeTypeLabels[node.type] || node.type}
      </div>

      {/* Name */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: colors.neutral[900],
          marginBottom: 6,
          marginTop: 8,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {node.name}
      </div>

      {/* Config preview */}
      {configured && (
        <div
          style={{
            fontSize: 11,
            color: colors.neutral[600],
            whiteSpace: 'nowrap',
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

      {!configured && (
        <div
          style={{
            fontSize: 11,
            color: colors.neutral[400],
            fontStyle: 'italic',
          }}
        >
          未配置
        </div>
      )}
    </div>
  );
}

// ==================== 类型映射 ====================

const nodeTypeColors: Record<string, string> = {
  start: colors.success[500],
  approval: colors.purple[500],
  condition: colors.warning[500],
  notification: colors.info[500],
  webhook: colors.primary[500],
  task: colors.primary[600],
  'sub-workflow': colors.purple[600],
  delay: colors.info[400],
  timer: colors.purple[500],
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

const customNodeTypes = { workflow: CustomNode };

// ==================== 组件 ====================

interface WorkflowCanvasProps {
  workflowId: string | null;
}

const WorkflowCanvasInner: React.FC<WorkflowCanvasProps> = ({ workflowId }) => {
  // ===== 状态 =====
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm] = Form.useForm();
  const [originalConfig, setOriginalConfig] = useState<Record<string, unknown> | null>(null);
  const [_hoveredNodeId, _setHoveredNodeId] = useState<string | null>(null);
  const [inputMappings, setInputMappings] = useState<InputVariableMapping[]>([]);
  const [outputVariables, setOutputVariables] = useState<OutputVariable[]>([]);
  const [newMappingSourceNode, setNewMappingSourceNode] = useState<string>('');
  const [newMappingSourceVar, setNewMappingSourceVar] = useState<string>('');
  const [newMappingLocalVar, setNewMappingLocalVar] = useState<string>('');
  const [newOutputName, setNewOutputName] = useState<string>('');
  const [newOutputDesc, setNewOutputDesc] = useState<string>('');
  const errorHandlingOnFailure = Form.useWatch(['errorHandling', 'onFailure'], editForm);

  // ===== 连线编辑状态 =====
  const [_selectedEdge, setSelectedEdge] = useState<WorkflowEdge | null>(null);
  const [edgeModalOpen, setEdgeModalOpen] = useState(false);
  const [editingEdge, setEditingEdge] = useState<WorkflowEdge | null>(null);
  const [edgeForm] = Form.useForm();
  const [_hoveredEdgeId, _setHoveredEdgeId] = useState<string | null>(null);
  const [addEdgeModalOpen, setAddEdgeModalOpen] = useState(false);
  const [addEdgeForm] = Form.useForm();

  // ===== ReactFlow 状态 =====
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [_initialized, _setInitialized] = useState(false);

  // ===== 初始化工作流数据 =====
  useEffect(() => {
    if (!workflowId) {
      setWorkflow(null);
      setSelectedNode(null);
      setRfNodes([]);
      setRfEdges([]);
      return;
    }
    setLoading(true);
    getWorkflow(workflowId)
      .then((data) => {
        setWorkflow(data);
        setSelectedNode(null);

        // 转换为 ReactFlow nodes/edges
        if (data.nodes && data.nodes.length > 0) {
          const nodes: Node[] = data.nodes.map((n) => ({
            id: n.id,
            type: 'workflow',
            position: { x: n.position.x, y: n.position.y },
            data: {
              node: n,
              isHovered: false,
              isSelected: false,
              configured: false,
              configPreview: '',
              onNodeClick: () => {},
            },
          }));
          const edges: Edge[] = (data.edges || []).map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle || undefined,
            animated: false,
            style: {},
            data: { condition: e.condition || '' },
          }));
          setRfNodes(nodes);
          setRfEdges(edges);
          _setInitialized(true);
        }
      })
      .catch(() => message.error('获取工作流失败'))
      .finally(() => setLoading(false));
  }, [workflowId]);

  // ===== 从 WorkflowNode 计算节点预览信息 =====
  const getNodeConfigPreview = useCallback(
    (node: WorkflowNode): string => {
      const c = node.config || {};
      switch (node.type) {
        case 'approval': {
          const approvers = c.approvers;
          const mode = c.mode;
          return [
            approvers ? `审批人：${typeof approvers === 'string' ? approvers : String(approvers)}` : '',
            mode ? `模式：${mode}` : '',
          ]
            .filter(Boolean)
            .join(' · ') || '未配置';
        }
        case 'notification':
          return c.channel ? `渠道：${c.channel}` : '未配置';
        case 'webhook':
          return `${c.method || ''} ${c.url || ''}`.trim() || '未配置';
        case 'condition':
          return c.expression
            ? `表达式：${String(c.expression).slice(0, 30)}${String(c.expression).length > 30 ? '...' : ''}`
            : '未配置';
        case 'task':
          return c.title ? `${c.title} · ${c.assignee || '未分配'}` : '未配置';
        case 'delay':
          return c.duration ? `延迟 ${c.duration} 秒` : '未配置';
        case 'timer':
          return c.cron ? `Cron：${c.cron}` : '未配置';
        case 'sub-workflow':
          return c.subWorkflowId ? `子流程：${c.subWorkflowId}` : '未配置';
        default:
          return Object.keys(c).length > 0 ? '已配置' : '';
      }
    },
    [],
  );

  const isNodeConfigured = useCallback((node: WorkflowNode): boolean => {
    if (!node.config || Object.keys(node.config).length === 0) return false;
    return Object.values(node.config).some((v) => v !== null && v !== undefined && v !== '');
  }, []);

  // ===== 构建完整节点数据（含回调） =====
  const buildRfNodes = useCallback(
    (nodes: Node[]) => {
      if (!workflow) return nodes;
      return nodes.map((n) => {
        const wfNode = workflow.nodes?.find((w) => w.id === n.id);
        if (!wfNode) return n;
        const configPreview = getNodeConfigPreview(wfNode);
        const configured = isNodeConfigured(wfNode);
        return {
          ...n,
          data: {
            ...n.data,
            node: wfNode,
            isHovered: _hoveredNodeId === n.id,
            isSelected: selectedNode?.id === n.id,
            configured,
            configPreview,
            onNodeClick: () => handleNodeClick(wfNode),
          },
        };
      });
    },
    [workflow, _hoveredNodeId, selectedNode, getNodeConfigPreview, isNodeConfigured],
  );

  const [displayNodes, setDisplayNodes] = useState<Node[]>([]);
  useEffect(() => {
    setDisplayNodes(buildRfNodes(rfNodes));
  }, [rfNodes, rfEdges, buildRfNodes]);

  // ===== 节点事件 =====
  const handleNodeClick = (node: WorkflowNode) => {
    setSelectedNode(node);
    setOriginalConfig({ ...node.config });
    editForm.setFieldsValue({
      name: node.name,
      ...node.config,
    });
    setEditMode(false);
    setDrawerOpen(true);

    // 加载输入/输出变量
    const mappings = node.config?.inputVariableMapping;
    const outputs = node.config?.outputVariables;
    setInputMappings(Array.isArray(mappings) ? mappings : []);
    setOutputVariables(Array.isArray(outputs) ? outputs : []);
  };

  const handleNodeDragStop = useCallback(
    (_: MouseEvent, node: Node) => {
      const wfNode = workflow?.nodes?.find((n) => n.id === node.id);
      if (wfNode) {
        wfNode.position = { x: node.position.x, y: node.position.y };
      }
    },
    [workflow],
  );

  const onNodesChangeHandler: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);
    },
    [onNodesChange],
  );

  // ===== 连线事件 =====
  const onEdgesChangeHandler: OnEdgesChange = useCallback(
    (changes) => {
      onEdgesChange(changes);
    },
    [onEdgesChange],
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const edgeId = `e-${connection.source}-${connection.target}-${Date.now()}`;
      const newEdge: Edge = {
        id: edgeId,
        source: connection.source!,
        target: connection.target!,
        sourceHandle: (connection.sourceHandle as string | undefined) || undefined,
        animated: false,
        style: {},
        data: { condition: '' },
      };
      setRfEdges((eds) => addEdge(newEdge, eds));

      // 同步到 workflow.edges
      if (workflow) {
        const newWfEdge: WorkflowEdge = {
          id: edgeId,
          source: connection.source!,
          target: connection.target!,
          };
        if (!workflow.edges) workflow.edges = [];
        workflow.edges.push(newWfEdge);
      }
      message.success('连线已创建');
    },
    [workflow, setRfEdges],
  );

  // ===== 选中的变更（处理多选） =====
  const onSelectionChange = useCallback(
    ({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) => {
      // 仅支持单节点选择
      if (nodes.length === 1) {
        const n = nodes[0];
        const wfNode = workflow?.nodes?.find((w) => w.id === n.id);
        if (wfNode) {
          setSelectedNode(wfNode);
        }
      } else if (nodes.length === 0 && edges.length > 0) {
        // 选中了边
        const wfEdge = workflow?.edges?.find((e) => e.id === edges[0].id);
        if (wfEdge) {
          setSelectedEdge(wfEdge);
        }
      }
    },
    [workflow],
  );

  // ===== 执行 =====
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

  // ===== 删除 =====
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
          setRfNodes([]);
          setRfEdges([]);
        } catch {
          message.error('删除失败');
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  // ===== 编辑节点 =====
  const handleEditToggle = () => {
    if (editMode) {
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

  const handleCancelEdit = () => {
    if (selectedNode && originalConfig) {
      editForm.setFieldsValue({
        name: selectedNode.name,
        ...originalConfig,
      });
    }
    setEditMode(false);
  };

  const handleDeleteNode = () => {
    if (!selectedNode || !workflow) return;
    Modal.confirm({
      title: '确认删除节点',
      content: `确定删除节点 "${selectedNode.name}" 吗？`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        // 移除节点和关联边
        setRfNodes((nodes) => nodes.filter((n) => n.id !== selectedNode.id));
        setRfEdges((edges) =>
          edges.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id),
        );
        if (workflow.nodes) {
          workflow.nodes = workflow.nodes.filter((n) => n.id !== selectedNode.id);
        }
        if (workflow.edges) {
          workflow.edges = workflow.edges.filter(
            (e) => e.source !== selectedNode.id && e.target !== selectedNode.id,
          );
        }
        message.success(`节点 "${selectedNode.name}" 已删除`);
        setDrawerOpen(false);
        setSelectedNode(null);
      },
    });
  };

  const handleSaveNodeWithVariables = async () => {
    if (!selectedNode || !workflow) return;
    try {
      const values = await editForm.validateFields();
      const updatedNode = {
        ...selectedNode,
        name: values.name || selectedNode.name,
        config: {
          ...selectedNode.config,
          ...values,
          inputVariableMapping: inputMappings,
          outputVariables: outputVariables,
        },
      };

      const idx = workflow.nodes?.findIndex((n) => n.id === updatedNode.id);
      if (idx !== -1) workflow.nodes![idx] = updatedNode;

      setRfNodes((nodes) =>
        nodes.map((n) => {
          if (n.id === updatedNode.id) {
            return {
              ...n,
              data: {
                ...n.data,
                node: updatedNode,
                configured: isNodeConfigured(updatedNode),
                configPreview: getNodeConfigPreview(updatedNode),
                onNodeClick: () => handleNodeClick(updatedNode),
              },
            };
          }
          return n;
        }),
      );

      message.success('节点已保存');
      setEditMode(false);
      setDrawerOpen(false);
    } catch {
      message.error('请检查输入');
    }
  };

  // ===== 连线编辑 =====
  const _handleEdgeClick = (edge: WorkflowEdge) => {
    setSelectedEdge(edge);
    edgeForm.setFieldsValue(edge);
    setEditingEdge(edge);
    setEdgeModalOpen(true);
  };

  const handleRfEdgeClick = (_: MouseEvent, edge: Edge) => {
    const wfEdge = workflow?.edges?.find((e) => e.id === edge.id);
    if (wfEdge) _handleEdgeClick(wfEdge);
  };

  const handleSaveEdge = async () => {
    if (!editingEdge || !workflow) return;
    try {
      const values = await edgeForm.validateFields();
      const updatedEdge = { ...editingEdge, ...values };

      const idx = workflow.edges?.findIndex((e) => e.id === updatedEdge.id);
      if (idx !== -1) {
        workflow.edges![idx] = updatedEdge;
        setRfEdges((edges) =>
          edges.map((e) =>
            e.id === updatedEdge.id ? ({ ...e, data: { condition: updatedEdge.condition || '' } } as Edge) : e,
          ),
        );
      }
      message.success('连线已更新');
      setEdgeModalOpen(false);
    } catch {
      message.error('请检查输入');
    }
  };

  const handleDeleteEdge = () => {
    if (!editingEdge || !workflow) return;
    Modal.confirm({
      title: '确认删除连线',
      content: '确定删除此连线吗？',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        setRfEdges((edges) => edges.filter((e) => e.id !== editingEdge.id));
        if (workflow.edges) {
          workflow.edges = workflow.edges.filter((e) => e.id !== editingEdge.id);
        }
        message.success('连线已删除');
        setEdgeModalOpen(false);
        setSelectedEdge(null);
      },
    });
  };

  const handleOpenAddEdge = () => {
    addEdgeForm.resetFields();
    setAddEdgeModalOpen(true);
  };

  const handleAddEdge = async () => {
    try {
      const values = await addEdgeForm.validateFields();
      const sourceNode = workflow?.nodes?.find((n) => n.id === values.source);
      const targetNode = workflow?.nodes?.find((n) => n.id === values.target);
      if (!sourceNode || !targetNode) {
        message.error('源节点或目标节点不存在');
        return;
      }

      const edgeId = `e-${values.source}-${values.target}-${Date.now()}`;
      const newEdge: Edge = {
        id: edgeId,
        source: values.source,
        target: values.target,
        animated: false,
        data: { condition: values.condition || '' },
      };
      setRfEdges((eds) => addEdge(newEdge, eds));
      if (workflow) {
        if (!workflow.edges) workflow.edges = [];
        workflow.edges.push({
          id: edgeId,
          source: values.source,
          target: values.target,
          condition: values.condition,
        });
      }
      message.success('连线已添加');
      setAddEdgeModalOpen(false);
    } catch {
      message.error('请检查输入');
    }
  };

  // ===== 输入变量映射 =====
  const handleAddInputMapping = () => {
    if (!newMappingSourceNode || !newMappingSourceVar || !newMappingLocalVar) {
      message.error('请填写完整的映射信息');
      return;
    }
    setInputMappings((prev) => [
      ...prev,
      { sourceNode: newMappingSourceNode, sourceVar: newMappingSourceVar, localVar: newMappingLocalVar },
    ]);
    setNewMappingSourceNode('');
    setNewMappingSourceVar('');
    setNewMappingLocalVar('');
  };

  const handleRemoveInputMapping = (index: number) => {
    setInputMappings((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddOutputVariable = () => {
    if (!newOutputName) {
      message.error('请输入变量名');
      return;
    }
    setOutputVariables((prev) => [...prev, { name: newOutputName, description: newOutputDesc }]);
    setNewOutputName('');
    setNewOutputDesc('');
  };

  const handleRemoveOutputVariable = (index: number) => {
    setOutputVariables((prev) => prev.filter((_, i) => i !== index));
  };

  // ===== 获取上游节点列表 =====
  const getUpstreamNodes = useCallback((): { id: string; name: string }[] => {
    if (!workflow || !selectedNode) return [];
    return workflow.edges
      ?.filter((e) => e.target === selectedNode.id)
      .map((e) => {
        const src = workflow.nodes?.find((n) => n.id === e.source);
        return src ? { id: src.id, name: src.name } : { id: e.source, name: e.source };
      }) || [];
  }, [workflow, selectedNode]);

  // ===== 渲染节点配置表单 =====
  const renderNodeForm = useCallback(
    (node: WorkflowNode, _editable: boolean) => {
      if (!node) return null;

      switch (node.type) {
        case 'start':
          return <Form.Item label="描述" name="description"><Input.TextArea rows={2} /></Form.Item>;

        case 'end':
          return <Form.Item label="描述" name="description"><Input.TextArea rows={2} /></Form.Item>;

        case 'approval':
          return (
            <>
              <Form.Item label="审批人" name="approvers">
                <Select mode="tags" placeholder="选择或输入审批人" />
              </Form.Item>
              <Form.Item label="审批模式" name="mode">
                <Select options={[{ label: '一人通过', value: 'one' }, { label: '多数通过', value: 'majority' }, { label: '全员通过', value: 'all' }]} />
              </Form.Item>
              <Form.Item label="超时时间(秒)" name="timeout"><Input type="number" /></Form.Item>
            </>
          );

        case 'notification':
          return (
            <>
              <Form.Item label="通知渠道" name="channel">
                <Select options={[
                  { label: '邮件', value: 'email' },
                  { label: '短信', value: 'sms' },
                  { label: '钉钉', value: 'dingtalk' },
                  { label: '飞书', value: 'feishu' },
                  { label: 'Webhook', value: 'webhook' },
                ]} />
              </Form.Item>
              <Form.Item label="接收人" name="recipients">
                <Input placeholder="多个收件人以逗号分隔" />
              </Form.Item>
              <Form.Item label="标题" name="title"><Input /></Form.Item>
              <Form.Item label="内容模板" name="template"><Input.TextArea rows={3} /></Form.Item>
            </>
          );

        case 'webhook':
          return (
            <>
              <Form.Item label="URL" name="url"><Input placeholder="https://..." /></Form.Item>
              <Form.Item label="方法" name="method">
                <Select options={[
                  { label: 'GET', value: 'GET' },
                  { label: 'POST', value: 'POST' },
                  { label: 'PUT', value: 'PUT' },
                  { label: 'DELETE', value: 'DELETE' },
                ]} />
              </Form.Item>
              <Form.Item label="请求体" name="body"><Input.TextArea rows={3} /></Form.Item>
            </>
          );

        case 'condition':
          return (
            <>
              <Form.Item label="条件表达式" name="expression">
                <Input placeholder="${var} === 'value'" />
              </Form.Item>
              <Form.Item label="说明" name="description"><Input /></Form.Item>
            </>
          );

        case 'task':
          return (
            <>
              <Form.Item label="任务标题" name="title"><Input /></Form.Item>
              <Form.Item label="负责人" name="assignee"><Input /></Form.Item>
              <Form.Item label="超时时间(分钟)" name="timeout"><Input type="number" /></Form.Item>
            </>
          );

        case 'delay':
          return (
            <Form.Item label="延迟时长(秒)" name="duration"
              rules={[{ required: true, message: '请输入延迟时长' },
                { validator: (_, val) => Promise.resolve(val > 0 ? undefined : Promise.reject(new Error('必须为正整数'))) }
              ]}
            >
              <Input type="number" />
            </Form.Item>
          );

        case 'timer':
          return (
            <>
              <Form.Item label="Cron 表达式" name="cron">
                <Input placeholder="0 12 * * *" />
              </Form.Item>
              <Form.Item label="时区" name="timezone">
                <Input placeholder="Asia/Shanghai" />
              </Form.Item>
            </>
          );

        case 'sub-workflow':
          return (
            <Form.Item label="子流程 ID" name="subWorkflowId">
              <Input placeholder="选择或输入子流程 ID" />
            </Form.Item>
          );

        default:
          return null;
      }
    },
    [],
  );

  // ===== 错误处理配置 =====
  const renderErrorHandlingForm = useCallback(
    (editable: boolean) => {
      if (!editable) return null;
      return (
        <>
          <Form.Item label="失败策略" name={['errorHandling', 'onFailure']}>
            <Select options={[
              { label: '跳过', value: 'skip' },
              { label: '重试', value: 'retry' },
              { label: '终止', value: 'abort' },
            ]} />
          </Form.Item>
          {errorHandlingOnFailure === 'retry' && (
            <Form.Item label="重试次数" name={['errorHandling', 'retryCount']}
              rules={[{ validator: (_, val) => Promise.resolve(val >= 1 && val <= 3 ? undefined : Promise.reject(new Error('1-3 次'))) }]}
            >
              <Select options={[{ label: '1 次', value: 1 }, { label: '2 次', value: 2 }, { label: '3 次', value: 3 }]} />
            </Form.Item>
          )}
          {errorHandlingOnFailure === 'retry' && (
            <Form.Item label="重试间隔(秒)" name={['errorHandling', 'retryInterval']}
              rules={[{ validator: (_, val) => Promise.resolve(val > 0 ? undefined : Promise.reject(new Error('必须为正整数'))) }]}
            >
              <Input type="number" />
            </Form.Item>
          )}
        </>
      );
    },
    [errorHandlingOnFailure],
  );

  // ===== 输入变量映射面板 =====
  const renderInputVariableMapping = () => {
    if (!selectedNode) return null;
    const upstream = getUpstreamNodes();

    return (
      <div>
        <Text strong>输入变量映射</Text>
        <Table
          size="small"
          dataSource={inputMappings}
          pagination={false}
          columns={[
            { title: '源节点', dataIndex: 'sourceNode', render: (nodeId: string) => {
              const node = upstream.find((n) => n.id === nodeId);
              return node ? `${node.name} (${nodeId})` : nodeId;
            }},
            { title: '源变量', dataIndex: 'sourceVar' },
            { title: '本地变量', dataIndex: 'localVar' },
            { title: '操作', render: (_, __, index) => (
              <Button type="link" danger size="small" onClick={() => handleRemoveInputMapping(index)}>删除</Button>
            )},
          ]}
        />
        <Form.Item>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <Select
              value={newMappingSourceNode}
              onChange={setNewMappingSourceNode}
              placeholder="源节点"
              style={{ width: 150 }}
              options={upstream.map((n) => ({ label: n.name, value: n.id }))}
            />
            <Input value={newMappingSourceVar} onChange={(e) => setNewMappingSourceVar(e.target.value)} placeholder="源变量" style={{ width: 120 }} />
            <Input value={newMappingLocalVar} onChange={(e) => setNewMappingLocalVar(e.target.value)} placeholder="本地变量" style={{ width: 120 }} />
            <Button icon={<PlusOutlined />} onClick={handleAddInputMapping}>添加</Button>
          </div>
        </Form.Item>
      </div>
    );
  };

  // ===== 输出变量面板 =====
  const renderOutputVariables = () => {
    return (
      <div>
        <Text strong>输出变量</Text>
        <Table
          size="small"
          dataSource={outputVariables}
          pagination={false}
          columns={[
            { title: '变量名', dataIndex: 'name' },
            { title: '描述', dataIndex: 'description' },
            { title: '操作', render: (_, __, index) => (
              <Button type="link" danger size="small" onClick={() => handleRemoveOutputVariable(index)}>删除</Button>
            )},
          ]}
        />
        <Form.Item>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <Input value={newOutputName} onChange={(e) => setNewOutputName(e.target.value)} placeholder="变量名" style={{ width: 150 }} />
            <Input value={newOutputDesc} onChange={(e) => setNewOutputDesc(e.target.value)} placeholder="描述" style={{ width: 150 }} />
            <Button icon={<PlusOutlined />} onClick={handleAddOutputVariable}>添加</Button>
          </div>
        </Form.Item>
      </div>
    );
  };

  // ===== 无工作流 =====
  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description="加载中..." />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description="请先从左侧选择一个工作流" />
      </div>
    );
  }

  // ===== 无边/无节点 =====
  if (!workflow.nodes || workflow.nodes.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleExecute}
              loading={executing}
            >
              执行
            </Button>
          </Space>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description="该工作流暂无节点" />
        </div>
      </div>
    );
  }

  // ===== 主渲染 =====
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
            size="small"
            icon={<PlusOutlined />}
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
          >
            删除
          </Button>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            size="small"
            onClick={handleExecute}
            loading={executing}
          >
            执行
          </Button>
        </Space>
      </div>

      {/* ReactFlow Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={displayNodes}
          edges={rfEdges}
          onNodesChange={onNodesChangeHandler}
          onEdgesChange={onEdgesChangeHandler}
          onConnect={onConnect}
          // @ts-ignore — reactflow types don't export NodeDragHandler
          onNodeDragStop={handleNodeDragStop}
          // @ts-ignore — reactflow types don't export SelectionChange
          onSelectionChange={onSelectionChange}
          // @ts-ignore — edge type union mismatch between Edge<Edge> and base Edge
          onEdgeClick={handleRfEdgeClick}
          nodeTypes={customNodeTypes}
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: false,
            style: { stroke: colors.neutral[400], strokeWidth: 2 },
          }}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
          style={{ background: colors.light.bg.secondary }}
        >
          <Background color={colors.neutral[300]} gap={20} />
          <Controls
            style={{
              background: colors.neutral[0],
              border: `1px solid ${colors.neutral[200]}`,
              borderRadius: 8,
            }}
            showZoom={false}
            showFitView={true}
          />
          <MiniMap
            nodeStrokeColor={() => colors.primary[500]}
            nodeColor={() => colors.primary[100]}
            maskColor="rgba(0,0,0,0.05)"
            style={{
              background: colors.neutral[0],
              border: `1px solid ${colors.neutral[200]}`,
            }}
          />
        </ReactFlow>
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
              <Button type="primary" onClick={handleSaveNodeWithVariables}>
                保存
              </Button>
            </Space>
          )
        }
      >
        {selectedNode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Text type="secondary">
              位置：X: {selectedNode.position.x}, Y: {selectedNode.position.y}
            </Text>

            <Form form={editForm}>
              {editMode && (
                <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入节点名称' }]}>
                  <Input />
                </Form.Item>
              )}

              {editMode ? (
                <>
                  {renderNodeForm(selectedNode, true)}
                  <Divider />
                  {renderErrorHandlingForm(true)}
                </>
              ) : (
                <>
                  {renderNodeForm(selectedNode, false)}
                </>
              )}

              {editMode && (
                <>
                  <Divider>输入变量映射</Divider>
                  {renderInputVariableMapping()}
                  <Divider>输出变量</Divider>
                  {renderOutputVariables()}
                </>
              )}
            </Form>
          </div>
        )}
      </Drawer>

      {/* Edge Edit Modal */}
      <Modal
        title="编辑连线"
        open={edgeModalOpen}
        onOk={handleSaveEdge}
        onCancel={() => setEdgeModalOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        {editingEdge && (
          <Form form={edgeForm} layout="vertical">
            <Form.Item label="源节点" name="source">
              <Input disabled />
            </Form.Item>
            <Form.Item label="目标节点" name="target">
              <Input disabled />
            </Form.Item>
            <Form.Item label="条件表达式" name="condition">
              <Input placeholder="可选，如：${status} === 'approved'" />
            </Form.Item>
            <Form.Item label="描述" name="label">
              <Input placeholder="连线描述" />
            </Form.Item>
            <Button danger onClick={handleDeleteEdge} style={{ marginTop: 8 }}>
              删除连线
            </Button>
          </Form>
        )}
      </Modal>

      {/* Add Edge Modal */}
      <Modal
        title="添加连线"
        open={addEdgeModalOpen}
        onOk={handleAddEdge}
        onCancel={() => setAddEdgeModalOpen(false)}
        okText="添加"
        cancelText="取消"
      >
        <Form form={addEdgeForm} layout="vertical">
          <Form.Item label="源节点" name="source" rules={[{ required: true }]}>
            <Select
              options={(workflow.nodes || []).map((n) => ({
                label: `${nodeTypeLabels[n.type] || n.type} - ${n.name}`,
                value: n.id,
              }))}
              placeholder="选择源节点"
            />
          </Form.Item>
          <Form.Item label="目标节点" name="target" rules={[{ required: true }]}>
            <Select
              options={(workflow.nodes || []).map((n) => ({
                label: `${nodeTypeLabels[n.type] || n.type} - ${n.name}`,
                value: n.id,
              }))}
              placeholder="选择目标节点"
            />
          </Form.Item>
          <Form.Item label="条件表达式" name="condition">
            <Input placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

const WorkflowCanvas: React.FC<WorkflowCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
};

export default WorkflowCanvas;
