/**
 * AgentOrchestrator Page (P3-09)
 * Multi-Agent Orchestration Dashboard
 * - Top: 4 stat cards (registered agents, active orchestrations, success rate, avg duration)
 * - Middle: Orchestration task table (left) + Agent registry (right)
 * - Bottom: Recent execution history
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Row,
  Col,
  Card,
  Table,
  Tag,
  Button,
  Switch,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
} from 'antd';
import {
  ClusterOutlined,
  RocketOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  StopOutlined,
  BranchesOutlined,
} from '@ant-design/icons';
import { colors, spacing, componentRadius, shadows } from '@/tokens';
import {
  getAgentProfiles,
  getAgentRuns,
  createAgentProfile,
  cancelAgentRun,
  toggleAgentProfile,
  type AgentProfile,
  type AgentRun,
} from '@/api/agents';

const { Title, Text } = Typography;
const { Option } = Select;

// ============================================================================
// Types
// ============================================================================

type OrchestrationStatus = 'running' | 'success' | 'failed' | 'waiting';
type AgentRole = 'orchestrator' | 'supervisor' | 'critic' | 'worker' | 'tool';

interface OrchestrationTask {
  id: string;
  name: string;
  agentCount: number;
  status: OrchestrationStatus;
  currentStep: string;
  totalSteps: number;
  startedAt: string;
  duration: number; // seconds
}

interface AgentRecord {
  id: string;
  name: string;
  role: AgentRole;
  status: 'active' | 'idle' | 'error';
  specialization: string;
  enabled: boolean;
}

interface ExecutionHistory {
  id: string;
  timestamp: string;
  orchestrationName: string;
  result: OrchestrationStatus;
  duration: number;
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_ORCHESTRATIONS: OrchestrationTask[] = [
  {
    id: 'orch-001',
    name: '智能发布编排',
    agentCount: 5,
    status: 'running',
    currentStep: '代码审查',
    totalSteps: 6,
    startedAt: '2026-08-08 14:23:00',
    duration: 342,
  },
  {
    id: 'orch-002',
    name: '告警根因分析',
    agentCount: 4,
    status: 'success',
    currentStep: '完成',
    totalSteps: 5,
    startedAt: '2026-08-08 13:10:00',
    duration: 189,
  },
  {
    id: 'orch-003',
    name: '安全漏洞检测',
    agentCount: 6,
    status: 'failed',
    currentStep: '报告生成',
    totalSteps: 7,
    startedAt: '2026-08-08 12:45:00',
    duration: 523,
  },
  {
    id: 'orch-004',
    name: '知识库自动更新',
    agentCount: 3,
    status: 'waiting',
    currentStep: '排队中',
    totalSteps: 4,
    startedAt: '2026-08-08 12:00:00',
    duration: 0,
  },
  {
    id: 'orch-005',
    name: '性能基准测试',
    agentCount: 4,
    status: 'success',
    currentStep: '完成',
    totalSteps: 5,
    startedAt: '2026-08-08 11:30:00',
    duration: 467,
  },
  {
    id: 'orch-006',
    name: '文档一致性校验',
    agentCount: 3,
    status: 'running',
    currentStep: '交叉引用检查',
    totalSteps: 4,
    startedAt: '2026-08-08 11:15:00',
    duration: 210,
  },
  {
    id: 'orch-007',
    name: 'CI/CD 流水线优化',
    agentCount: 5,
    status: 'success',
    currentStep: '完成',
    totalSteps: 6,
    startedAt: '2026-08-08 10:00:00',
    duration: 892,
  },
  {
    id: 'orch-008',
    name: '依赖升级影响分析',
    agentCount: 7,
    status: 'waiting',
    currentStep: '排队中',
    totalSteps: 8,
    startedAt: '2026-08-08 09:30:00',
    duration: 0,
  },
];

const MOCK_AGENTS: AgentRecord[] = [
  {
    id: 'agent-001',
    name: 'Orion Orchestrator',
    role: 'orchestrator',
    status: 'active',
    specialization: '任务分解与调度',
    enabled: true,
  },
  {
    id: 'agent-002',
    name: 'Code Supervisor',
    role: 'supervisor',
    status: 'active',
    specialization: '代码质量监控',
    enabled: true,
  },
  {
    id: 'agent-003',
    name: 'Security Critic',
    role: 'critic',
    status: 'idle',
    specialization: '安全漏洞审查',
    enabled: true,
  },
  {
    id: 'agent-004',
    name: 'Deploy Worker',
    role: 'worker',
    status: 'active',
    specialization: '部署执行',
    enabled: true,
  },
  {
    id: 'agent-005',
    name: 'Log Analyzer',
    role: 'worker',
    status: 'idle',
    specialization: '日志分析',
    enabled: true,
  },
  {
    id: 'agent-006',
    name: 'Slack Bot',
    role: 'tool',
    status: 'active',
    specialization: '消息通知',
    enabled: true,
  },
  {
    id: 'agent-007',
    name: 'Doc Validator',
    role: 'critic',
    status: 'error',
    specialization: '文档规范校验',
    enabled: false,
  },
  {
    id: 'agent-008',
    name: 'Test Runner',
    role: 'worker',
    status: 'idle',
    specialization: '自动化测试执行',
    enabled: true,
  },
];

const MOCK_EXECUTIONS: ExecutionHistory[] = [
  {
    id: 'exec-001',
    timestamp: '2026-08-08 14:30:00',
    orchestrationName: '智能发布编排',
    result: 'running',
    duration: 342,
  },
  {
    id: 'exec-002',
    timestamp: '2026-08-08 13:45:00',
    orchestrationName: '告警根因分析',
    result: 'success',
    duration: 189,
  },
  {
    id: 'exec-003',
    timestamp: '2026-08-08 13:10:00',
    orchestrationName: '性能基准测试',
    result: 'success',
    duration: 467,
  },
  {
    id: 'exec-004',
    timestamp: '2026-08-08 12:48:00',
    orchestrationName: '安全漏洞检测',
    result: 'failed',
    duration: 523,
  },
  {
    id: 'exec-005',
    timestamp: '2026-08-08 11:42:00',
    orchestrationName: '文档一致性校验',
    result: 'success',
    duration: 156,
  },
];

// ============================================================================
// Helpers
// ============================================================================

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
};

const statusTag = (status: OrchestrationStatus): React.ReactNode => {
  const config: Record<OrchestrationStatus, { color: string; label: string }> = {
    running: { color: colors.info[500], label: '运行中' },
    success: { color: colors.success[500], label: '成功' },
    failed: { color: colors.error[500], label: '失败' },
    waiting: { color: colors.neutral[500], label: '等待' },
  };
  const { color, label } = config[status];
  return <Tag style={{ color, borderColor: color }}>{label}</Tag>;
};

const agentRoleTag = (role: AgentRole): React.ReactNode => {
  const config: Record<AgentRole, { color: string; label: string }> = {
    orchestrator: { color: colors.purple[500], label: 'Orchestrator' },
    supervisor: { color: colors.info[500], label: 'Supervisor' },
    critic: { color: colors.warning[500], label: 'Critic' },
    worker: { color: colors.success[500], label: 'Worker' },
    tool: { color: colors.neutral[500], label: 'Tool' },
  };
  const { color, label } = config[role];
  return <Tag style={{ color, borderColor: color }}>{label}</Tag>;
};

const agentStatusDot = (status: AgentRecord['status']): React.ReactNode => {
  const colorMap: Record<string, string> = {
    active: colors.success[500],
    idle: colors.neutral[500],
    error: colors.error[500],
  };
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colorMap[status],
        marginRight: spacing.sm,
      }}
    />
  );
};

// ============================================================================
// Main Component
// ============================================================================

const AgentOrchestrator: React.FC = () => {
  const [orchestrations, setOrchestrations] = useState<OrchestrationTask[]>(MOCK_ORCHESTRATIONS);
  const [agents, setAgents] = useState<AgentRecord[]>(MOCK_AGENTS);
  const [addAgentModalOpen, setAddAgentModalOpen] = useState(false);
  const [dagModalOpen, setDagModalOpen] = useState(false);
  const [selectedOrchestration, setSelectedOrchestration] = useState<OrchestrationTask | null>(null);
  const [form] = Form.useForm();

  // ---- Load data from API ----
  useEffect(() => {
    loadAgents();
    loadRuns();
  }, []);

  const loadAgents = async () => {
    try {
      const res = await getAgentProfiles();
      const profiles = res.data as AgentProfile[];
      if (Array.isArray(profiles) && profiles.length > 0) {
        const mapped: AgentRecord[] = profiles.map((p) => ({
          id: p.id,
          name: p.name,
          role: p.role as AgentRole,
          status: p.enabled ? 'active' : 'idle',
          specialization: p.description || '-',
          enabled: p.enabled,
        }));
        setAgents(mapped);
      } else {
        setAgents([]);
      }
    } catch {
      setAgents([]);
    }
  };

  const loadRuns = async () => {
    try {
      const res = await getAgentRuns();
      const runs = res.data as AgentRun[];
      if (Array.isArray(runs) && runs.length > 0) {
        const mapped: OrchestrationTask[] = runs.map((r) => ({
          id: r.id,
          name: r.workflowId || r.id,
          agentCount: r.totalSteps,
          status: mapRunStatus(r.status),
          currentStep: `步骤 ${r.currentStep + 1}`,
          totalSteps: r.totalSteps,
          startedAt: r.startedAt,
          duration: r.completedAt
            ? Math.round((new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()) / 1000)
            : 0,
        }));
        setOrchestrations(mapped);
      }
    } catch {
    }
  };

  const mapRunStatus = (status: string): OrchestrationStatus => {
    if (status === 'running' || status === 'waiting_approval') return 'running';
    if (status === 'completed') return 'success';
    if (status === 'failed' || status === 'cancelled') return 'failed';
    return 'waiting';
  };

  // ---- Derived stats ----
  const registeredAgentCount = agents.length;
  const activeOrchestrationCount = orchestrations.filter((o) => o.status === 'running').length;
  const completedOrchestrations = orchestrations.filter((o) => o.status === 'success');
  const successRate =
    orchestrations.length > 0
      ? Math.round((completedOrchestrations.length / orchestrations.length) * 100)
      : 0;
  const avgDuration =
    completedOrchestrations.length > 0
      ? Math.round(
          completedOrchestrations.reduce((acc, o) => acc + o.duration, 0) /
            completedOrchestrations.length
        )
      : 0;

  // ---- Table columns ----
  const orchestrationColumns = useMemo(
    () => [
      {
        title: '编排名称',
        dataIndex: 'name',
        key: 'name',
        width: 160,
      },
      {
        title: 'Agent 数量',
        dataIndex: 'agentCount',
        key: 'agentCount',
        width: 100,
        render: (val: number) => <Text>{val}</Text>,
      },
      {
        title: '当前状态',
        dataIndex: 'status',
        key: 'status',
        width: 90,
        render: (val: OrchestrationStatus) => statusTag(val),
      },
      {
        title: '执行步骤',
        key: 'step',
        width: 130,
        render: (_: unknown, record: OrchestrationTask) => (
          <Text>{record.currentStep} ({record.totalSteps})</Text>
        ),
      },
      {
        title: '开始时间',
        dataIndex: 'startedAt',
        key: 'startedAt',
        width: 170,
      },
      {
        title: '耗时',
        dataIndex: 'duration',
        key: 'duration',
        width: 100,
        render: (val: number) => formatDuration(val),
      },
      {
        title: '操作',
        key: 'action',
        width: 200,
        render: (_: unknown, record: OrchestrationTask) => (
          <Space size={spacing.sm}>
            <Button
              size="small"
              type="primary"
              icon={<BranchesOutlined />}
              onClick={() => handleViewDag(record)}
            >
              查看 DAG
            </Button>
            <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleRerun(record)}>
              重跑
            </Button>
            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => handleStop(record)}
              disabled={record.status === 'success' || record.status === 'failed'}
            >
              停止
            </Button>
          </Space>
        ),
      },
    ],
    []
  );

  // ---- Handlers ----
  const handleViewDag = (orch: OrchestrationTask) => {
    setSelectedOrchestration(orch);
    setDagModalOpen(true);
  };

  const handleRerun = (orch: OrchestrationTask) => {
    message.info(`重新运行编排: ${orch.name}`);
  };

  const handleStop = (orch: OrchestrationTask) => {
    Modal.confirm({
      title: '停止编排',
      content: `确定要停止编排 "${orch.name}" 吗？当前运行中的步骤将被中断。`,
      okText: '停止',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await cancelAgentRun(orch.id);
          setOrchestrations((prev) =>
            prev.map((o) => (o.id === orch.id ? { ...o, status: 'failed' } : o))
          );
          message.warning(`编排 ${orch.name} 已停止`);
        } catch {
          message.error('停止编排失败');
        }
      },
    });
  };

  const handleToggleAgent = async (agent: AgentRecord) => {
    try {
      await toggleAgentProfile(agent.id);
      setAgents((prev) =>
        prev.map((a) => (a.id === agent.id ? { ...a, enabled: !a.enabled } : a))
      );
      message.success(`Agent ${agent.name} 已${agent.enabled ? '禁用' : '启用'}`);
    } catch {
      message.error('切换 Agent 状态失败');
    }
  };

  const handleAddAgent = async () => {
    form.validateFields().then(async (values) => {
      try {
        const profileData = {
          name: values.name,
          role: values.role,
          description: values.specialization || '',
          tools: [],
          enabled: true,
        };
        const res = await createAgentProfile(profileData);
        const created = res.data as AgentProfile;
        const newAgent: AgentRecord = {
          id: created.id,
          name: created.name,
          role: created.role as AgentRole,
          status: 'idle',
          specialization: created.description || '-',
          enabled: created.enabled,
        };
        setAgents((prev) => [...prev, newAgent]);
        setAddAgentModalOpen(false);
        form.resetFields();
        message.success(`Agent ${newAgent.name} 已添加`);
      } catch {
        message.error('添加 Agent 失败');
      }
    });
  };

  return (
    <div style={{ padding: 0 }} data-testid="agent-orchestrator-page">
      {/* ==================== Page Header ==================== */}
      <div
        style={{
          marginBottom: spacing.lg,
        }}
      >
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <ClusterOutlined style={{ marginRight: spacing[3], color: colors.purple[500] }} />
          Agent 多智能体编排
        </Title>
        <Text type="secondary">Orchestrator · Supervisor · Critic · Agent DAG</Text>
      </div>

      {/* ==================== Stat Cards ==================== */}
      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <StatCard
            title="注册 Agent 数"
            value={registeredAgentCount.toString()}
            icon={<RocketOutlined />}
            color={colors.purple[500]}
          />
        </Col>
        <Col span={6}>
          <StatCard
            title="活跃编排数"
            value={activeOrchestrationCount.toString()}
            icon={<ClockCircleOutlined />}
            color={colors.info[500]}
          />
        </Col>
        <Col span={6}>
          <StatCard
            title="执行成功率"
            value={`${successRate}%`}
            icon={<CheckCircleOutlined />}
            color={colors.success[500]}
          />
        </Col>
        <Col span={6}>
          <StatCard
            title="平均执行时间"
            value={`${avgDuration}s`}
            icon={<ThunderboltOutlined />}
            color={colors.warning[500]}
          />
        </Col>
      </Row>

      {/* ==================== Main Content Row ==================== */}
      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        {/* Left: Orchestration Task Table */}
        <Col span={14}>
          <Card
            title="编排任务列表"
            bordered={false}
            style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
            bodyStyle={{ padding: spacing.md, maxHeight: 420, overflowY: 'auto' }}
          >
            <Table
              dataSource={orchestrations}
              columns={orchestrationColumns}
              rowKey="id"
              pagination={false}
              size="middle"
              rowHoverable
              style={{ width: '100%' }}
            />
          </Card>
        </Col>

        {/* Right: Agent Registry */}
        <Col span={10}>
          <Card
            title={
              <Space>
                <span>Agent 注册表</span>
              </Space>
            }
            extra={
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setAddAgentModalOpen(true)}
              >
                添加 Agent
              </Button>
            }
            bordered={false}
            style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
            bodyStyle={{ padding: spacing.md, maxHeight: 420, overflowY: 'auto' }}
          >
            <div>
              {agents.map((agent, index) => (
                <div
                  key={agent.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: `${spacing.sm}px 0`,
                    borderBottom:
                      index < agents.length - 1
                        ? `1px solid ${colors.light.border.light}`
                        : 'none',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ color: colors.neutral[900], fontWeight: 600 }}>
                        {agent.name}
                      </span>
                      <span style={{ marginLeft: 6 }}>{agentRoleTag(agent.role)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                      {agentStatusDot(agent.status)}
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {agent.specialization}
                      </Text>
                    </div>
                  </div>
                  <div>
                    <Switch
                      size="small"
                      checked={agent.enabled}
                      onChange={() => handleToggleAgent(agent)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* ==================== Execution History ==================== */}
      <Card
        title="执行历史"
        bordered={false}
        style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
        bodyStyle={{ padding: spacing.md }}
      >
        <Table
          dataSource={MOCK_EXECUTIONS}
          columns={[
            {
              title: '时间',
              dataIndex: 'timestamp',
              key: 'timestamp',
              width: 200,
            },
            {
              title: '编排',
              dataIndex: 'orchestrationName',
              key: 'orchestrationName',
            },
            {
              title: '结果',
              dataIndex: 'result',
              key: 'result',
              width: 100,
              render: (val: OrchestrationStatus) => statusTag(val),
            },
            {
              title: '耗时',
              dataIndex: 'duration',
              key: 'duration',
              width: 100,
              render: (val: number) => formatDuration(val),
            },
          ]}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      </Card>

      {/* ==================== DAG Modal ==================== */}
      <Modal
        title={`DAG 拓扑: ${selectedOrchestration?.name || ''}`}
        open={dagModalOpen}
        onCancel={() => setDagModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDagModalOpen(false)}>
            关闭
          </Button>,
        ]}
        style={{ borderRadius: componentRadius.modal }}
      >
        {selectedOrchestration && (
          <div style={{ padding: spacing.md }}>
            <Text type="secondary">
              编排: {selectedOrchestration.name} | 步骤: {selectedOrchestration.totalSteps} | 当前: {selectedOrchestration.currentStep}
            </Text>
            <div
              style={{
                marginTop: spacing.md,
                display: 'flex',
                flexDirection: 'column',
                gap: spacing.sm,
              }}
            >
              {Array.from({ length: selectedOrchestration.totalSteps }, (_, i) => {
                const stepNumber = i + 1;
                const stepNames = [
                  '任务分解',
                  'Agent 分配',
                  '并行执行',
                  '结果聚合',
                  '质量评审',
                  '报告生成',
                  '发布审批',
                  '通知推送',
                ];
                const stepName = stepNames[stepNumber - 1] || `步骤 ${stepNumber}`;
                const isActive = stepNumber <= selectedOrchestration.totalSteps && selectedOrchestration.status === 'running' && stepNumber === 3;
                const isDone = selectedOrchestration.status === 'success' || stepNumber < 3;

                return (
                  <div
                    key={stepNumber}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: `${spacing.sm}px ${spacing.md}px`,
                      borderRadius: componentRadius.button.sm,
                      backgroundColor: isDone ? colors.success[50] : isActive ? colors.info[50] : colors.light.bg.secondary,
                      borderLeft: `3px solid ${isDone ? colors.success[500] : isActive ? colors.info[500] : colors.neutral[300]}`,
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, marginRight: spacing.md, width: 32 }}>
                      {stepNumber}.
                    </span>
                    <span style={{ color: isDone ? colors.success[500] : isActive ? colors.info[500] : colors.neutral[500] }}>
                      {stepName}
                    </span>
                    <Tag
                      style={{
                        marginLeft: 'auto',
                        color: isDone ? colors.success[500] : isActive ? colors.info[500] : colors.neutral[500],
                        borderColor: isDone ? colors.success[500] : isActive ? colors.info[500] : colors.neutral[300],
                      }}
                    >
                      {isDone ? '已完成' : isActive ? '执行中' : '待执行'}
                    </Tag>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>

      {/* ==================== Add Agent Modal ==================== */}
      <Modal
        title="添加 Agent"
        open={addAgentModalOpen}
        onCancel={() => {
          setAddAgentModalOpen(false);
          form.resetFields();
        }}
        onOk={handleAddAgent}
        okText="添加"
        cancelText="取消"
        style={{ borderRadius: componentRadius.modal }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
          <Form.Item
            label="Agent 名称"
            name="name"
            rules={[{ required: true, message: '请输入 Agent 名称' }]}
          >
            <Input placeholder="例: Data Inspector" />
          </Form.Item>
          <Form.Item
            label="角色"
            name="role"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="选择 Agent 角色">
              <Option value="orchestrator">Orchestrator</Option>
              <Option value="supervisor">Supervisor</Option>
              <Option value="critic">Critic</Option>
              <Option value="worker">Worker</Option>
              <Option value="tool">Tool</Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="专业化领域"
            name="specialization"
            rules={[{ required: true, message: '请输入专业化领域' }]}
          >
            <Input placeholder="例: 数据质量检测" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ============================================================================
// Stat Card Sub-component
// ============================================================================

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => {
  return (
    <Card
      bordered={false}
      style={{
        borderRadius: componentRadius.card,
        boxShadow: shadows.card,
        backgroundColor: colors.light.bg.primary,
        borderLeft: `3px solid ${color}`,
        padding: `${spacing.md}px ${spacing.lg}px`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {title}
          </Text>
          <div style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 28, fontWeight: 600, color: color }}>{value}</Text>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: componentRadius.card,
            backgroundColor: `${color}15`,
            color: color,
            fontSize: 20,
          }}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
};

export default AgentOrchestrator;
