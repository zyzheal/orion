/**
 * DigitalTwinPage - 数字孪生管理页 (Enhanced Phase 4)
 *
 * 功能: 孪生体列表、环境快照、沙箱环境、流量录制/回放
 * Uses real API connections for all operations
 */

import React, { useState, useEffect } from 'react';
import {
  Table, Card, Button, Space, Tag, Modal, Form, Input, message,
  Tabs, Select, Descriptions, Progress, InputNumber,
  Statistic, Row, Col,
} from 'antd';
import {
  PlusOutlined, PlayCircleOutlined,
  CameraOutlined, SyncOutlined,
  StopOutlined, CloudServerOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import {
  digitalTwinApi,
  type DigitalTwin,
  type TwinSnapshot,
  type TrafficRecording,
  type TrafficReplay,
} from '@/api/digital-twin';

const statusColorMap: Record<string, string> = {
  active: 'green',
  inactive: 'default',
  creating: 'blue',
  ready: 'green',
  failed: 'red',
  restoring: 'processing',
  recording: 'purple',
  completed: 'green',
  stopped: 'default',
  running: 'processing',
  pending: 'default',
};

const statusLabelMap: Record<string, string> = {
  active: '活跃',
  inactive: '未激活',
  creating: '创建中',
  ready: '就绪',
  failed: '失败',
  restoring: '恢复中',
  recording: '录制中',
  completed: '已完成',
  stopped: '已停止',
  running: '运行中',
  pending: '等待中',
};

const DigitalTwinPage: React.FC = () => {
  const [twins, setTwins] = useState<DigitalTwin[]>([]);
  const [snapshots, setSnapshots] = useState<TwinSnapshot[]>([]);
  const [recordings, setRecordings] = useState<TrafficRecording[]>([]);
  const [replays, setReplays] = useState<TrafficReplay[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [replayModalOpen, setReplayModalOpen] = useState(false);
  const [sandboxModalOpen, setSandboxModalOpen] = useState(false);
  const [selectedTwin, setSelectedTwin] = useState<DigitalTwin | null>(null);
  const [form] = Form.useForm();
  const [recordForm] = Form.useForm();
  const [replayForm] = Form.useForm();
  const [sandboxForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [twinsRes, snapshotsRes, recordingsRes, replaysRes] = await Promise.allSettled([
        digitalTwinApi.listTwins(),
        digitalTwinApi.listSnapshots(),
        digitalTwinApi.listRecordings(),
        digitalTwinApi.listReplays(),
      ]);

      if (twinsRes.status === 'fulfilled') {
        setTwins(Array.isArray(twinsRes.value) ? twinsRes.value : []);
      }
      if (snapshotsRes.status === 'fulfilled') {
        setSnapshots(Array.isArray(snapshotsRes.value) ? snapshotsRes.value : []);
      }
      if (recordingsRes.status === 'fulfilled') {
        setRecordings(Array.isArray(recordingsRes.value) ? recordingsRes.value : []);
      }
      if (replaysRes.status === 'fulfilled') {
        setReplays(Array.isArray(replaysRes.value) ? replaysRes.value : []);
      }
    } catch (error: unknown) {
      message.error(`加载数字孪生数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    try {
      await digitalTwinApi.registerTwin({
        name: values.name,
        environment: values.environment,
      });
      message.success('孪生体创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(`创建失败: ${(error as Error).message}`);
    }
  };

  const handleSnapshot = async (twin: DigitalTwin) => {
    try {
      await digitalTwinApi.createSnapshot({
        environment: twin.environment,
        note: `Snapshot for ${twin.name}`,
      });
      message.success('快照创建成功');
      loadData();
    } catch (error: unknown) {
      message.error(`快照创建失败: ${(error as Error).message}`);
    }
  };

  const handleStartRecording = async (values: any) => {
    try {
      await digitalTwinApi.startRecording({
        source_env: values.sourceEnv,
        path_prefixes: values.filterPatterns ? [values.filterPatterns] : undefined,
      });
      message.success('流量录制已启动');
      setRecordModalOpen(false);
      recordForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(`启动录制失败: ${(error as Error).message}`);
    }
  };

  const handleStopRecording = async (recordingId: string) => {
    try {
      await digitalTwinApi.stopRecording(recordingId);
      message.success('录制已停止');
      loadData();
    } catch (error: unknown) {
      message.error(`停止录制失败: ${(error as Error).message}`);
    }
  };

  const handleStartReplay = async (values: any) => {
    try {
      await digitalTwinApi.startReplay({
        recording_id: values.recordingId,
        target_env: values.targetEnv,
        speed_multiplier: values.speedMultiplier || 1,
      });
      message.success('流量回放已启动');
      setReplayModalOpen(false);
      replayForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(`启动回放失败: ${(error as Error).message}`);
    }
  };

  const handleCreateSandbox = async (values: any) => {
    try {
      await digitalTwinApi.createSandbox({
        name: values.name,
        snapshot_id: values.snapshotId || undefined,
        description: values.description || undefined,
      });
      message.success('沙箱创建成功');
      setSandboxModalOpen(false);
      sandboxForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(`创建沙箱失败: ${(error as Error).message}`);
    }
  };

  // Stats
  const activeTwins = twins.filter((t) => t.status === 'active').length;
  const activeRecordings = recordings.filter((r) => r.status === 'recording').length;
  const runningReplays = replays.filter((r) => r.status === 'running').length;

  // Twin columns
  const twinColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      render: (text: string, record: DigitalTwin) => (
        <a onClick={() => setSelectedTwin(record)}>{text}</a>
      ),
    },
    { title: '环境', dataIndex: 'environment', key: 'environment', width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => <Tag color={statusColorMap[s] || 'default'}>{statusLabelMap[s] || s}</Tag>,
    },
    {
      title: '服务数',
      key: 'services',
      width: 80,
      render: (_: unknown, record: DigitalTwin) => record.services?.length || 0,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: DigitalTwin) => (
        <Space>
          <Button size="small" icon={<CameraOutlined />} onClick={() => handleSnapshot(record)}>
            快照
          </Button>
        </Space>
      ),
    },
  ];

  // Snapshot columns
  const snapshotColumns = [
    { title: '环境', dataIndex: 'environment', key: 'environment', width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => <Tag color={statusColorMap[s] || 'default'}>{statusLabelMap[s] || s}</Tag>,
    },
    {
      title: '组件数',
      key: 'components',
      width: 80,
      render: (_: unknown, record: TwinSnapshot) => record.components?.length || 0,
    },
    {
      title: '大小',
      key: 'size',
      width: 100,
      render: (_: unknown, record: TwinSnapshot) => {
        const bytes = record.size_bytes || 0;
        if (bytes > 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
        if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / 1024).toFixed(1)} KB`;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
  ];

  // Recording columns
  const recordingColumns = [
    { title: '来源环境', dataIndex: 'source_env', key: 'source_env', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => <Tag color={statusColorMap[s] || 'default'}>{statusLabelMap[s] || s}</Tag>,
    },
    {
      title: '请求数',
      dataIndex: 'request_count',
      key: 'request_count',
      width: 100,
      render: (v: number) => v?.toLocaleString() || 0,
    },
    {
      title: '开始时间',
      dataIndex: 'started_at',
      key: 'started_at',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: TrafficRecording) =>
        record.status === 'recording' ? (
          <Button size="small" icon={<StopOutlined />} onClick={() => handleStopRecording(record.id)}>
            停止
          </Button>
        ) : (
          <Tag>已完成</Tag>
        ),
    },
  ];

  // Replay columns
  const replayColumns = [
    {
      title: '录制ID',
      dataIndex: 'recording_id',
      key: 'recording_id',
      width: 140,
      render: (v: string) => v?.slice(0, 12) + '...',
    },
    { title: '目标环境', dataIndex: 'target_env', key: 'target_env', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => <Tag color={statusColorMap[s] || 'default'}>{statusLabelMap[s] || s}</Tag>,
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      width: 120,
      render: (v: number) => <Progress percent={v} size="small" />,
    },
    { title: '匹配', dataIndex: 'matched_count', key: 'matched_count', width: 80, render: (v: number) => <Tag color="green">{v}</Tag> },
    { title: '不匹配', dataIndex: 'mismatched_count', key: 'mismatched_count', width: 80, render: (v: number) => <Tag color="red">{v}</Tag> },
    {
      title: '开始时间',
      dataIndex: 'started_at',
      key: 'started_at',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>数字孪生</h2>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            创建孪生体
          </Button>
          <Button icon={<SyncOutlined />} onClick={() => setRecordModalOpen(true)}>
            开始录制
          </Button>
          <Button icon={<PlayCircleOutlined />} onClick={() => setReplayModalOpen(true)}>
            流量回放
          </Button>
          <Button icon={<CloudServerOutlined />} onClick={() => setSandboxModalOpen(true)}>
            创建沙箱
          </Button>
          <Button icon={<CameraOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Summary Statistics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="孪生体总数" value={twins.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="活跃孪生体" value={activeTwins} valueStyle={{ color: colors.success[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="活跃录制" value={activeRecordings} valueStyle={{ color: colors.primary[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="回放会话" value={runningReplays} valueStyle={{ color: colors.purple[500] }} />
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
      <Tabs
        items={[
          {
            key: 'twins',
            label: '孪生体列表',
            children: (
              <Table
                columns={twinColumns}
                dataSource={twins}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
              />
            ),
          },
          {
            key: 'snapshots',
            label: '快照管理',
            children: (
              <Table
                columns={snapshotColumns}
                dataSource={snapshots}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
              />
            ),
          },
          {
            key: 'recording',
            label: '流量录制',
            children: (
              <Table
                columns={recordingColumns}
                dataSource={recordings}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
              />
            ),
          },
          {
            key: 'replay',
            label: '流量回放',
            children: (
              <Table
                columns={replayColumns}
                dataSource={replays}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
              />
            ),
          },
        ]}
      />

      {/* Selected Twin Detail */}
      {selectedTwin && (
        <Card
          title="孪生体详情"
          style={{ marginTop: 16 }}
          extra={<Button onClick={() => setSelectedTwin(null)}>关闭</Button>}
        >
          <Descriptions column={2}>
            <Descriptions.Item label="名称">{selectedTwin.name}</Descriptions.Item>
            <Descriptions.Item label="环境">{selectedTwin.environment}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColorMap[selectedTwin.status]}>
                {statusLabelMap[selectedTwin.status]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="服务数">{selectedTwin.services?.length || 0}</Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {new Date(selectedTwin.created_at).toLocaleString('zh-CN')}
            </Descriptions.Item>
          </Descriptions>
          {selectedTwin.services && selectedTwin.services.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <strong>关联服务:</strong>
              <div style={{ marginTop: 8 }}>
                {selectedTwin.services.map((s: string) => (
                  <Tag key={s}>{s}</Tag>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Create Twin Modal */}
      <Modal
        title="创建孪生体"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如: Production Twin" />
          </Form.Item>
          <Form.Item name="environment" label="环境" rules={[{ required: true, message: '请选择环境' }]}>
            <Select
              options={[
                { label: '生产环境', value: 'prod' },
                { label: '预发环境', value: 'staging' },
                { label: '开发环境', value: 'dev' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Start Recording Modal */}
      <Modal
        title="开始流量录制"
        open={recordModalOpen}
        onCancel={() => setRecordModalOpen(false)}
        onOk={() => recordForm.submit()}
      >
        <Form form={recordForm} layout="vertical" onFinish={handleStartRecording}>
          <Form.Item name="sourceEnv" label="来源环境" rules={[{ required: true, message: '请选择环境' }]}>
            <Select
              options={[
                { label: '生产环境', value: 'prod' },
                { label: '预发环境', value: 'staging' },
              ]}
            />
          </Form.Item>
          <Form.Item name="filterPatterns" label="路径过滤">
            <Input placeholder="/api/v1/*" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Start Replay Modal */}
      <Modal
        title="开始流量回放"
        open={replayModalOpen}
        onCancel={() => setReplayModalOpen(false)}
        onOk={() => replayForm.submit()}
      >
        <Form form={replayForm} layout="vertical" onFinish={handleStartReplay}>
          <Form.Item name="recordingId" label="录制会话" rules={[{ required: true, message: '请选择录制会话' }]}>
            <Select
              options={recordings
                .filter((r) => r.status === 'completed')
                .map((r) => ({
                  label: `${r.source_env} - ${new Date(r.started_at).toLocaleString('zh-CN')}`,
                  value: r.id,
                }))}
            />
          </Form.Item>
          <Form.Item name="targetEnv" label="目标环境" rules={[{ required: true, message: '请选择目标环境' }]}>
            <Select
              options={[
                { label: '预发环境', value: 'staging' },
                { label: '开发环境', value: 'dev' },
              ]}
            />
          </Form.Item>
          <Form.Item name="speedMultiplier" label="速度倍数" initialValue={1}>
            <InputNumber min={0.1} max={10} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Create Sandbox Modal */}
      <Modal
        title="创建沙箱环境"
        open={sandboxModalOpen}
        onCancel={() => setSandboxModalOpen(false)}
        onOk={() => sandboxForm.submit()}
      >
        <Form form={sandboxForm} layout="vertical" onFinish={handleCreateSandbox}>
          <Form.Item name="name" label="沙箱名称" rules={[{ required: true, message: '请输入沙箱名称' }]}>
            <Input placeholder="沙箱环境名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="沙箱描述" />
          </Form.Item>
          <Form.Item name="snapshotId" label="快照ID">
            <Select
              options={snapshots
                .filter((s) => s.status === 'ready')
                .map((s) => ({
                  label: `${s.environment} - ${new Date(s.created_at).toLocaleString('zh-CN')}`,
                  value: s.id,
                }))}
              allowClear
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DigitalTwinPage;
