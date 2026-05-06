/**
 * DigitalTwinPage - 数字孪生管理页 (Enhanced Phase 4)
 *
 * 功能: 孪生体列表、环境快照、沙箱环境、流量录制/回放
 * Enhanced with recording session management, replay status, and sandbox lifecycle controls.
 */

import React, { useState } from 'react';
import { Table, Card, Button, Space, Tag, Modal, Form, Input, message, Tabs, Select, Descriptions, Timeline, Progress, InputNumber, Switch, Statistic, Row, Col } from 'antd';
import { PlusOutlined, PlayCircleOutlined, PauseCircleOutlined, CameraOutlined, SyncOutlined, CodeSandboxOutlined, StopOutlined, CloudServerOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

interface DigitalTwin {
  id: string;
  name: string;
  environment: string;
  status: 'active' | 'snapshot' | 'sandbox' | 'recording';
  lastSnapshot: string;
  trafficRecorded: number;
  createdAt: string;
}

interface Snapshot {
  id: string;
  twinId: string;
  name: string;
  createdAt: string;
  status: 'completed' | 'in_progress' | 'failed';
}

interface RecordingSession {
  id: string;
  twinId: string;
  name: string;
  status: 'active' | 'paused' | 'completed';
  recordCount: number;
  startedAt: string;
  completedAt?: string;
}

interface ReplaySession {
  id: string;
  twinId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  totalRequests: number;
  matchedRequests: number;
  failedRequests: number;
  startedAt?: string;
  completedAt?: string;
}

interface SandboxEnv {
  id: string;
  twinId: string;
  name: string;
  status: 'creating' | 'running' | 'stopped' | 'error' | 'destroying';
  endpoint: string;
  createdAt: string;
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
}

const MOCK_TWINS: DigitalTwin[] = [
  { id: 'twin-1', name: 'Production Twin', environment: 'prod', status: 'active', lastSnapshot: '2026-05-05 10:00', trafficRecorded: 85, createdAt: '2026-04-01' },
  { id: 'twin-2', name: 'Staging Twin', environment: 'staging', status: 'sandbox', lastSnapshot: '2026-05-04 18:00', trafficRecorded: 42, createdAt: '2026-04-15' },
  { id: 'twin-3', name: 'Dev Twin', environment: 'dev', status: 'recording', lastSnapshot: '2026-05-03 12:00', trafficRecorded: 12, createdAt: '2026-05-01' },
];

const MOCK_SNAPSHOTS: Snapshot[] = [
  { id: 'snap-1', twinId: 'twin-1', name: 'Prod Snapshot #12', createdAt: '2026-05-05 10:00', status: 'completed' },
  { id: 'snap-2', twinId: 'twin-1', name: 'Prod Snapshot #11', createdAt: '2026-05-04 10:00', status: 'completed' },
];

const statusColor: Record<string, string> = { active: 'green', snapshot: 'blue', sandbox: 'orange', recording: 'purple' };

const DigitalTwinPage: React.FC = () => {
  const [twins, setTwins] = useState<DigitalTwin[]>(MOCK_TWINS);
  const [snapshots, setSnapshots] = useState<Snapshot[]>(MOCK_SNAPSHOTS);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTwin, setSelectedTwin] = useState<DigitalTwin | null>(null);
  const [form] = Form.useForm();
  const [recordForm] = Form.useForm();
  const [replayForm] = Form.useForm();
  const [sandboxForm] = Form.useForm();

  // Phase 4 state
  const [recordingSessions, setRecordingSessions] = useState<RecordingSession[]>([]);
  const [replaySessions, setReplaySessions] = useState<ReplaySession[]>([]);
  const [sandboxes, setSandboxes] = useState<SandboxEnv[]>([]);
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [replayModalOpen, setReplayModalOpen] = useState(false);
  const [sandboxModalOpen, setSandboxModalOpen] = useState(false);

  const handleCreate = async (values: any) => {
    const newTwin: DigitalTwin = {
      id: `twin-${Date.now()}`,
      name: values.name,
      environment: values.environment,
      status: 'active',
      lastSnapshot: '-',
      trafficRecorded: 0,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setTwins([...twins, newTwin]);
    message.success('孪生体创建成功');
    setCreateModalOpen(false);
    form.resetFields();
  };

  const handleSnapshot = async (twin: DigitalTwin) => {
    const snap: Snapshot = { id: `snap-${Date.now()}`, twinId: twin.id, name: `${twin.name} Snapshot`, createdAt: new Date().toLocaleString(), status: 'completed' };
    setSnapshots([snap, ...snapshots]);
    message.success('快照创建成功');
  };

  const handleReplay = async (twin: DigitalTwin) => {
    message.info(`开始回放 ${twin.name} 的流量`);
  };

  // Phase 4: Recording handlers
  const handleStartRecording = async (values: any) => {
    const session: RecordingSession = {
      id: `rec-${Date.now()}`,
      twinId: values.twinId,
      name: values.name,
      status: 'active',
      recordCount: 0,
      startedAt: new Date().toISOString(),
    };
    setRecordingSessions([...recordingSessions, session]);
    // Update twin status
    setTwins(twins.map((t) => t.id === values.twinId ? { ...t, status: 'recording' as const } : t));
    message.success(`Recording "${values.name}" started`);
    setRecordModalOpen(false);
    recordForm.resetFields();
  };

  const handleStopRecording = async (sessionId: string) => {
    setRecordingSessions(recordingSessions.map((s) =>
      s.id === sessionId ? { ...s, status: 'completed' as const, completedAt: new Date().toISOString() } : s,
    ));
    message.success('Recording stopped');
  };

  // Phase 4: Replay handlers
  const handleStartReplay = async (values: any) => {
    const replay: ReplaySession = {
      id: `replay-${Date.now()}`,
      twinId: values.twinId,
      status: 'running',
      progress: 0,
      totalRequests: values.requestCount || 100,
      matchedRequests: 0,
      failedRequests: 0,
      startedAt: new Date().toISOString(),
    };
    setReplaySessions([...replaySessions, replay]);
    message.success(`Replay session started for twin ${values.twinId}`);
    setReplayModalOpen(false);
    replayForm.resetFields();
  };

  // Phase 4: Sandbox handlers
  const handleCreateSandbox = async (values: any) => {
    const sandbox: SandboxEnv = {
      id: `sandbox-${Date.now()}`,
      twinId: values.twinId,
      name: values.name,
      status: 'running',
      endpoint: `http://sandbox-${Date.now()}.local:9000`,
      createdAt: new Date().toISOString(),
      healthStatus: 'healthy',
    };
    setSandboxes([...sandboxes, sandbox]);
    setTwins(twins.map((t) => t.id === values.twinId ? { ...t, status: 'sandbox' as const } : t));
    message.success(`Sandbox "${values.name}" created`);
    setSandboxModalOpen(false);
    sandboxForm.resetFields();
  };

  const handleStopSandbox = async (sandboxId: string) => {
    setSandboxes(sandboxes.map((s) =>
      s.id === sandboxId ? { ...s, status: 'stopped' as const, healthStatus: 'unknown' as const } : s,
    ));
    message.success('Sandbox stopped');
  };

  const handleDestroySandbox = async (sandboxId: string) => {
    setSandboxes(sandboxes.filter((s) => s.id !== sandboxId));
    message.success('Sandbox destroyed');
  };

  const twinColumns: ColumnsType<DigitalTwin> = [
    { title: '名称', dataIndex: 'name', key: 'name', render: (text: string, record) => <a onClick={() => setSelectedTwin(record)}>{text}</a> },
    { title: '环境', dataIndex: 'environment', key: 'environment' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={statusColor[s]}>{s}</Tag> },
    { title: '最后快照', dataIndex: 'lastSnapshot', key: 'lastSnapshot' },
    { title: '流量录制', dataIndex: 'trafficRecorded', key: 'trafficRecorded', render: (v: number) => <Progress percent={v} size="small" /> },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt' },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<CameraOutlined />} onClick={() => handleSnapshot(record)}>快照</Button>
          <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleReplay(record)}>回放</Button>
          <Button size="small" icon={<CodeSandboxOutlined />}>沙箱</Button>
        </Space>
      ),
    },
  ];

  const snapshotColumns: ColumnsType<Snapshot> = [
    { title: '快照名称', dataIndex: 'name', key: 'name' },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={s === 'completed' ? 'green' : s === 'failed' ? 'red' : 'blue'}>{s}</Tag> },
  ];

  const recordingColumns: ColumnsType<RecordingSession> = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => (
      <Tag color={s === 'active' ? 'green' : s === 'paused' ? 'orange' : 'default'}>{s}</Tag>
    )},
    { title: '录制数量', dataIndex: 'recordCount', key: 'recordCount' },
    { title: '开始时间', dataIndex: 'startedAt', key: 'startedAt', render: (d: string) => new Date(d).toLocaleString() },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        record.status === 'active' ? (
          <Button size="small" icon={<StopOutlined />} onClick={() => handleStopRecording(record.id)}>停止</Button>
        ) : (
          <Tag>已完成</Tag>
        )
      ),
    },
  ];

  const replayColumns: ColumnsType<ReplaySession> = [
    { title: 'ID', dataIndex: 'id', key: 'id', render: (v: string) => v.slice(0, 12) + '...' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => (
      <Tag color={s === 'completed' ? 'green' : s === 'running' ? 'blue' : s === 'failed' ? 'red' : 'default'}>{s}</Tag>
    )},
    { title: '进度', dataIndex: 'progress', key: 'progress', render: (v: number) => <Progress percent={v} size="small" /> },
    { title: '总请求', dataIndex: 'totalRequests', key: 'totalRequests' },
    { title: '匹配', dataIndex: 'matchedRequests', key: 'matchedRequests', render: (v: number) => <Tag color="green">{v}</Tag> },
    { title: '失败', dataIndex: 'failedRequests', key: 'failedRequests', render: (v: number) => <Tag color="red">{v}</Tag> },
  ];

  const sandboxColumns: ColumnsType<SandboxEnv> = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '端点', dataIndex: 'endpoint', key: 'endpoint' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => (
      <Tag color={s === 'running' ? 'green' : s === 'stopped' ? 'orange' : 'red'}>{s}</Tag>
    )},
    { title: '健康', dataIndex: 'healthStatus', key: 'healthStatus', render: (s: string) => (
      <Tag color={s === 'healthy' ? 'green' : 'default'}>{s}</Tag>
    )},
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (d: string) => new Date(d).toLocaleString() },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {record.status === 'running' && (
            <Button size="small" icon={<PauseCircleOutlined />} onClick={() => handleStopSandbox(record.id)}>停止</Button>
          )}
          <Button size="small" danger onClick={() => handleDestroySandbox(record.id)}>销毁</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>数字孪生</h2>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>创建孪生体</Button>
          <Button icon={<SyncOutlined />} onClick={() => setRecordModalOpen(true)}>开始录制</Button>
          <Button icon={<SyncOutlined />} onClick={() => setReplayModalOpen(true)}>流量回放</Button>
          <Button icon={<CloudServerOutlined />} onClick={() => setSandboxModalOpen(true)}>创建沙箱</Button>
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
            <Statistic title="活跃录制" value={recordingSessions.filter((s) => s.status === 'active').length} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="运行中沙箱" value={sandboxes.filter((s) => s.status === 'running').length} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="回放会话" value={replaySessions.length} />
          </Card>
        </Col>
      </Row>

      <Tabs
        items={[
          {
            key: 'twins',
            label: '孪生体列表',
            children: (
              <Table columns={twinColumns} dataSource={twins} rowKey="id" pagination={{ pageSize: 10 }} />
            ),
          },
          {
            key: 'snapshots',
            label: '快照管理',
            children: (
              <Table columns={snapshotColumns} dataSource={snapshots} rowKey="id" pagination={{ pageSize: 10 }} />
            ),
          },
          {
            key: 'recording',
            label: '流量录制',
            children: (
              <Card
                title="录制会话管理"
                extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setRecordModalOpen(true)}>新建录制</Button>}
              >
                <Table columns={recordingColumns} dataSource={recordingSessions} rowKey="id" pagination={{ pageSize: 10 }} />
              </Card>
            ),
          },
          {
            key: 'replay',
            label: '流量回放',
            children: (
              <Card
                title="回放会话管理"
                extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setReplayModalOpen(true)}>新建回放</Button>}
              >
                <Table columns={replayColumns} dataSource={replaySessions} rowKey="id" pagination={{ pageSize: 10 }} />
              </Card>
            ),
          },
          {
            key: 'sandboxes',
            label: '沙箱环境',
            children: (
              <Card
                title="沙箱管理"
                extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setSandboxModalOpen(true)}>创建沙箱</Button>}
              >
                <Table columns={sandboxColumns} dataSource={sandboxes} rowKey="id" pagination={{ pageSize: 10 }} />
              </Card>
            ),
          },
        ]}
      />

      {selectedTwin && (
        <Card title="孪生体详情" style={{ marginTop: 16 }} extra={<Button onClick={() => setSelectedTwin(null)}>关闭</Button>}>
          <Descriptions column={2}>
            <Descriptions.Item label="名称">{selectedTwin.name}</Descriptions.Item>
            <Descriptions.Item label="环境">{selectedTwin.environment}</Descriptions.Item>
            <Descriptions.Item label="状态">{selectedTwin.status}</Descriptions.Item>
            <Descriptions.Item label="流量录制">{selectedTwin.trafficRecorded}%</Descriptions.Item>
          </Descriptions>
          <Timeline style={{ marginTop: 16 }}>
            <Timeline.Item>最后快照: {selectedTwin.lastSnapshot}</Timeline.Item>
            <Timeline.Item>创建时间: {selectedTwin.createdAt}</Timeline.Item>
          </Timeline>
        </Card>
      )}

      {/* Create Twin Modal */}
      <Modal title="创建孪生体" open={createModalOpen} onCancel={() => setCreateModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="孪生体名称" />
          </Form.Item>
          <Form.Item name="environment" label="环境" rules={[{ required: true, message: '请选择环境' }]}>
            <Select options={[{ label: 'Production', value: 'prod' }, { label: 'Staging', value: 'staging' }, { label: 'Development', value: 'dev' }]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Start Recording Modal */}
      <Modal title="开始流量录制" open={recordModalOpen} onCancel={() => setRecordModalOpen(false)} onOk={() => recordForm.submit()}>
        <Form form={recordForm} layout="vertical" onFinish={handleStartRecording}>
          <Form.Item name="twinId" label="孪生体" rules={[{ required: true, message: '请选择孪生体' }]}>
            <Select options={twins.map((t) => ({ label: t.name, value: t.id }))} />
          </Form.Item>
          <Form.Item name="name" label="录制名称" rules={[{ required: true, message: '请输入录制名称' }]}>
            <Input placeholder="录制会话名称" />
          </Form.Item>
          <Form.Item name="filterPatterns" label="路径过滤">
            <Input placeholder="/api/v1/*" />
          </Form.Item>
          <Form.Item name="maxRecords" label="最大录制数">
            <InputNumber min={1} max={10000} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Start Replay Modal */}
      <Modal title="开始流量回放" open={replayModalOpen} onCancel={() => setReplayModalOpen(false)} onOk={() => replayForm.submit()}>
        <Form form={replayForm} layout="vertical" onFinish={handleStartReplay}>
          <Form.Item name="twinId" label="孪生体" rules={[{ required: true, message: '请选择孪生体' }]}>
            <Select options={twins.map((t) => ({ label: t.name, value: t.id }))} />
          </Form.Item>
          <Form.Item name="recordingSessionId" label="录制会话">
            <Select
              options={recordingSessions.filter((s) => s.status === 'completed').map((s) => ({ label: s.name, value: s.id }))}
            />
          </Form.Item>
          <Form.Item name="sandboxEndpoint" label="沙箱端点" rules={[{ required: true, message: '请输入沙箱端点' }]}>
            <Input placeholder="http://sandbox.local:9000" />
          </Form.Item>
          <Form.Item name="speedMultiplier" label="速度倍数">
            <InputNumber min={0.1} max={10} defaultValue={1} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="compareResponses" label="响应比对" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Create Sandbox Modal */}
      <Modal title="创建沙箱环境" open={sandboxModalOpen} onCancel={() => setSandboxModalOpen(false)} onOk={() => sandboxForm.submit()}>
        <Form form={sandboxForm} layout="vertical" onFinish={handleCreateSandbox}>
          <Form.Item name="twinId" label="孪生体" rules={[{ required: true, message: '请选择孪生体' }]}>
            <Select options={twins.map((t) => ({ label: t.name, value: t.id }))} />
          </Form.Item>
          <Form.Item name="name" label="沙箱名称" rules={[{ required: true, message: '请输入沙箱名称' }]}>
            <Input placeholder="沙箱环境名称" />
          </Form.Item>
          <Form.Item name="snapshotId" label="快照ID">
            <Select options={snapshots.map((s) => ({ label: s.name, value: s.id }))} allowClear />
          </Form.Item>
          <Form.Item name="networkIsolation" label="网络隔离" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DigitalTwinPage;
