/**
 * Serverless Page (Phase 4 P0 - Serverless Module)
 * Function lifecycle management, triggers, metrics, logs, auto-scaling
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Table, Button, Tag, Space, Tabs, message,
  Modal, Form, Input, Select, Popconfirm, Card, Row, Col, Statistic,
  Descriptions, Empty, Tooltip, Drawer,
} from 'antd';
import {
  CloudUploadOutlined,
  PlusOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  DeleteOutlined,
  RocketOutlined,
  ThunderboltOutlined,
  BarChartOutlined,
  FileTextOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import {
  createServerlessFunction, listServerlessFunctions,
  getServerlessFunction, updateServerlessFunction, deleteServerlessFunction,
  deployServerlessFunction, invokeServerlessFunction,
  getFunctionLogs, getAggregateMetrics,
  listTriggers, createTrigger, deleteTrigger,
  getAutoScalingRecommendations,
  type ServerlessFunction as Fn,
  type ServerlessTrigger,
  type ServerlessDeployment,
  type ServerlessLog,
  type AutoScalingRecommendation,
  type AggregateMetrics,
  type FunctionStatus,
  type FunctionRuntime,
  type TriggerType,
} from '@/api/serverless';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text, Paragraph } = Typography;

// ============================================================================
// Utility helpers
// ============================================================================

const statusColorMap: Record<FunctionStatus, string> = {
  draft: colors.neutral[500],
  deployed: colors.success[500],
  stopped: colors.warning[500],
  error: colors.error[500],
};

const statusLabelMap: Record<FunctionStatus, string> = {
  draft: '草稿',
  deployed: '已部署',
  stopped: '已停止',
  error: '错误',
};

const runtimeLabelMap: Record<FunctionRuntime, string> = {
  nodejs18: 'Node.js 18',
  nodejs20: 'Node.js 20',
  'python3.9': 'Python 3.9',
  'python3.11': 'Python 3.11',
  'go1.21': 'Go 1.21',
  java17: 'Java 17',
};

const triggerTypeLabelMap: Record<TriggerType, string> = {
  http: 'HTTP',
  cron: '定时任务',
  event: '事件',
  queue: '消息队列',
  kafka: 'Kafka',
  s3: '对象存储',
};

const triggerTypeColorMap: Record<TriggerType, string> = {
  http: colors.primary[500],
  cron: colors.success[500],
  event: colors.info[500],
  queue: colors.warning[500],
  kafka: colors.purple[500],
  s3: colors.neutral[700],
};

const scaleActionColorMap: Record<string, string> = {
  scale_up: colors.error[500],
  scale_down: colors.warning[500],
  no_change: colors.success[500],
};

const scaleActionLabelMap: Record<string, string> = {
  scale_up: '扩容',
  scale_down: '缩容',
  no_change: '不变',
};

const logLevelColorMap: Record<string, string> = {
  info: colors.info[500],
  warn: colors.warning[500],
  error: colors.error[500],
  debug: colors.neutral[500],
};

// ============================================================================
// Functions Tab
// ============================================================================

const FunctionsTab: React.FC = () => {
  const [functions, setFunctions] = useState<Fn[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [invokeModalOpen, setInvokeModalOpen] = useState(false);
  const [logsDrawerOpen, setLogsDrawerOpen] = useState(false);
  const [deployDrawerOpen, setDeployDrawerOpen] = useState(false);
  const [currentFn, setCurrentFn] = useState<Fn | null>(null);
  const [logs, setLogs] = useState<ServerlessLog[]>([]);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [invokeForm] = Form.useForm();
  const [invokeLoading, setInvokeLoading] = useState(false);
  const [deployLoading, setDeployLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listServerlessFunctions();
      setFunctions((res.data as { data?: Fn[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载函数列表失败');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async (values: any) => {
    try {
      await createServerlessFunction({
        name: values.name,
        description: values.description,
        runtime: values.runtime,
        handler: values.handler,
        memory: Number(values.memory),
        timeout: Number(values.timeout),
        code: values.code,
        replicas: { min: Number(values.replicasMin), max: Number(values.replicasMax) },
      });
      message.success('函数创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '创建失败');
    }
  };

  const handleEdit = async (values: any) => {
    if (!currentFn) return;
    try {
      await updateServerlessFunction(currentFn.id, {
        name: values.name,
        description: values.description,
        runtime: values.runtime,
        handler: values.handler,
        memory: Number(values.memory),
        timeout: Number(values.timeout),
        replicas: { min: Number(values.replicasMin), max: Number(values.replicasMax) },
      });
      message.success('函数更新成功');
      setEditModalOpen(false);
      editForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '更新失败');
    }
  };

  const handleDelete = async (fn: Fn) => {
    try {
      await deleteServerlessFunction(fn.id);
      message.success('函数删除成功');
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const handleDeploy = async () => {
    if (!currentFn) return;
    setDeployLoading(true);
    try {
      const res = await deployServerlessFunction(currentFn.id);
      const dep = (res.data as { data?: ServerlessDeployment })?.data;
      if (dep?.status === 'success') {
        message.success(`函数 ${currentFn.name} 部署成功`);
      } else {
        message.warning(`部署状态: ${dep?.status || '未知'}`);
      }
      setDeployDrawerOpen(false);
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '部署失败');
    } finally { setDeployLoading(false); }
  };

  const handleInvoke = async (values: any) => {
    if (!currentFn) return;
    setInvokeLoading(true);
    try {
      let payload: Record<string, unknown> | undefined;
      if (values.payload) {
        try { payload = JSON.parse(values.payload); } catch { payload = { raw: values.payload }; }
      }
      await invokeServerlessFunction(currentFn.id, payload);
      message.success('函数调用成功');
      setInvokeModalOpen(false);
      invokeForm.resetFields();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '调用失败');
    } finally { setInvokeLoading(false); }
  };

  const handleViewLogs = async (fn: Fn) => {
    setCurrentFn(fn);
    setLogsDrawerOpen(true);
    try {
      const res = await getFunctionLogs(fn.id, { limit: 50 });
      setLogs((res.data as { data?: ServerlessLog[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载日志失败');
    }
  };

  const handleViewDetail = async (fn: Fn) => {
    setCurrentFn(fn);
    setDetailDrawerOpen(true);
    try {
      const res = await getServerlessFunction(fn.id);
      setCurrentFn((res.data as { data?: Fn })?.data ?? fn);
    } catch { /* use existing data */ }
  };

  const handleOpenEdit = (fn: Fn) => {
    setCurrentFn(fn);
    editForm.setFieldsValue({
      name: fn.name,
      description: fn.description,
      runtime: fn.runtime,
      handler: fn.handler,
      memory: fn.memory,
      timeout: fn.timeout,
      replicasMin: fn.replicas.min,
      replicasMax: fn.replicas.max,
    });
    setEditModalOpen(true);
  };

  const columns = [
    { title: '函数名称', dataIndex: 'name', key: 'name', render: (v: string, r: Fn) => <a onClick={() => handleViewDetail(r)}>{v}</a> },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true, render: (v: string) => v || '-' },
    {
      title: '运行时', dataIndex: 'runtime', key: 'runtime',
      render: (r: FunctionRuntime) => <Tag color={colors.primary[500]}>{runtimeLabelMap[r] || r}</Tag>,
    },
    { title: '处理器', dataIndex: 'handler', key: 'handler' },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: FunctionStatus) => <Tag color={statusColorMap[s]}>{statusLabelMap[s]}</Tag>,
    },
    { title: '版本', dataIndex: 'version', key: 'version', render: (v: number) => `v${v}` },
    {
      title: '副本', dataIndex: 'replicas', key: 'replicas',
      render: (r: Fn['replicas']) => `${r.current} / ${r.min}-${r.max}`,
    },
    { title: '内存', dataIndex: 'memory', key: 'memory', render: (v: number) => `${v} MB` },
    { title: '超时', dataIndex: 'timeout', key: 'timeout', render: (v: number) => `${v}s` },
    { title: '端点', dataIndex: 'endpoint', key: 'endpoint', ellipsis: true, render: (v: string) => v ? <Tooltip title={v}><a href={v} target="_blank" rel="noreferrer">{v}</a></Tooltip> : '-' },
    {
      title: '操作', key: 'actions',
      render: (_: any, fn: Fn) => (
        <Space>
          <Tooltip title="部署"><Button size="small" icon={<RocketOutlined />} onClick={() => { setCurrentFn(fn); setDeployDrawerOpen(true); }} /></Tooltip>
          <Tooltip title="调用"><Button size="small" icon={<PlayCircleOutlined />} onClick={() => { setCurrentFn(fn); setInvokeModalOpen(true); }} /></Tooltip>
          <Tooltip title="日志"><Button size="small" icon={<FileTextOutlined />} onClick={() => handleViewLogs(fn)} /></Tooltip>
          <Tooltip title="编辑"><Button size="small" icon={<SettingOutlined />} onClick={() => handleOpenEdit(fn)} /></Tooltip>
          <Popconfirm title="确认删除此函数？" onConfirm={() => handleDelete(fn)}>
            <Button size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <div>
          <Title level={3} style={{ marginBottom: spacing.sm }}>
            <CloudUploadOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            Serverless 函数
          </Title>
          <Text type="secondary">管理无服务器函数的创建、部署、调用与监控</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setCreateModalOpen(true); }}>创建函数</Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={functions}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: <Empty description="暂无函数" image={Empty.PRESENTED_IMAGE_SIMPLE}><Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setCreateModalOpen(true); }}>创建第一个函数</Button></Empty> }}
      />

      {/* Create Modal */}
      <Modal title="创建 Serverless 函数" open={createModalOpen} onCancel={() => setCreateModalOpen(false)} onOk={() => form.submit()} width={700}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="函数名称" name="name" rules={[{ required: true, message: '请输入函数名称' }]}><Input placeholder="如: hello-world" /></Form.Item>
          <Form.Item label="描述" name="description"><Input.TextArea rows={2} placeholder="函数功能描述" /></Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="运行时" name="runtime" rules={[{ required: true }]} initialValue="nodejs18">
                <Select>
                  <Select.Option value="nodejs18">Node.js 18</Select.Option>
                  <Select.Option value="nodejs20">Node.js 20</Select.Option>
                  <Select.Option value="python3.9">Python 3.9</Select.Option>
                  <Select.Option value="python3.11">Python 3.11</Select.Option>
                  <Select.Option value="go1.21">Go 1.21</Select.Option>
                  <Select.Option value="java17">Java 17</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="处理器" name="handler" rules={[{ required: true }]} initialValue="index.handler"><Input placeholder="如: index.handler" /></Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item label="内存 (MB)" name="memory" rules={[{ required: true }]} initialValue={256}><Input type="number" min={128} max={3008} step={128} /></Form.Item></Col>
            <Col span={8}><Form.Item label="超时 (秒)" name="timeout" rules={[{ required: true }]} initialValue={30}><Input type="number" min={1} max={900} /></Form.Item></Col>
            <Col span={8}><Form.Item label="代码 (Base64)" name="code" rules={[{ required: true }]}><Input.TextArea rows={3} placeholder="Base64 编码的代码内容" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item label="最小副本" name="replicasMin" initialValue={0}><Input type="number" min={0} max={100} /></Form.Item></Col>
            <Col span={12}><Form.Item label="最大副本" name="replicasMax" initialValue={10}><Input type="number" min={1} max={1000} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal title="编辑函数" open={editModalOpen} onCancel={() => setEditModalOpen(false)} onOk={() => editForm.submit()} width={700}>
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item label="函数名称" name="name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="描述" name="description"><Input.TextArea rows={2} /></Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="运行时" name="runtime" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="nodejs18">Node.js 18</Select.Option>
                  <Select.Option value="nodejs20">Node.js 20</Select.Option>
                  <Select.Option value="python3.9">Python 3.9</Select.Option>
                  <Select.Option value="python3.11">Python 3.11</Select.Option>
                  <Select.Option value="go1.21">Go 1.21</Select.Option>
                  <Select.Option value="java17">Java 17</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="处理器" name="handler" rules={[{ required: true }]}><Input /></Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item label="内存 (MB)" name="memory" rules={[{ required: true }]}><Input type="number" min={128} max={3008} step={128} /></Form.Item></Col>
            <Col span={8}><Form.Item label="超时 (秒)" name="timeout" rules={[{ required: true }]}><Input type="number" min={1} max={900} /></Form.Item></Col>
            <Col span={8}><Form.Item label="最大副本" name="replicasMax"><Input type="number" min={1} max={1000} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      {/* Invoke Modal */}
      <Modal title="调用函数" open={invokeModalOpen} onCancel={() => setInvokeModalOpen(false)} onOk={() => invokeForm.submit()} confirmLoading={invokeLoading}>
        <Text>函数: <strong>{currentFn?.name}</strong></Text>
        <Form form={invokeForm} layout="vertical" onFinish={handleInvoke} style={{ marginTop: spacing.md }}>
          <Form.Item label="Payload (JSON)" name="payload">
            <Input.TextArea rows={4} placeholder='{"key": "value"}' />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer title="函数详情" open={detailDrawerOpen} onClose={() => setDetailDrawerOpen(false)} width={600}>
        {currentFn && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="名称" span={2}>{currentFn.name}</Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>{currentFn.description || '-'}</Descriptions.Item>
            <Descriptions.Item label="运行时">{runtimeLabelMap[currentFn.runtime]}</Descriptions.Item>
            <Descriptions.Item label="处理器">{currentFn.handler}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={statusColorMap[currentFn.status]}>{statusLabelMap[currentFn.status]}</Tag></Descriptions.Item>
            <Descriptions.Item label="版本">v{currentFn.version}</Descriptions.Item>
            <Descriptions.Item label="内存">{currentFn.memory} MB</Descriptions.Item>
            <Descriptions.Item label="超时">{currentFn.timeout}s</Descriptions.Item>
            <Descriptions.Item label="最小副本">{currentFn.replicas.min}</Descriptions.Item>
            <Descriptions.Item label="最大副本">{currentFn.replicas.max}</Descriptions.Item>
            <Descriptions.Item label="当前副本">{currentFn.replicas.current}</Descriptions.Item>
            <Descriptions.Item label="端点" span={2}>{currentFn.endpoint || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建时间" span={2}>{new Date(currentFn.createdAt).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="更新时间" span={2}>{new Date(currentFn.updatedAt).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="最近部署" span={2}>{currentFn.lastDeployedAt ? new Date(currentFn.lastDeployedAt).toLocaleString() : '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      {/* Deploy Drawer */}
      <Drawer title="部署函数" open={deployDrawerOpen} onClose={() => setDeployDrawerOpen(false)} width={500}>
        {currentFn && (
          <div>
            <Paragraph>即将部署 <strong>{currentFn.name}</strong> (v{currentFn.version + 1})</Paragraph>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: spacing.md }}>
              <Descriptions.Item label="函数">{currentFn.name}</Descriptions.Item>
              <Descriptions.Item label="当前版本">v{currentFn.version}</Descriptions.Item>
              <Descriptions.Item label="部署后版本">v{currentFn.version + 1}</Descriptions.Item>
              <Descriptions.Item label="运行时">{runtimeLabelMap[currentFn.runtime]}</Descriptions.Item>
              <Descriptions.Item label="内存">{currentFn.memory} MB</Descriptions.Item>
            </Descriptions>
            <Button type="primary" icon={<RocketOutlined />} onClick={handleDeploy} loading={deployLoading} block>
              开始部署
            </Button>
          </div>
        )}
      </Drawer>

      {/* Logs Drawer */}
      <Drawer title="函数日志" open={logsDrawerOpen} onClose={() => setLogsDrawerOpen(false)} width={700}>
        {currentFn && (
          <div>
            <Paragraph>函数: <strong>{currentFn.name}</strong></Paragraph>
            <Table
              columns={[
                { title: '级别', dataIndex: 'level', key: 'level', width: 80, render: (l: string) => <Tag color={logLevelColorMap[l]}>{l}</Tag> },
                { title: '消息', dataIndex: 'message', key: 'message', ellipsis: true },
                { title: '耗时', dataIndex: 'duration', key: 'duration', width: 80, render: (v: number) => v ? `${v}ms` : '-' },
                { title: '时间', dataIndex: 'timestamp', key: 'timestamp', width: 180, render: (v: string) => new Date(v).toLocaleString() },
              ]}
              dataSource={logs}
              rowKey="id"
              pagination={{ pageSize: 20 }}
              size="small"
              locale={{ emptyText: <Empty description="暂无日志" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
};

// ============================================================================
// Triggers Tab
// ============================================================================

const TriggersTab: React.FC = () => {
  const [triggers, setTriggers] = useState<ServerlessTrigger[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTriggers();
      setTriggers((res.data as { data?: ServerlessTrigger[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载触发器失败');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async (values: any) => {
    try {
      const config: ServerlessTrigger['config'] = {};
      if (values.type === 'http') {
        config.method = values.method || 'GET';
        config.path = values.path;
      } else if (values.type === 'cron') {
        config.schedule = values.schedule;
      } else if (values.type === 'event' || values.type === 'queue' || values.type === 'kafka') {
        config.eventSource = values.eventSource;
      } else if (values.type === 's3') {
        config.pattern = values.pattern;
      }

      await createTrigger({
        functionId: values.functionId,
        type: values.type,
        name: values.name,
        config,
      });
      message.success('触发器创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '创建失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTrigger(id);
      message.success('触发器删除成功');
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const columns = [
    { title: '触发器名称', dataIndex: 'name', key: 'name' },
    {
      title: '类型', dataIndex: 'type', key: 'type',
      render: (t: TriggerType) => <Tag color={triggerTypeColorMap[t]}>{triggerTypeLabelMap[t]}</Tag>,
    },
    { title: '函数 ID', dataIndex: 'functionId', key: 'functionId', ellipsis: true },
    {
      title: '配置', dataIndex: 'config', key: 'config',
      render: (c: ServerlessTrigger['config']) => {
        const parts: string[] = [];
        if (c.method && c.path) parts.push(`${c.method} ${c.path}`);
        if (c.schedule) parts.push(`Schedule: ${c.schedule}`);
        if (c.eventSource) parts.push(`Source: ${c.eventSource}`);
        if (c.pattern) parts.push(`Pattern: ${c.pattern}`);
        return parts.join(' | ') || '-';
      },
    },
    { title: '状态', dataIndex: 'enabled', key: 'enabled', render: (e: boolean) => <Tag color={e ? colors.success[500] : colors.neutral[500]}>{e ? '启用' : '禁用'}</Tag> },
    { title: '调用次数', dataIndex: 'invocationCount', key: 'invocationCount' },
    { title: '最近调用', dataIndex: 'lastInvokedAt', key: 'lastInvokedAt', render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    {
      title: '操作', key: 'actions',
      render: (_: any, t: ServerlessTrigger) => (
        <Popconfirm title="确认删除？" onConfirm={() => handleDelete(t.id)}>
          <Button size="small" icon={<DeleteOutlined />} danger>删除</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <div>
          <Title level={3} style={{ marginBottom: spacing.sm }}>
            <ThunderboltOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            事件触发器
          </Title>
          <Text type="secondary">管理函数的触发条件：HTTP、定时、事件、消息队列等</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setCreateModalOpen(true); }}>创建触发器</Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={triggers}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: <Empty description="暂无触发器" image={Empty.PRESENTED_IMAGE_SIMPLE}><Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setCreateModalOpen(true); }}>创建第一个触发器</Button></Empty> }}
      />

      {/* Create Trigger Modal */}
      <Modal title="创建触发器" open={createModalOpen} onCancel={() => setCreateModalOpen(false)} onOk={() => form.submit()} width={600}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="触发器名称" name="name" rules={[{ required: true }]}><Input placeholder="如: daily-cron" /></Form.Item>
          <Form.Item label="目标函数 ID" name="functionId" rules={[{ required: true }]}><Input placeholder="选择关联的函数" /></Form.Item>
          <Form.Item label="触发类型" name="type" rules={[{ required: true }]} initialValue="http">
            <Select>
              <Select.Option value="http">HTTP</Select.Option>
              <Select.Option value="cron">定时任务</Select.Option>
              <Select.Option value="event">事件</Select.Option>
              <Select.Option value="queue">消息队列</Select.Option>
              <Select.Option value="kafka">Kafka</Select.Option>
              <Select.Option value="s3">对象存储</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.type !== curr.type}>
            {({ getFieldValue }) => {
              const type = getFieldValue('type');
              if (type === 'http') {
                return (
                  <>
                    <Row gutter={16}>
                      <Col span={8}><Form.Item label="Method" name="method" initialValue="GET"><Select><Select.Option value="GET">GET</Select.Option><Select.Option value="POST">POST</Select.Option><Select.Option value="PUT">PUT</Select.Option><Select.Option value="DELETE">DELETE</Select.Option></Select></Form.Item></Col>
                      <Col span={16}><Form.Item label="Path" name="path" rules={[{ required: true }]}><Input placeholder="/api/v1/hello" /></Form.Item></Col>
                    </Row>
                  </>
                );
              }
              if (type === 'cron') {
                return <Form.Item label="Cron 表达式" name="schedule" rules={[{ required: true }]}><Input placeholder="0 0 * * *" /></Form.Item>;
              }
              if (['event', 'queue', 'kafka'].includes(type)) {
                return <Form.Item label="事件源" name="eventSource" rules={[{ required: true }]}><Input placeholder={type === 'kafka' ? 'topic-name' : 'event-source'} /></Form.Item>;
              }
              if (type === 's3') {
                return <Form.Item label="Key 模式" name="pattern" rules={[{ required: true }]}><Input placeholder="uploads/*.json" /></Form.Item>;
              }
              return null;
            }}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ============================================================================
// Metrics Tab
// ============================================================================

const MetricsTab: React.FC = () => {
  const [aggregate, setAggregate] = useState<AggregateMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<AutoScalingRecommendation[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [aggRes, scaleRes] = await Promise.all([getAggregateMetrics(), getAutoScalingRecommendations()]);
      setAggregate((aggRes.data as { data?: AggregateMetrics })?.data ?? null);
      setRecommendations((scaleRes.data as { data?: AutoScalingRecommendation[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载指标失败');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <div>
          <Title level={3} style={{ marginBottom: spacing.sm }}>
            <BarChartOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            Serverless 指标
          </Title>
          <Text type="secondary">函数运行指标、错误率与自动扩缩容建议</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
      </div>

      {aggregate && (
        <Row gutter={16} style={{ marginBottom: spacing.md }}>
          <Col span={4}><Card><Statistic title="函数总数" value={aggregate.totalFunctions} /></Card></Col>
          <Col span={4}><Card><Statistic title="已部署" value={aggregate.deployedFunctions} valueStyle={{ color: colors.success[500] }} /></Card></Col>
          <Col span={4}><Card><Statistic title="总调用" value={aggregate.totalInvocations} /></Card></Col>
          <Col span={4}><Card><Statistic title="错误数" value={aggregate.totalErrors} valueStyle={{ color: aggregate.totalErrors > 0 ? colors.error[500] : colors.success[500] }} /></Card></Col>
          <Col span={4}><Card><Statistic title="平均耗时" value={`${aggregate.avgDuration}ms`} /></Card></Col>
          <Col span={4}><Card><Statistic title="错误率" value={`${aggregate.errorRate}%`} valueStyle={{ color: aggregate.errorRate > 1 ? colors.error[500] : colors.success[500] }} /></Card></Col>
        </Row>
      )}

      <Card title="自动扩缩容建议">
        <Table
          columns={[
            { title: '函数', dataIndex: 'functionName', key: 'functionName' },
            { title: '当前副本', dataIndex: 'currentReplicas', key: 'currentReplicas' },
            {
              title: '建议副本', dataIndex: 'suggestedReplicas', key: 'suggestedReplicas',
              render: (v: number, r: AutoScalingRecommendation) => (
                <span style={{ color: r.action === 'scale_up' ? colors.error[500] : r.action === 'scale_down' ? colors.warning[500] : colors.neutral[900] }}>
                  {r.currentReplicas} → {v}
                </span>
              ),
            },
            {
              title: '操作', dataIndex: 'action', key: 'action',
              render: (a: string) => <Tag color={scaleActionColorMap[a]}>{scaleActionLabelMap[a]}</Tag>,
            },
            { title: '原因', dataIndex: 'reason', key: 'reason', ellipsis: true, render: (v: string) => v || '-' },
          ]}
          dataSource={recommendations}
          rowKey="functionId"
          loading={loading}
          pagination={false}
          size="small"
          locale={{ emptyText: <Empty description="无扩缩容建议" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        />
      </Card>
    </div>
  );
};

// ============================================================================
// Main Page
// ============================================================================

const ServerlessPage: React.FC = () => {
  const tabItems = [
    { key: 'functions', label: '函数管理', children: <FunctionsTab /> },
    { key: 'triggers', label: '事件触发器', children: <TriggersTab /> },
    { key: 'metrics', label: '指标与扩缩容', children: <MetricsTab /> },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Tabs defaultActiveKey="functions" items={tabItems} size="large" />
    </div>
  );
};

export default ServerlessPage;
