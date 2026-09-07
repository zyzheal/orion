/**
 * DBA Online Schema Change (gh-ost) page
 *
 * Create/monitor MySQL schema-change jobs via gh-ost. Supports dry run,
 * start, stop, and per-job status polling. Job status + gh-ost progress
 * are shown in a side panel.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Form,
  Input,
  Select,
  message,
  Table,
  Spin,
  Empty,
  Drawer,
  Descriptions,
  Modal,
  Alert,
  Row,
  Col,
  InputNumber,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  StopOutlined,
  ExperimentOutlined,
  ToolOutlined,
  EyeOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import {
  listDataSources,
  listOSCJobs,
  getOSCJob,
  createOSCJob,
  startOSCJob,
  stopOSCJob,
  oscDryRun,
  getOSCStatus,
  type DataSource,
  type OSCJob,
  type OSCStatus,
  type DryRunResult,
  type CreateOSCJobInput,
} from '@/api/dba';

const { Title, Text, Paragraph } = Typography;

const jobStatusColor: Record<string, string> = {
  pending: 'default',
  running: 'processing',
  success: 'success',
  failed: 'error',
  cancelled: 'default',
};

const jobStatusLabel: Record<string, string> = {
  pending: '待执行',
  running: '执行中',
  success: '成功',
  failed: '失败',
  cancelled: '已取消',
};

const DbaOSC: React.FC = () => {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [jobs, setJobs] = useState<OSCJob[]>([]);
  const [loading, setLoading] = useState(false);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // Dry run modal
  const [dryRunOpen, setDryRunOpen] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [dryRunning, setDryRunning] = useState(false);

  // Detail drawer
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OSCJob | null>(null);
  const [detailStatus, setDetailStatus] = useState<OSCStatus | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [actingId, setActingId] = useState<string | null>(null);

  // ---- Data loading ----

  const loadDataSources = useCallback(async () => {
    try {
      const res = await listDataSources('default');
      const list = (res.data as DataSource[]) ?? [];
      setDataSources(Array.isArray(list) ? list : []);
    } catch {
      /* non-fatal */
    }
  }, []);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listOSCJobs({ page: 1, limit: 100 });
      const body = res.data as { data?: OSCJob[] };
      setJobs(Array.isArray(body?.data) ? body.data : []);
    } catch (err) {
      setJobs([]);
      message.error(`加载任务失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDataSources();
    void loadJobs();
  }, [loadDataSources, loadJobs]);

  // ---- Create ----

  const handleCreate = async () => {
    try {
      const v = await createForm.validateFields();
      setSubmitting(true);
      const payload: CreateOSCJobInput = {
        data_source_id: v.data_source_id,
        table: v.table,
        alter_sql: v.alter_sql,
        dry_run: v.dry_run,
        cutover_mode: v.cutover_mode || 'two-step',
        max_lag_millis: v.max_lag_millis ?? 1500,
        chunk_size: v.chunk_size ?? 1000,
      };
      await createOSCJob(payload);
      message.success('OSC 任务已创建');
      setCreateOpen(false);
      createForm.resetFields();
      loadJobs();
    } catch (err) {
      const e = err as { errorFields?: unknown };
      if (!e.errorFields) {
        message.error(`创建失败: ${err instanceof Error ? err.message : '未知错误'}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Dry Run ----

  const runDryRun = async () => {
    const v = createForm.getFieldsValue();
    if (!v.data_source_id || !v.table || !v.alter_sql) {
      message.warning('请先填写数据源、表名和 ALTER SQL');
      return;
    }
    setDryRunning(true);
    setDryRunResult(null);
    setDryRunOpen(true);
    try {
      const res = await oscDryRun({
        data_source_id: v.data_source_id,
        table: v.table,
        alter_sql: v.alter_sql,
      });
      setDryRunResult(res.data as DryRunResult);
    } catch (err) {
      message.error(`Dry Run 失败: ${err instanceof Error ? err.message : '未知错误'}`);
      setDryRunOpen(false);
    } finally {
      setDryRunning(false);
    }
  };

  // ---- Start / Stop ----

  const startJob = async (id: string) => {
    setActingId(id);
    try {
      await startOSCJob(id);
      message.success('任务已启动');
      loadJobs();
    } catch (err) {
      message.error(`启动失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setActingId(null);
    }
  };

  const stopJob = async (id: string) => {
    setActingId(id);
    try {
      await stopOSCJob(id);
      message.success('任务已停止');
      loadJobs();
      if (detailId === id) stopPolling();
    } catch (err) {
      message.error(`停止失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setActingId(null);
    }
  };

  // ---- Detail polling ----

  const openDetail = async (id: string) => {
    setDetailId(id);
    setDetailLoading(true);
    try {
      const res = await getOSCJob(id);
      setDetail(res.data as OSCJob);
    } catch (err) {
      message.error(`加载详情失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setDetailLoading(false);
    }
    startPolling(id);
  };

  const startPolling = (id: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await getOSCStatus(id);
        const status = res.data as OSCStatus;
        setDetailStatus(status);
        setDetail(status.job);
        // Stop polling when terminal
        const st = status.job?.status;
        if (st === 'success' || st === 'failed' || st === 'cancelled') {
          stopPolling();
          loadJobs();
        }
      } catch {
        /* transient */
      }
    }, 3000);
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => stopPolling, []);

  // ---- Columns ----

  const columns = [
    { key: 'id', title: '任务ID', dataIndex: 'id', width: 120, render: (v: unknown) => <Text code>{String(v).slice(0, 8)}</Text> },
    {
      key: 'table',
      title: '表',
      dataIndex: 'table',
      width: 140,
      render: (v: unknown) => (
        <Space>
          <ToolOutlined style={{ color: colors.primary[500] }} />
          <Text strong>{String(v)}</Text>
        </Space>
      ),
    },
    {
      key: 'alter_sql',
      title: 'ALTER SQL',
      dataIndex: 'alter_sql',
      ellipsis: true,
      render: (v: unknown) => <Text code style={{ fontSize: 11 }}>{String(v).slice(0, 60)}</Text>,
    },
    {
      key: 'dry_run',
      title: 'Dry Run',
      dataIndex: 'dry_run',
      width: 80,
      render: (v: unknown) => (v ? <Tag color="blue">是</Tag> : <Tag color="default">否</Tag>),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: unknown) => (
        <Tag color={jobStatusColor[String(v)] ?? 'default'}>{jobStatusLabel[String(v)] ?? String(v)}</Tag>
      ),
    },
    {
      key: 'created_at',
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      render: (v: unknown) => <Text type="secondary">{String(v)}</Text>,
    },
    {
      key: 'actions',
      title: '操作',
      width: 200,
      render: (_: unknown, r: OSCJob) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => openDetail(r.id)}
          >
            详情
          </Button>
          {r.status === 'pending' && (
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              loading={actingId === r.id}
              style={{ color: colors.success[500] }}
              onClick={() => startJob(r.id)}
            >
              启动
            </Button>
          )}
          {r.status === 'running' && (
            <Button
              type="link"
              size="small"
              danger
              icon={<StopOutlined />}
              loading={actingId === r.id}
              onClick={() => stopJob(r.id)}
            >
              停止
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ marginBottom: spacing.lg }}>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <ToolOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
          在线结构变更 (gh-ost)
        </Title>
        <Text type="secondary">使用 gh-ost 在零停机前提下完成 MySQL DDL 变更</Text>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Button icon={<ReloadOutlined />} onClick={loadJobs} loading={loading}>
          刷新
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); setCreateOpen(true); }}>
          新建任务
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={jobs}
        rowKey="id"
        size="middle"
        loading={loading}
        locale={{ emptyText: <Empty description="暂无 OSC 任务" /> }}
      />

      {/* Create Modal */}
      <Modal
        title="新建 OSC 任务"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
        width={720}
        destroyOnClose
        footer={[
          <Button key="dry" icon={<ExperimentOutlined />} loading={dryRunning} onClick={runDryRun}>
            Dry Run
          </Button>,
          <Button key="cancel" onClick={() => setCreateOpen(false)}>取消</Button>,
          <Button key="ok" type="primary" loading={submitting} onClick={handleCreate}>创建</Button>,
        ]}
      >
        <Form form={createForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="data_source_id"
                label="数据源"
                rules={[{ required: true, message: '请选择数据源' }]}
              >
                <Select
                  placeholder="选择 MySQL 数据源"
                  options={dataSources.filter((d) => d.type === 'mysql').map((ds) => ({
                    label: `${ds.name} (${ds.host}:${ds.port})`,
                    value: ds.id,
                  }))}
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="table" label="表名" rules={[{ required: true, message: '请输入表名' }]}>
                <Input placeholder="如: orders" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="alter_sql"
            label="ALTER SQL"
            rules={[{ required: true, message: '请输入 ALTER SQL' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="ADD COLUMN email VARCHAR(255) NOT NULL DEFAULT '';"
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="dry_run" label="Dry Run 模式" initialValue={false}>
                <Select
                  options={[
                    { label: '正式执行', value: false },
                    { label: '仅模拟', value: true },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="cutover_mode" label="切换模式" initialValue="two-step">
                <Select
                  options={[
                    { label: '两阶段 (two-step)', value: 'two-step' },
                    { label: '复制表 (cut-over)', value: 'cut-over' },
                    { label: '非原子切换 (atomic)', value: 'atomic' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="max_lag_millis" label="最大延迟 (ms)" initialValue={1500}>
                <InputNumber style={{ width: '100%' }} min={0} step={100} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="chunk_size" label="分块大小" initialValue={1000}>
                <InputNumber style={{ width: '100%' }} min={100} step={100} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Dry Run Modal */}
      <Modal
        title="Dry Run 结果"
        open={dryRunOpen}
        onCancel={() => setDryRunOpen(false)}
        onOk={() => setDryRunOpen(false)}
        footer={[<Button key="close" type="primary" onClick={() => setDryRunOpen(false)}>关闭</Button>]}
        width={640}
      >
        {!dryRunResult ? (
          <Empty description="执行中..." image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <Tag
              color={dryRunResult.success ? 'success' : 'error'}
              icon={dryRunResult.success ? <ThunderboltOutlined /> : <StopOutlined />}
            >
              {dryRunResult.success ? '模拟通过' : '模拟失败'}
            </Tag>
            <Text type="secondary">耗时 {dryRunResult.duration_ms}ms</Text>
            {dryRunResult.exit_code !== undefined && (
              <Text>退出码: {dryRunResult.exit_code}</Text>
            )}
            <Paragraph>{dryRunResult.message}</Paragraph>
            {dryRunResult.log.length > 0 && (
              <pre
                style={{
                  fontSize: 11,
                  background: '#f5f5f5',
                  padding: 8,
                  borderRadius: 4,
                  maxHeight: 240,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {dryRunResult.log.join('\n')}
              </pre>
            )}
          </Space>
        )}
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={detail ? `OSC 任务 ${detail.id.slice(0, 8)}` : 'OSC 任务详情'}
        open={!!detailId}
        onClose={() => { stopPolling(); setDetailId(null); }}
        width={680}
        destroyOnClose
      >
        <Spin spinning={detailLoading}>
          {detail && (
            <>
              <Descriptions
                bordered
                size="small"
                column={2}
                style={{ marginBottom: spacing.md }}
                items={[
                  { key: 'table', label: '表', children: <Text strong>{detail.table}</Text> },
                  {
                    key: 'status',
                    label: '状态',
                    children: (
                      <Tag color={jobStatusColor[detail.status] ?? 'default'}>
                        {jobStatusLabel[detail.status] ?? detail.status}
                      </Tag>
                    ),
                  },
                  {
                    key: 'dry_run',
                    label: 'Dry Run',
                    children: detail.dry_run ? <Tag color="blue">是</Tag> : <Tag>否</Tag>,
                  },
                  { key: 'cutover', label: '切换模式', children: detail.cutover_mode },
                  {
                    key: 'created',
                    label: '创建时间',
                    children: detail.created_at,
                    span: 2,
                  },
                ]}
              />

              <Card size="small" title="ALTER SQL" style={{ marginBottom: spacing.md }}>
                <pre
                  style={{
                    fontSize: 12,
                    background: '#f6f8fa',
                    padding: 8,
                    borderRadius: 4,
                    maxHeight: 120,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {detail.alter_sql}
                </pre>
              </Card>

              {detailStatus?.reachable === false && (
                <Alert
                  type="warning"
                  showIcon
                  message="gh-ost 不可达"
                  description={detailStatus.reachable_error}
                  style={{ marginBottom: spacing.md }}
                />
              )}

              {detail.log && (
                <Card size="small" title="执行日志" style={{ marginBottom: spacing.md }}>
                  <pre
                    style={{
                      fontSize: 11,
                      background: '#1e1e1e',
                      color: '#d4d4d4',
                      padding: 8,
                      borderRadius: 4,
                      maxHeight: 200,
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {detail.log}
                  </pre>
                </Card>
              )}

              {detail.rows_affected !== undefined && (
                <Descriptions
                  bordered
                  size="small"
                  column={2}
                  items={[
                    { key: 'rows', label: '影响行数', children: detail.rows_affected },
                    { key: 'lag', label: '最大延迟 (ms)', children: detail.max_lag_observed },
                    { key: 'dur', label: '耗时 (ms)', children: detail.duration_ms },
                  ]}
                />
              )}

              {detail.error_message && (
                <Alert
                  type="error"
                  showIcon
                  message="错误信息"
                  description={detail.error_message}
                  style={{ marginTop: spacing.md }}
                />
              )}
            </>
          )}
        </Spin>
      </Drawer>
    </div>
  );
};

export default DbaOSC;
