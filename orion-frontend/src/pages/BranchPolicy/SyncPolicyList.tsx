import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Steps,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SyncOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { spacing } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
import {
  createSyncPolicy,
  disableSyncPolicy,
  enableSyncPolicy,
  getBranchProfiles,
  getSyncPolicies,
  getSyncPolicyRunLogs,
  runSyncNow,
  updateSyncPolicy,
  type BranchProfile,
  type CreateSyncPolicyInput,
  type SyncPolicy,
  type SyncRunLog,
} from '@/api/branch-policy';

const { Title, Text } = Typography;

const FREQUENCY_LABELS: Record<string, string> = { daily: '每日', weekly: '每周', monthly: '每月' };
const STRATEGY_LABELS: Record<string, string> = { rebase: 'Rebase', 'cherry-pick': 'Cherry-pick', merge: 'Merge' };
const RESOLVE_LABELS: Record<string, string> = { none: '不自动处理', 'skip-conflict': '跳过冲突文件', 'manual-required': '人工解决' };
const STATUS_COLORS: Record<string, string> = { success: 'green', conflict: 'orange', failed: 'red' };
const STATUS_LABELS: Record<string, string> = { success: '成功', conflict: '冲突', failed: '失败' };

export default function SyncPolicyList() {
  const [policies, setPolicies] = useState<SyncPolicy[]>([]);
  const [profiles, setProfiles] = useState<BranchProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabledFilter, setEnabledFilter] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<SyncPolicy | null>(null);
  const [runLogs, setRunLogs] = useState<SyncRunLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [policiesRes, profilesRes] = await Promise.all([
        getSyncPolicies(),
        getBranchProfiles({ status: 'active' }),
      ]);
      setPolicies((policiesRes.data ?? []) as unknown as SyncPolicy[]);
      setProfiles((profilesRes.data ?? []) as unknown as BranchProfile[]);
    } catch (err) {
      message.error(`加载同步策略失败：${(err as Error).message ?? err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const filtered = useMemo(() => {
    if (enabledFilter === 'all') return policies;
    const enabled = enabledFilter === 'enabled';
    return policies.filter((p) => p.enabled === enabled);
  }, [policies, enabledFilter]);

  const enabledCount = useMemo(() => policies.filter((p) => p.enabled).length, [policies]);
  const successCount = useMemo(
    () => policies.filter((p) => p.lastRunStatus === 'success').length,
    [policies],
  );
  const conflictCount = useMemo(
    () => policies.filter((p) => p.lastRunStatus === 'conflict').length,
    [policies],
  );

  const openCreate = () => {
    form.resetFields();
    form.setFieldsValue({
      frequency: 'daily',
      strategy: 'merge',
      autoResolve: 'manual-required',
      enabled: true,
      notifyOnConflict: [],
    });
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const payload: CreateSyncPolicyInput = {
        name: values.name,
        sourceBranch: values.sourceBranch,
        targetBranches: values.targetBranches,
        frequency: values.frequency,
        cronExpr: values.cronExpr,
        strategy: values.strategy,
        autoResolve: values.autoResolve,
        notifyOnConflict: values.notifyOnConflict,
        notifyWebhook: values.notifyWebhook,
        enabled: values.enabled,
      };
      setCreating(true);
      await createSyncPolicy(payload);
      message.success('同步策略创建成功');
      setCreateOpen(false);
      form.resetFields();
      void fetchAll();
    } catch (err) {
      if ((err as { errorFields?: unknown }).errorFields) return;
      message.error(`创建失败：${(err as Error).message ?? err}`);
    } finally {
      setCreating(false);
    }
  };

  const handleRunNow = async (policy: SyncPolicy) => {
    setRunningId(policy.id);
    try {
      const res = await runSyncNow(policy.id);
      const log = res.data as unknown as SyncRunLog;
      message.success(
        log?.status === 'success'
          ? '同步执行成功'
          : log?.status === 'conflict'
            ? '同步完成，存在冲突待处理'
            : '同步执行完成',
      );
      void fetchAll();
      if (detail?.id === policy.id) await openDetail(policy);
    } catch (err) {
      message.error(`执行失败：${(err as Error).message ?? err}`);
    } finally {
      setRunningId(null);
    }
  };

  const handleToggle = async (policy: SyncPolicy, enabled: boolean) => {
    try {
      if (enabled) {
        await enableSyncPolicy(policy.id);
        message.success('同步策略已启用');
      } else {
        await disableSyncPolicy(policy.id);
        message.success('同步策略已停用');
      }
      void fetchAll();
    } catch (err) {
      message.error(`操作失败：${(err as Error).message ?? err}`);
    }
  };

  const handleDelete = async (policy: SyncPolicy) => {
    try {
      await updateSyncPolicy(policy.id, { enabled: false });
      message.success('同步策略已停用（删除接口由停用代替）');
      void fetchAll();
    } catch (err) {
      message.error(`操作失败：${(err as Error).message ?? err}`);
    }
  };

  const openDetail = async (policy: SyncPolicy) => {
    setDetail(policy);
    setRunLogs([]);
    setLogsLoading(true);
    try {
      const res = await getSyncPolicyRunLogs(policy.id, { limit: 20 });
      setRunLogs((res.data ?? []) as unknown as SyncRunLog[]);
    } catch (err) {
      message.error(`加载执行历史失败：${(err as Error).message ?? err}`);
    } finally {
      setLogsLoading(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        title: '策略名称',
        dataIndex: 'name',
        key: 'name',
        width: 180,
        render: (name: string, row: SyncPolicy) => (
          <Button type="link" style={{ padding: 0 }} onClick={() => void openDetail(row)}>
            <Text strong>{name}</Text>
          </Button>
        ),
      },
      {
        title: '同步方向',
        key: 'direction',
        width: 200,
        render: (_: unknown, row: SyncPolicy) => (
          <Space size={4} wrap>
            <Tag color="blue">{row.sourceBranch}</Tag>
            <SyncOutlined style={{ fontSize: 10 }} />
            {row.targetBranches.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </Space>
        ),
      },
      {
        title: '频率 / 策略',
        key: 'schedule',
        width: 140,
        render: (_: unknown, row: SyncPolicy) => (
          <Space direction="vertical" size={0}>
            <Text>
              {FREQUENCY_LABELS[row.frequency] ?? row.frequency}
              {row.cronExpr ? `（${row.cronExpr}）` : ''}
            </Text>
            <Tag>{STRATEGY_LABELS[row.strategy] ?? row.strategy}</Tag>
          </Space>
        ),
      },
      {
        title: '冲突处理',
        dataIndex: 'autoResolve',
        key: 'autoResolve',
        width: 110,
        render: (v: string) => (
          <Tag color={v === 'manual-required' ? 'orange' : v === 'skip-conflict' ? 'geekblue' : 'default'}>
            {RESOLVE_LABELS[v] ?? v}
          </Tag>
        ),
      },
      {
        title: '最近执行',
        key: 'lastRun',
        width: 160,
        render: (_: unknown, row: SyncPolicy) => {
          if (!row.lastRunAt) return <Text type="secondary">从未执行</Text>;
          return (
            <Space direction="vertical" size={0}>
              <Tag color={STATUS_COLORS[row.lastRunStatus ?? '']}>
                {STATUS_LABELS[row.lastRunStatus ?? ''] ?? row.lastRunStatus}
              </Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {new Date(row.lastRunAt).toLocaleString()}
              </Text>
            </Space>
          );
        },
      },
      {
        title: '状态',
        dataIndex: 'enabled',
        key: 'enabled',
        width: 90,
        render: (enabled: boolean, row: SyncPolicy) => (
          <Switch
            checked={enabled}
            checkedChildren="启用"
            unCheckedChildren="停用"
            onChange={(v) => void handleToggle(row, v)}
          />
        ),
      },
      {
        title: '操作',
        key: 'actions',
        width: 160,
        render: (_: unknown, row: SyncPolicy) => (
          <Space>
            <Button
              size="small"
              type="primary"
              ghost
              icon={<ThunderboltOutlined />}
              loading={runningId === row.id}
              onClick={() => void handleRunNow(row)}
            >
              立即执行
            </Button>
            <Popconfirm
              title="确认停用该同步策略？"
              okText="停用"
              okButtonProps={{ danger: true }}
              cancelText="取消"
              onConfirm={() => void handleDelete(row)}
            >
              <Button size="small" danger icon={<CloseCircleOutlined />}>
                停用
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runningId],
  );

  const runLogColumns = useMemo(
    () => [
      {
        title: '触发时间',
        dataIndex: 'triggeredAt',
        key: 'triggeredAt',
        width: 170,
        render: (v: string) => new Date(v).toLocaleString(),
      },
      {
        title: '触发方式',
        dataIndex: 'triggeredBy',
        key: 'triggeredBy',
        width: 100,
        render: (v: string) => <Tag>{v === 'scheduler' ? '调度器' : '手动'}</Tag>,
      },
      {
        title: '源提交',
        dataIndex: 'sourceCommit',
        key: 'sourceCommit',
        width: 100,
        render: (v?: string) => (v ? <Text code>{v.slice(0, 8)}</Text> : '-'),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: (v: string) => <Tag color={STATUS_COLORS[v]}>{STATUS_LABELS[v] ?? v}</Tag>,
      },
      {
        title: '冲突文件',
        key: 'conflicts',
        render: (_: unknown, row: SyncRunLog) =>
          row.conflictFiles?.length ? (
            <Space size={2} wrap>
              {row.conflictFiles.slice(0, 5).map((f) => (
                <Tag key={f} color="orange">
                  {f}
                </Tag>
              ))}
              {row.conflictFiles.length > 5 && <Text type="secondary">+{row.conflictFiles.length - 5}</Text>}
            </Space>
          ) : (
            <Text type="secondary">-</Text>
          ),
      },
      {
        title: '耗时',
        dataIndex: 'durationMs',
        key: 'durationMs',
        width: 90,
        render: (v: number) => `${(v / 1000).toFixed(1)}s`,
      },
      {
        title: '变更单',
        dataIndex: 'changeId',
        key: 'changeId',
        width: 120,
        render: (v?: string) => (v ? <Text code>{v.slice(0, 10)}</Text> : '-'),
      },
    ],
    [],
  );

  const activeProfiles = useMemo(
    () => profiles.map((p) => p.name),
    [profiles],
  );

  if (loading && policies.length === 0) {
    return <PageSkeleton rows={12} />;
  }

  return (
    <div>
      <Title level={2} style={{ marginBottom: 8 }}>
        <SyncOutlined style={{ marginRight: 12, color: '#3370E6' }} />
        同步策略
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        跨分支代码同步策略，配置源/目标分支、同步频率与冲突处理方式
      </Text>

      <Row gutter={[16, 16]} style={{ marginBottom: spacing.md }}>
        <StatCard title="策略总数" value={policies.length} />
        <StatCard title="已启用" value={enabledCount} />
        <StatCard title="最近执行成功" value={successCount} />
        <StatCard title="存在冲突" value={conflictCount} />
      </Row>

      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.md,
          }}
        >
          <Space>
            <Select
              value={enabledFilter}
              onChange={setEnabledFilter}
              style={{ width: 130 }}
              options={[
                { value: 'all', label: '全部策略' },
                { value: 'enabled', label: '已启用' },
                { value: 'disabled', label: '已停用' },
              ]}
            />
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void fetchAll()}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              创建同步策略
            </Button>
          </Space>
        </div>
        {filtered.length === 0 ? (
          <Empty description="暂无同步策略">
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              创建第一条同步策略
            </Button>
          </Empty>
        ) : (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={filtered}
            pagination={false}
            scroll={{ x: 1080 }}
          />
        )}
      </Card>

      <Modal
        title="创建同步策略"
        open={createOpen}
        onOk={() => void handleCreate()}
        confirmLoading={creating}
        onCancel={() => {
          setCreateOpen(false);
          form.resetFields();
        }}
        okText="创建"
        cancelText="取消"
        width={640}
      >
        <CreateWizard
          form={form}
          activeProfiles={activeProfiles}
          onBranchChange={(v) => form.setFieldsValue({ sourceBranch: v })}
        />
      </Modal>

      <Drawer
        title={detail ? `同步策略 · ${detail.name}` : '同步策略详情'}
        width={720}
        open={!!detail}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <>
            <Card size="small" style={{ marginBottom: spacing.md }}>
              <Row gutter={16}>
                <InfoItem label="源分支" value={detail.sourceBranch} color="blue" />
                <InfoItem label="目标分支" value={detail.targetBranches.join(', ')} />
                <InfoItem label="频率" value={`${FREQUENCY_LABELS[detail.frequency] ?? detail.frequency}${detail.cronExpr ? `（${detail.cronExpr}）` : ''}`} />
                <InfoItem label="策略" value={STRATEGY_LABELS[detail.strategy] ?? detail.strategy} />
                <InfoItem label="冲突处理" value={RESOLVE_LABELS[detail.autoResolve] ?? detail.autoResolve} />
                <InfoItem
                  label="状态"
                  value={detail.enabled ? '已启用' : '已停用'}
                  color={detail.enabled ? 'green' : 'default'}
                />
              </Row>
              <div style={{ marginTop: 12 }}>
                <Text type="secondary">通知对象：</Text>
                {detail.notifyOnConflict?.length ? (
                  detail.notifyOnConflict.map((n) => (
                    <Tag key={n} color="purple">
                      {n}
                    </Tag>
                  ))
                ) : (
                  <Text type="secondary">无</Text>
                )}
                {detail.notifyWebhook && (
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary">Webhook：</Text>
                    <Text code>{detail.notifyWebhook}</Text>
                  </div>
                )}
              </div>
            </Card>

            {detail.lastRunStatus === 'conflict' && detail.lastRunConflictFiles?.length > 0 && (
              <Alert
                type="warning"
                showIcon
                icon={<WarningOutlined />}
                style={{ marginBottom: spacing.md }}
                message="最近一次执行存在冲突，需要人工处理"
                description={
                  <Space size={4} wrap>
                    {detail.lastRunConflictFiles.map((f) => (
                      <Tag key={f} color="orange">
                        {f}
                      </Tag>
                    ))}
                  </Space>
                }
              />
            )}

            <Card
              size="small"
              title="执行历史"
              style={{ marginBottom: spacing.md }}
              extra={
                <Button
                  size="small"
                  type="primary"
                  ghost
                  icon={<ThunderboltOutlined />}
                  loading={runningId === detail.id}
                  onClick={() => void handleRunNow(detail)}
                >
                  立即执行
                </Button>
              }
            >
              {logsLoading ? (
                <PageSkeleton rows={3} searchBar={false} />
              ) : runLogs.length === 0 ? (
                <Empty description="暂无执行记录" />
              ) : (
                <Table
                  rowKey="id"
                  columns={runLogColumns}
                  dataSource={runLogs}
                  pagination={false}
                  size="small"
                  scroll={{ x: 760 }}
                />
              )}
            </Card>
          </>
        )}
      </Drawer>
    </div>
  );
}

function CreateWizard({
  form,
  activeProfiles,
  onBranchChange,
}: {
  form: ReturnType<typeof Form.useForm>[0];
  activeProfiles: string[];
  onBranchChange: (v: string) => void;
}) {
  return (
    <Form form={form} layout="vertical" requiredMark={false}>
      <Steps
        size="small"
        current={3}
        items={[
          { title: '源分支' },
          { title: '目标分支' },
          { title: '频率策略' },
          { title: '冲突通知' },
        ]}
        style={{ marginBottom: 20 }}
      />
      <Form.Item name="name" label="策略名称" rules={[{ required: true, message: '请输入策略名称' }]}>
        <Input placeholder="例如 main → release 周同步" />
      </Form.Item>
      <Form.Item
        name="sourceBranch"
        label="源分支"
        rules={[{ required: true, message: '请选择源分支' }]}
      >
        <Select
          showSearch
          placeholder="选择源分支"
          options={activeProfiles.map((b) => ({ value: b, label: b }))}
          onChange={onBranchChange}
        />
      </Form.Item>
      <Form.Item
        name="targetBranches"
        label="目标分支（多选）"
        rules={[{ required: true, message: '请选择目标分支' }]}
      >
        <Select
          mode="multiple"
          placeholder="选择目标分支"
          options={activeProfiles.map((b) => ({ value: b, label: b }))}
        />
      </Form.Item>
      <Row gutter={12}>
        <Form.Item name="frequency" label="同步频率" style={{ width: '50%' }} rules={[{ required: true }]}>
          <Select
            options={[
              { value: 'daily', label: '每日' },
              { value: 'weekly', label: '每周' },
              { value: 'monthly', label: '每月' },
            ]}
          />
        </Form.Item>
        <Form.Item name="cronExpr" label="Cron 表达式" style={{ width: '50%' }}>
          <Input placeholder="如 0 2 * * 1（每周一 02:00）" />
        </Form.Item>
      </Row>
      <Form.Item name="strategy" label="同步策略" rules={[{ required: true }]}>
        <Select
          options={[
            { value: 'rebase', label: 'Rebase（将源分支变基到目标分支）' },
            { value: 'cherry-pick', label: 'Cherry-pick（按提交挑选）' },
            { value: 'merge', label: 'Merge（合并提交）' },
          ]}
        />
      </Form.Item>
      <Form.Item
        name="autoResolve"
        label="冲突处理"
        rules={[{ required: true }]}
        extra="manual-required 时冲突将阻断同步并创建变更单"
      >
        <Select
          options={[
            { value: 'none', label: '不自动处理' },
            { value: 'skip-conflict', label: '跳过冲突文件' },
            { value: 'manual-required', label: '人工解决（阻断）' },
          ]}
        />
      </Form.Item>
      <Form.Item name="notifyOnConflict" label="冲突通知对象">
        <Checkbox.Group
          options={[
            { value: 'branch-owner', label: '分支负责人' },
            { value: 'release-manager', label: '发布经理' },
            { value: 'change-owner', label: '变更单负责人' },
          ]}
        />
      </Form.Item>
      <Form.Item name="notifyWebhook" label="通知 Webhook">
        <Input placeholder="https://…" />
      </Form.Item>
      <Form.Item name="enabled" label="创建后立即启用" valuePropName="checked">
        <Switch />
      </Form.Item>
    </Form>
  );
}

function InfoItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ minWidth: 160, marginBottom: 8 }}>
      <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
        {label}
      </Text>
      <Tag color={color}>{value}</Tag>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div style={{ flex: 1, minWidth: 160 }}>
      <Card>
        <Statistic title={title} value={value} />
      </Card>
    </div>
  );
}
