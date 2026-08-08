/**
 * CI/CD Trigger Engine (P2-24)
 * Pipeline 触发引擎 — 手动/代码推送/定时计划/Webhook 触发规则管理
 *
 * Features:
 * - Trigger rule CRUD (push/schedule/webhook/manual)
 * - Pipeline-run mapping
 * - Schedule expression editor (cron)
 * - Webhook endpoint management
 * - Trigger execution history
 */

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Table, Button, Modal, Form, Input, Select, Tag, Switch, message, Space, Statistic, Tooltip } from 'antd';
import {
  FireOutlined,
  GitlabOutlined,
  ClockCircleOutlined,
  LinkOutlined,
  UserOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { getPipelines, triggerPipeline, type Pipeline } from '@/api/pipelines';

const { Title, Text } = Typography;
const { Option } = Select;

// ==================== Types ====================

type TriggerType = 'manual' | 'push' | 'schedule' | 'webhook' | 'api';
type TriggerStatus = 'active' | 'disabled' | 'failed';
type TriggerEvent = 'push' | 'pull_request' | 'tag' | 'schedule' | 'webhook' | 'manual' | 'api';

interface TriggerRule {
  id: string;
  name: string;
  pipelineId: string;
  pipelineName: string;
  type: TriggerType;
  event: TriggerEvent;
  condition?: string;
  schedule?: string;
  branchPattern?: string;
  webhookSecret?: string;
  webhookUrl?: string;
  enabled: boolean;
  status: TriggerStatus;
  lastTriggered?: string;
  successCount: number;
  failCount: number;
  createdAt: string;
}

interface TriggerExecution {
  id: string;
  triggerRuleId: string;
  pipelineId: string;
  runId?: string;
  event: TriggerEvent;
  status: 'success' | 'failed' | 'running';
  message?: string;
  payload?: Record<string, unknown>;
  triggeredAt: string;
  durationMs?: number;
}

// ==================== Config ====================

const TRIGGER_TYPES: Array<{ type: TriggerType; label: string; icon: React.ReactNode; color: string; description: string }> = [
  { type: 'manual', label: '手动触发', icon: <UserOutlined />, color: colors.primary[500], description: '用户点击按钮手动执行 Pipeline' },
  { type: 'push', label: '代码推送', icon: <GitlabOutlined />, color: colors.success[500], description: 'Git push 自动触发' },
  { type: 'schedule', label: '定时计划', icon: <ClockCircleOutlined />, color: colors.warning[500], description: 'Cron 表达式定时触发' },
  { type: 'webhook', label: 'Webhook', icon: <LinkOutlined />, color: colors.info[500], description: '外部系统 Webhook 触发' },
  { type: 'api', label: 'API 调用', icon: <CodeOutlined />, color: colors.neutral[500], description: '通过 API 接口触发' },
];

const DEFAULT_RULES: TriggerRule[] = [
  {
    id: 'tr-001',
    name: 'PR 合并触发部署',
    pipelineId: 'pipe-deploy-prod',
    pipelineName: 'Production Deploy',
    type: 'push',
    event: 'push',
    condition: 'branch == "main"',
    branchPattern: 'main',
    enabled: true,
    status: 'active',
    lastTriggered: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    successCount: 142,
    failCount: 3,
    createdAt: '2026-06-15T08:00:00Z',
  },
  {
    id: 'tr-002',
    name: '每日定时健康检查',
    pipelineId: 'pipe-health-check',
    pipelineName: 'Daily Health Check',
    type: 'schedule',
    event: 'schedule',
    schedule: '0 8 * * *',
    enabled: true,
    status: 'active',
    lastTriggered: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
    successCount: 45,
    failCount: 0,
    createdAt: '2026-06-20T10:00:00Z',
  },
  {
    id: 'tr-003',
    name: 'GitHub Webhook 触发 CI',
    pipelineId: 'pipe-ci-main',
    pipelineName: 'CI Main',
    type: 'webhook',
    event: 'push',
    webhookSecret: 'whsec_abc123',
    webhookUrl: '/api/v1/webhooks/github',
    branchPattern: 'feature/*',
    enabled: true,
    status: 'active',
    lastTriggered: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    successCount: 289,
    failCount: 12,
    createdAt: '2026-06-10T08:00:00Z',
  },
  {
    id: 'tr-004',
    name: '手动触发金丝雀部署',
    pipelineId: 'pipe-canary',
    pipelineName: 'Canary Deploy',
    type: 'manual',
    event: 'manual',
    enabled: true,
    status: 'active',
    lastTriggered: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    successCount: 23,
    failCount: 1,
    createdAt: '2026-07-01T08:00:00Z',
  },
  {
    id: 'tr-005',
    name: '定时清理过期制品',
    pipelineId: 'pipe-artifact-cleanup',
    pipelineName: 'Artifact Cleanup',
    type: 'schedule',
    event: 'schedule',
    schedule: '0 3 * * 0',
    enabled: false,
    status: 'disabled',
    lastTriggered: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    successCount: 8,
    failCount: 2,
    createdAt: '2026-07-05T08:00:00Z',
  },
  {
    id: 'tr-006',
    name: '外部 API 触发回归测试',
    pipelineId: 'pipe-regression',
    pipelineName: 'Regression Test',
    type: 'api',
    event: 'api',
    branchPattern: 'develop',
    enabled: true,
    status: 'active',
    lastTriggered: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    successCount: 67,
    failCount: 5,
    createdAt: '2026-07-10T08:00:00Z',
  },
];

// ==================== Main Component ====================

const CITriggers: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<TriggerRule[]>(DEFAULT_RULES);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [executions, setExecutions] = useState<TriggerExecution[]>([]);
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [execModal, setExecModal] = useState(false);
  const [selectedRule, setSelectedRule] = useState<TriggerRule | null>(null);
  const [selectedType, setSelectedType] = useState<TriggerType>('manual');
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  useEffect(() => {
    loadPipelines();
  }, []);

  const loadPipelines = async () => {
    try {
      const res = await getPipelines().catch(() => null);
      const list = (res as any)?.data ?? (res as any) ?? [];
      setPipelines(Array.isArray(list) ? list : []);
    } catch {
      setPipelines([]);
    }
  };

  const handleCreate = (values: Record<string, unknown>) => {
    const newRule: TriggerRule = {
      id: 'tr-' + Date.now(),
      name: values.name as string,
      pipelineId: (values.pipelineId as string) || 'pipe-unknown',
      pipelineName: (values.pipelineName as string) || 'Unknown',
      type: selectedType,
      event: (values.event as TriggerEvent) || 'manual',
      condition: values.condition as string,
      schedule: values.schedule as string,
      branchPattern: values.branchPattern as string,
      webhookSecret: values.webhookSecret as string,
      webhookUrl: values.webhookUrl as string,
      enabled: true,
      status: 'active',
      successCount: 0,
      failCount: 0,
      createdAt: new Date().toISOString(),
    };
    setRules([...rules, newRule]);
    setCreateModal(false);
    form.resetFields();
    message.success('触发规则已创建');
  };

  const handleEdit = (values: Record<string, unknown>) => {
    if (!selectedRule) return;
    setRules(rules.map((r) => r.id === selectedRule.id ? {
      ...r,
      name: values.name as string || r.name,
      condition: values.condition as string || r.condition,
      schedule: values.schedule as string || r.schedule,
      branchPattern: values.branchPattern as string || r.branchPattern,
      webhookSecret: values.webhookSecret as string || r.webhookSecret,
      webhookUrl: values.webhookUrl as string || r.webhookUrl,
      enabled: values.enabled ?? r.enabled,
    } : r) as TriggerRule[]);
    setEditModal(false);
    setSelectedRule(null);
    message.success('触发规则已更新');
  };

  const handleDelete = (id: string) => {
    setRules(rules.filter((r) => r.id !== id));
    message.success('触发规则已删除');
  };

  const handleToggle = (id: string, enabled: boolean) => {
    setRules(rules.map((r) => r.id === id ? {
      ...r,
      enabled,
      status: enabled ? 'active' : 'disabled',
    } : r) as TriggerRule[]);
    message.success(enabled ? '触发规则已启用' : '触发规则已禁用');
  };

  const handleExecute = async (rule: TriggerRule) => {
    setLoading(true);
    try {
      if (rule.pipelineId) {
        await triggerPipeline(rule.pipelineId, { branch: rule.branchPattern });
        message.success(`Pipeline ${rule.pipelineName} 已触发`);
      } else {
        message.warning('无法触发：未关联 Pipeline');
      }
      // Add to execution history
      const exec: TriggerExecution = {
        id: 'exec-' + Date.now(),
        triggerRuleId: rule.id,
        pipelineId: rule.pipelineId,
        event: 'manual',
        status: 'success',
        triggeredAt: new Date().toISOString(),
      };
      setExecutions([exec, ...executions]);
      // Update rule stats
      setRules(rules.map((r) => r.id === rule.id ? {
        ...r,
        lastTriggered: new Date().toISOString(),
        successCount: r.successCount + 1,
      } : r) as TriggerRule[]);
    } catch {
      message.error('触发失败');
    } finally {
      setLoading(false);
    }
  };

  const activeCount = rules.filter((r) => r.enabled).length;
  const totalSuccess = rules.reduce((s, r) => s + r.successCount, 0);
  const totalFail = rules.reduce((s, r) => s + r.failCount, 0);

  const ruleColumns = [
    { title: '规则名称', dataIndex: 'name', key: 'name', render: (v: string) => <Text strong>{v}</Text> },
    {
      title: '类型', key: 'type',
      dataIndex: 'type',
      render: (t: TriggerType) => {
        const info = TRIGGER_TYPES.find((ti) => ti.type === t);
        return <Tag color={info?.color}>{info?.label}</Tag>;
      },
    },
    {
      title: 'Pipeline', dataIndex: 'pipelineName', key: 'pipelineName',
      render: (v: string) => v ? <Text code>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: '条件', dataIndex: 'condition', key: 'condition',
      render: (v: string) => v ? <Text code>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: '成功率', key: 'rate',
      render: (_: unknown, r: TriggerRule) => {
        const total = r.successCount + r.failCount;
        const rate = total > 0 ? Math.round(r.successCount / total * 100) : 100;
        return <Tag color={rate >= 95 ? 'green' : rate >= 80 ? 'orange' : 'red'}>{rate}%</Tag>;
      },
    },
    {
      title: '最近触发', dataIndex: 'lastTriggered', key: 'lastTriggered',
      render: (v: string) => v ? new Date(v).toLocaleString() : '—',
    },
    {
      title: '启用', key: 'enabled',
      dataIndex: 'enabled',
      render: (enabled: boolean, r: TriggerRule) => (
        <Switch checked={enabled} onChange={() => handleToggle(r.id, !enabled)} size="small" />
      ),
    },
    {
      title: '操作', key: 'actions',
      render: (_: unknown, r: TriggerRule) => (
        <Space size="small">
          <Tooltip title="手动触发"><Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleExecute(r)} /></Tooltip>
          <Tooltip title="编辑"><Button size="small" icon={<EditOutlined />} onClick={() => { setSelectedRule(r); editForm.setFieldsValue(r); setEditModal(true); }} /></Tooltip>
          <Tooltip title="删除"><Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)} /></Tooltip>
        </Space>
      ),
    },
  ];

  const execColumns = [
    { title: '触发器', key: 'triggerRuleId', dataIndex: 'triggerRuleId', render: (id: string) => <Text code>{id}</Text> },
    { title: 'Pipeline', dataIndex: 'pipelineId', key: 'pipelineId', render: (v: string) => <Text code>{v}</Text> },
    { title: '事件', dataIndex: 'event', key: 'event', render: (v: string) => <Tag>{v}</Tag> },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (v: string) => <Tag color={v === 'success' ? 'green' : v === 'failed' ? 'red' : 'blue'}>{v}</Tag>,
    },
    {
      title: '时间', dataIndex: 'triggeredAt', key: 'triggeredAt',
      render: (v: string) => v ? new Date(v).toLocaleString() : '—',
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <Col>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <FireOutlined style={{ marginRight: 12, color: colors.error[500] }} />
            CI/CD 触发引擎
          </Title>
          <Text type="secondary">Pipeline 触发规则管理 · 手动/推送/定时/Webhook/API 触发</Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadPipelines} loading={loading}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>新建触发规则</Button>
          </Space>
        </Col>
      </Row>

      {/* Stats Row */}
      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Card>
            <Statistic title="触发规则总数" value={rules.length} prefix={<FireOutlined />} valueStyle={{ color: colors.primary[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已启用" value={activeCount} prefix={<UserOutlined />} valueStyle={{ color: colors.success[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总触发成功" value={totalSuccess} prefix={<PlayCircleOutlined />} valueStyle={{ color: colors.info[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总触发失败" value={totalFail} prefix={<DeleteOutlined />} valueStyle={{ color: colors.error[500] }} />
          </Card>
        </Col>
      </Row>

      {/* Trigger Type Cards */}
      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        {TRIGGER_TYPES.map((tt) => {
          const count = rules.filter((r) => r.type === tt.type).length;
          return (
            <Col span={4} key={tt.type}>
              <Card
                size="small"
                hoverable
                style={{ textAlign: 'center', border: `1px solid ${tt.color}22` }}
                onClick={() => { setSelectedType(tt.type); setCreateModal(true); }}
              >
                <div style={{ fontSize: 24, color: tt.color, marginBottom: 4 }}>{tt.icon}</div>
                <Text strong>{tt.label}</Text>
                <div style={{ marginBottom: 4 }}><Statistic value={count} /></div>
                <Text type="secondary" style={{ fontSize: 11 }}>{tt.description}</Text>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* Trigger Rules Table */}
      <Card title="触发规则" style={{ marginBottom: spacing.md }}>
        <Table
          columns={ruleColumns}
          dataSource={rules}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10, showSizeChanger: false }}
        />
      </Card>

      {/* Execution History */}
      <Card title="触发执行历史" extra={<Button size="small" onClick={() => setExecModal(true)}>查看更多</Button>}>
        <Table
          columns={execColumns}
          dataSource={executions.slice(0, 10)}
          rowKey="id"
          size="small"
          pagination={false}
          locale={{ emptyText: '暂无执行记录，点击触发规则手动触发' }}
        />
      </Card>

      {/* Create Rule Modal */}
      <Modal
        title="新建触发规则"
        open={createModal}
        onCancel={() => { setCreateModal(false); form.resetFields(); }}
        onOk={() => form.validateFields().then(handleCreate)}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="规则名称" name="name" rules={[{ required: true }]}>
            <Input placeholder="e.g. PR 合并触发部署" />
          </Form.Item>
          <Form.Item label="触发类型" name="type">
            <Select value={selectedType} onChange={setSelectedType}>
              {TRIGGER_TYPES.map((tt) => <Option key={tt.type} value={tt.type}>{tt.label}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item label="关联 Pipeline" name="pipelineId">
            <Select placeholder="选择 Pipeline" showSearch optionFilterProp="children">
              {pipelines.map((p: Pipeline) => (
                <Option key={p.id} value={p.id}>{p.name || p.id}</Option>
              ))}
            </Select>
          </Form.Item>
          {selectedType === 'push' && (
            <Form.Item label="分支匹配模式" name="branchPattern">
              <Input placeholder="e.g. main, feature/*, release/*" />
            </Form.Item>
          )}
          {selectedType === 'schedule' && (
            <Form.Item label="Cron 表达式" name="schedule" rules={[{ required: true }]}>
              <Input placeholder="e.g. 0 8 * * * (每天 8:00)" />
            </Form.Item>
          )}
          {selectedType === 'webhook' && (
            <>
              <Form.Item label="Webhook URL" name="webhookUrl">
                <Input placeholder="/api/v1/webhooks/..." />
              </Form.Item>
              <Form.Item label="Webhook Secret" name="webhookSecret">
                <Input.Password placeholder="whsec_..." />
              </Form.Item>
            </>
          )}
          <Form.Item label="触发条件" name="condition">
            <Input placeholder='e.g. branch == "main"' />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Rule Modal */}
      <Modal
        title="编辑触发规则"
        open={editModal}
        onCancel={() => { setEditModal(false); setSelectedRule(null); }}
        onOk={() => editForm.validateFields().then(handleEdit)}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item label="规则名称" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="启用" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="条件" name="condition">
            <Input />
          </Form.Item>
          <Form.Item label="分支匹配" name="branchPattern">
            <Input />
          </Form.Item>
          {selectedRule?.type === 'schedule' && (
            <Form.Item label="Cron 表达式" name="schedule">
              <Input />
            </Form.Item>
          )}
          {selectedRule?.type === 'webhook' && (
            <>
              <Form.Item label="Webhook URL" name="webhookUrl">
                <Input />
              </Form.Item>
              <Form.Item label="Webhook Secret" name="webhookSecret">
                <Input.Password />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* Execution History Modal */}
      <Modal
        title="触发执行历史"
        open={execModal}
        onCancel={() => setExecModal(false)}
        footer={null}
        width={800}
      >
        <Table
          columns={execColumns}
          dataSource={executions}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: '暂无执行记录' }}
        />
      </Modal>
    </div>
  );
};

export default CITriggers;
