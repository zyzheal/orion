/**
 * DBA Multi-stage Approval Workflows page
 *
 * Manages approval workflow templates and instance progression. Each
 * instance represents one order submitted for multi-step approval;
 * approvers can approve/reject/escalate each step in the DAG.
 *
 * Tabs: Workflows | Instances
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Modal,
  Form,
  Input,
  Select,
  message,
  Tabs,
  Spin,
  Empty,
  Drawer,
  Descriptions,
  Steps,
  InputNumber,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  CheckOutlined,
  CloseOutlined,
  ArrowUpOutlined,
  SafetyCertificateOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import PageSkeleton from '@/components/PageSkeleton';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import {
  listApprovalWorkflows,
  listApprovalInstances,
  getApprovalInstance,
  createApprovalWorkflow,
  submitForApproval,
  approveApprovalStep,
  rejectApprovalStep,
  escalateApprovalStep,
  type ApprovalWorkflow,
  type ApprovalInstance,
  type ApprovalStepDef,
} from '@/api/dba';

const { Title, Text } = Typography;

const instanceStatusColor: Record<string, string> = {
  pending: 'default',
  in_progress: 'processing',
  approved: 'success',
  rejected: 'error',
  completed: 'cyan',
  cancelled: 'default',
  timed_out: 'warning',
};

const DbaApproval: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('workflows');

  // Workflows
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfModalOpen, setWfModalOpen] = useState(false);
  const [wfForm] = Form.useForm();
  const [wfSteps, setWfSteps] = useState<ApprovalStepDef[]>([
    { id: 'step-1', role: 'dba_lead', mode: 'any', required: 1, timeoutHours: 24, timeoutAction: 'reject', approvers: [] },
  ]);

  // Instances
  const [instances, setInstances] = useState<ApprovalInstance[]>([]);
  const [instLoading, setInstLoading] = useState(false);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ---- Data loading ----

  const loadWorkflows = useCallback(async () => {
    setWfLoading(true);
    try {
      const res = await listApprovalWorkflows();
      const list = (res.data as ApprovalWorkflow[]) ?? [];
      setWorkflows(Array.isArray(list) ? list : []);
    } catch (err) {
      setWorkflows([]);
      message.error(`加载审批流程失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setWfLoading(false);
    }
  }, []);

  const loadInstances = useCallback(async () => {
    setInstLoading(true);
    try {
      const res = await listApprovalInstances();
      const list = (res.data as ApprovalInstance[]) ?? [];
      setInstances(Array.isArray(list) ? list : []);
    } catch (err) {
      setInstances([]);
      message.error(`加载审批实例失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setInstLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadWorkflows(), loadInstances()]).finally(() => setLoading(false));
  }, [loadWorkflows, loadInstances]);

  // ---- Workflow handlers ----

  const handleCreateWorkflow = async () => {
    try {
      const values = await wfForm.validateFields();
      setSubmitting(true);
      await createApprovalWorkflow({ name: values.name, steps: wfSteps });
      message.success('审批流程创建成功');
      setWfModalOpen(false);
      wfForm.resetFields();
      loadWorkflows();
    } catch (err) {
      const e = err as { errorFields?: unknown };
      if (!e.errorFields) {
        message.error(`创建失败: ${err instanceof Error ? err.message : '未知错误'}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const updateStep = (idx: number, patch: Partial<ApprovalStepDef>) => {
    setWfSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const addStep = () => {
    setWfSteps((prev) => [
      ...prev,
      {
        id: `step-${prev.length + 1}`,
        role: `step_${prev.length + 1}`,
        mode: 'any',
        required: 1,
        timeoutHours: 24,
        timeoutAction: 'reject',
        approvers: [],
      },
    ]);
  };

  const removeStep = (idx: number) => {
    if (wfSteps.length <= 1) return;
    setWfSteps((prev) => prev.filter((_, i) => i !== idx));
  };

  // ---- Instance handlers ----

  const handleSubmit = async () => {
    try {
      const values = await submitForm.validateFields();
      setSubmitting(true);
      await submitForApproval({ order_id: values.order_id, workflow_id: values.workflow_id });
      message.success('已提交审批');
      setSubmitModalOpen(false);
      submitForm.resetFields();
      loadInstances();
    } catch (err) {
      const e = err as { errorFields?: unknown };
      if (!e.errorFields) {
        message.error(`提交失败: ${err instanceof Error ? err.message : '未知错误'}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (id: string) => {
    setDetailId(id);
    setDetailLoading(true);
    try {
      const res = await getApprovalInstance(id);
      const inst = res.data as ApprovalInstance;
      // Update the row in the local list too so the drawer reflects new actions
      setInstances((prev) => prev.map((x) => (x.id === id ? inst : x)));
    } catch (err) {
      message.error(`加载详情失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setDetailLoading(false);
    }
  };

  const stepAction = async (id: string, idx: number, action: 'approve' | 'reject' | 'escalate') => {
    const key = `${id}:${idx}:${action}`;
    setActionLoading(key);
    try {
      if (action === 'approve') {
        await approveApprovalStep(id, idx, '');
        message.success('步骤已审批');
      } else if (action === 'reject') {
        await rejectApprovalStep(id, idx, '审批人拒绝');
        message.success('步骤已拒绝');
      } else {
        await escalateApprovalStep(id, idx);
        message.success('步骤已升级');
      }
      // Refetch detail
      const res = await getApprovalInstance(id);
      const inst = res.data as ApprovalInstance;
      setInstances((prev) => prev.map((x) => (x.id === id ? inst : x)));
    } catch (err) {
      message.error(`操作失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setActionLoading(null);
    }
  };

  // ---- Columns ----

  const wfColumns: TableColumn<ApprovalWorkflow>[] = useMemo(
    () => [
      {
        key: 'id',
        title: '流程ID',
        dataIndex: 'id',
        width: 120,
        render: (v: unknown) => <Text code>{String(v).slice(0, 8)}</Text>,
      },
      { key: 'name', title: '名称', dataIndex: 'name', render: (v: unknown) => <Text strong>{String(v)}</Text> },
      {
        key: 'steps',
        title: '步骤数',
        dataIndex: 'steps',
        width: 100,
        render: (v: unknown) => <Tag>{Array.isArray(v) ? v.length : 0}</Tag>,
      },
      {
        key: 'enabled',
        title: '启用',
        dataIndex: 'enabled',
        width: 80,
        render: (v: unknown) => (v ? <Tag color="green">启用</Tag> : <Tag color="default">禁用</Tag>),
      },
      {
        key: 'created_at',
        title: '创建时间',
        dataIndex: 'created_at',
        width: 180,
        render: (v: unknown) => <Text type="secondary">{String(v)}</Text>,
      },
    ],
    []
  );

  const instColumns: TableColumn<ApprovalInstance>[] = useMemo(
    () => [
      {
        key: 'id',
        title: '实例ID',
        dataIndex: 'id',
        width: 120,
        render: (v: unknown) => <Text code>{String(v).slice(0, 8)}</Text>,
      },
      { key: 'order_id', title: '工单ID', dataIndex: 'order_id', width: 140, render: (v: unknown) => <Text code>{String(v)}</Text> },
      { key: 'workflow_name', title: '流程', dataIndex: 'workflow_name' },
      {
        key: 'progress',
        title: '进度',
        dataIndex: 'current_step',
        width: 100,
        render: (_: unknown, r: ApprovalInstance) => {
          const total = r.steps?.length ?? 0;
          return <Text>{r.current_step + 1} / {total}</Text>;
        },
      },
      {
        key: 'status',
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (v: unknown) => <Tag color={instanceStatusColor[String(v)] ?? 'default'}>{String(v)}</Tag>,
      },
      {
        key: 'actions',
        title: '操作',
        width: 100,
        render: (_: unknown, r: ApprovalInstance) => (
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openDetail(r.id)}>
            详情
          </Button>
        ),
      },
    ],
    []
  );

  // ---- Tabs ----

  const workflowsTab = (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Button icon={<ReloadOutlined />} onClick={loadWorkflows} loading={wfLoading}>
          刷新
        </Button>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setWfSteps([
              { id: 'step-1', role: 'dba_lead', mode: 'any', required: 1, timeoutHours: 24, timeoutAction: 'reject', approvers: [] },
            ]);
            wfForm.resetFields();
            setWfModalOpen(true);
          }}
        >
          新建流程
        </Button>
      </div>
      <Table
        columns={wfColumns}
        dataSource={workflows}
        loading={wfLoading}
        rowKey="id"
        size="middle"
        striped
        locale={{ emptyText: <Empty description="暂无审批流程" /> }}
      />
    </div>
  );

  const instancesTab = (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Button icon={<ReloadOutlined />} onClick={loadInstances} loading={instLoading}>
          刷新
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { submitForm.resetFields(); setSubmitModalOpen(true); }}>
          提交审批
        </Button>
      </div>
      <Table
        columns={instColumns}
        dataSource={instances}
        loading={instLoading}
        rowKey="id"
        size="middle"
        striped
        locale={{ emptyText: <Empty description="暂无审批实例" /> }}
      />
    </div>
  );

  const tabItems = [
    { key: 'workflows', label: <span><SafetyCertificateOutlined /> 审批流程</span>, children: workflowsTab },
    { key: 'instances', label: <span><EditOutlined /> 审批实例</span>, children: instancesTab },
  ];

  if (loading && workflows.length === 0 && instances.length === 0) {
    return <PageSkeleton cards={3} rows={8} />;
  }

  const detailInstance = instances.find((i) => i.id === detailId);

  return (
    <div style={{ padding: 0 }}>
      <div style={{ marginBottom: spacing.lg }}>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <SafetyCertificateOutlined style={{ marginRight: spacing.sm, color: colors.purple[500] }} />
          DBA 多级审批
        </Title>
        <Text type="secondary">管理 SQL 工单的多级审批流程与实例进度</Text>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="large" />

      {/* Create Workflow Modal */}
      <Modal
        title="新建审批流程"
        open={wfModalOpen}
        onCancel={() => setWfModalOpen(false)}
        onOk={handleCreateWorkflow}
        confirmLoading={submitting}
        width={720}
        destroyOnClose
      >
        <Form form={wfForm} layout="vertical">
          <Form.Item name="name" label="流程名称" rules={[{ required: true, message: '请输入流程名称' }]}>
            <Input placeholder="如: 生产数据库变更审批" />
          </Form.Item>

          <div style={{ marginBottom: 8 }}>
            <Text strong>审批步骤</Text>
            <Button type="link" size="small" icon={<PlusOutlined />} onClick={addStep} style={{ marginLeft: 8 }}>
              添加步骤
            </Button>
          </div>

          {wfSteps.map((step, idx) => (
            <Card key={step.id} size="small" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Input
                  style={{ width: 140 }}
                  addonBefore={`步骤 ${idx + 1}`}
                  value={step.role}
                  onChange={(e) => updateStep(idx, { role: e.target.value, id: e.target.value })}
                  placeholder="角色"
                />
                <Select
                  style={{ width: 120 }}
                  value={step.mode}
                  onChange={(v) => updateStep(idx, { mode: v })}
                  options={[
                    { label: '任一审批人', value: 'any' },
                    { label: '全部审批人', value: 'all' },
                  ]}
                />
                <InputNumber
                  style={{ width: 100 }}
                  min={1}
                  value={step.required}
                  addonBefore="需"
                  addonAfter="人"
                  onChange={(v) => updateStep(idx, { required: v ?? 1 })}
                />
                <InputNumber
                  style={{ width: 140 }}
                  min={1}
                  value={step.timeoutHours}
                  addonBefore="超时"
                  addonAfter="小时"
                  onChange={(v) => updateStep(idx, { timeoutHours: v ?? 24 })}
                />
                <Select
                  style={{ width: 140 }}
                  value={step.timeoutAction}
                  onChange={(v) => updateStep(idx, { timeoutAction: v })}
                  options={[
                    { label: '超时拒绝', value: 'reject' },
                    { label: '超时升级', value: 'escalate' },
                    { label: '超时通过', value: 'approve' },
                  ]}
                />
                <Input
                  style={{ width: 180 }}
                  value={step.approvers.join(',')}
                  onChange={(e) =>
                    updateStep(idx, {
                      approvers: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  placeholder="审批人 (逗号分隔)"
                />
                <Button
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  disabled={wfSteps.length <= 1}
                  onClick={() => removeStep(idx)}
                />
              </div>
            </Card>
          ))}
        </Form>
      </Modal>

      {/* Submit Instance Modal */}
      <Modal
        title="提交审批"
        open={submitModalOpen}
        onCancel={() => setSubmitModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        width={500}
        destroyOnClose
      >
        <Form form={submitForm} layout="vertical">
          <Form.Item name="order_id" label="工单ID" rules={[{ required: true, message: '请输入工单ID' }]}>
            <Input placeholder="如: order-12345" />
          </Form.Item>
          <Form.Item name="workflow_id" label="审批流程" rules={[{ required: true, message: '请选择审批流程' }]}>
            <Select
              options={workflows.map((w) => ({ label: w.name, value: w.id }))}
              placeholder="选择要应用的审批流程"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Instance Detail Drawer */}
      <Drawer
        title={detailInstance ? `审批实例 ${detailInstance.id.slice(0, 8)}` : '审批实例详情'}
        open={!!detailId}
        onClose={() => setDetailId(null)}
        width={720}
        destroyOnClose
      >
        <Spin spinning={detailLoading}>
          {detailInstance && (
            <>
              <Descriptions
                bordered
                size="small"
                column={2}
                style={{ marginBottom: spacing.md }}
                items={[
                  { key: 'order', label: '工单ID', children: <Text code>{detailInstance.order_id}</Text> },
                  { key: 'wf', label: '流程', children: detailInstance.workflow_name },
                  {
                    key: 'status',
                    label: '状态',
                    children: <Tag color={instanceStatusColor[detailInstance.status] ?? 'default'}>{detailInstance.status}</Tag>,
                  },
                  {
                    key: 'progress',
                    label: '当前步骤',
                    children: `${detailInstance.current_step + 1} / ${detailInstance.steps?.length ?? 0}`,
                  },
                  { key: 'created', label: '创建时间', children: detailInstance.created_at, span: 2 },
                ]}
              />

              <Steps
                direction="vertical"
                size="small"
                style={{ marginBottom: spacing.md }}
                items={(detailInstance.steps ?? []).map((s) => ({
                  title: `${s.def.role} (${s.def.mode === 'all' ? '全员' : '任一'})`,
                  description: `${s.status}${s.escalated_to ? ` · 升级至 ${s.escalated_to}` : ''}`,
                  status:
                    s.status === 'approved'
                      ? 'finish'
                      : s.status === 'active'
                        ? 'process'
                        : s.status === 'rejected'
                          ? 'error'
                          : 'wait',
                }))}
              />

              {/* Per-step action buttons */}
              <div>
                {(detailInstance.steps ?? []).map((s) => (
                  s.status === 'active' && (
                    <Card key={s.step_index} size="small" style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text strong>步骤 {s.step_index + 1} 操作</Text>
                        <Space>
                          <Button
                            type="primary"
                            size="small"
                            icon={<CheckOutlined />}
                            loading={actionLoading === `${detailInstance.id}:${s.step_index}:approve`}
                            onClick={() => stepAction(detailInstance.id, s.step_index, 'approve')}
                          >
                            通过
                          </Button>
                          <Button
                            danger
                            size="small"
                            icon={<CloseOutlined />}
                            loading={actionLoading === `${detailInstance.id}:${s.step_index}:reject`}
                            onClick={() => stepAction(detailInstance.id, s.step_index, 'reject')}
                          >
                            拒绝
                          </Button>
                          <Button
                            size="small"
                            icon={<ArrowUpOutlined />}
                            loading={actionLoading === `${detailInstance.id}:${s.step_index}:escalate`}
                            onClick={() => stepAction(detailInstance.id, s.step_index, 'escalate')}
                          >
                            升级
                          </Button>
                        </Space>
                      </div>
                      {s.approvals.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <Text type="secondary">审批记录:</Text>
                          <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                            {s.approvals.map((a) => (
                              <li key={a.id} style={{ marginBottom: 4 }}>
                                <Text code>{a.user_id}</Text> — {a.action}
                                {a.comment ? `: ${a.comment}` : ''}
                                <Text type="secondary" style={{ marginLeft: 8, fontSize: 11 }}>
                                  {a.actioned_at}
                                </Text>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </Card>
                  )
                ))}
              </div>
            </>
          )}
        </Spin>
      </Drawer>
    </div>
  );
};

export default DbaApproval;
