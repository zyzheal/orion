/**
 * Digital Twin Advanced Page
 * Phase 4 - Twin body list, environment snapshots, sandbox environments, traffic recording/replay
 */

import React, { useState, useEffect } from 'react';
import { digitalTwinApi, TwinSnapshot, TrafficRecording, TrafficReplay, DigitalTwin } from '@/api/digital-twin';
import {
  Card, Table, Button, Modal, Form, Select, Input, Tag, Tabs,
  Progress, message, Space, Statistic, Row, Col, Badge
} from 'antd';
import { spacing } from '@/tokens';
import {
  CameraOutlined, PlayCircleOutlined, ControlOutlined,
  CloudServerOutlined, ReloadOutlined, PlusOutlined,
  SwapOutlined
} from '@ant-design/icons';

const DigitalTwinPage: React.FC = () => {
  const [twins, setTwins] = useState<DigitalTwin[]>([]);
  const [snapshots, setSnapshots] = useState<TwinSnapshot[]>([]);
  const [recordings, setRecordings] = useState<TrafficRecording[]>([]);
  const [replays, setReplays] = useState<TrafficReplay[]>([]);
  const [loading, setLoading] = useState(false);
  const [snapshotModal, setSnapshotModal] = useState(false);
  const [recordingModal, setRecordingModal] = useState(false);
  const [replayModal, setReplayModal] = useState(false);
  const [sandboxModal, setSandboxModal] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [twinRes, snapRes, recRes, replayRes] = await Promise.all([
        digitalTwinApi.listTwins(),
        digitalTwinApi.listSnapshots(),
        digitalTwinApi.listRecordings(),
        digitalTwinApi.listReplays(),
      ]);
      setTwins(twinRes.data || []);
      setSnapshots(snapRes.data || []);
      setRecordings(recRes.data || []);
      setReplays(replayRes.data || []);
    } catch {
      message.error('Failed to load data');
    }
    setLoading(false);
  };

  const handleCreateSnapshot = async (values: any) => {
    try {
      await digitalTwinApi.createSnapshot(values);
      message.success('Snapshot created');
      setSnapshotModal(false);
      loadData();
    } catch {
      message.error('Failed to create snapshot');
    }
  };

  const handleStartRecording = async (values: any) => {
    try {
      await digitalTwinApi.startRecording(values);
      message.success('Recording started');
      setRecordingModal(false);
      loadData();
    } catch {
      message.error('Failed to start recording');
    }
  };

  const handleStartReplay = async (values: any) => {
    try {
      await digitalTwinApi.startReplay(values);
      message.success('Replay started');
      setReplayModal(false);
      loadData();
    } catch {
      message.error('Failed to start replay');
    }
  };

  const handleCreateSandbox = async (values: any) => {
    try {
      await digitalTwinApi.createSandbox(values);
      message.success('Sandbox created');
      setSandboxModal(false);
      loadData();
    } catch {
      message.error('Failed to create sandbox');
    }
  };

  const handleStopRecording = async (recordingId: string) => {
    try {
      await digitalTwinApi.stopRecording(recordingId);
      message.success('Recording stopped');
      loadData();
    } catch {
      message.error('Failed to stop recording');
    }
  };

  const twinColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 120, render: (id: string) => id.slice(0, 8) },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge
          status={status === 'active' ? 'success' : status === 'creating' ? 'processing' : 'default'}
          text={status}
        />
      ),
    },
    { title: 'Environment', dataIndex: 'environment', key: 'environment' },
    { title: 'Services', dataIndex: ['services', 'length'], key: 'services' },
    { title: 'Created', dataIndex: 'created_at', key: 'created_at', render: (d: string) => new Date(d).toLocaleString() },
  ];

  const snapshotColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 100, render: (id: string) => id.slice(0, 8) },
    { title: 'Environment', dataIndex: 'environment', key: 'environment' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'ready' ? 'green' : status === 'creating' ? 'blue' : 'red'}>
          {status}
        </Tag>
      ),
    },
    { title: 'Components', dataIndex: 'components', render: (c: any[]) => c?.length || 0 },
    { title: 'Size', dataIndex: 'size_bytes', render: (s: number) => `${(s / 1024).toFixed(1)} KB` },
    { title: 'Created', dataIndex: 'created_at', render: (d: string) => new Date(d).toLocaleString() },
  ];

  const recordingColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 100, render: (id: string) => id.slice(0, 8) },
    { title: 'Source', dataIndex: 'source_env', key: 'source_env' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'recording' ? 'blue' : status === 'completed' ? 'green' : 'default'}>
          {status}
        </Tag>
      ),
    },
    { title: 'Requests', dataIndex: 'request_count' },
    { title: 'Size', dataIndex: 'size_bytes', render: (s: number) => `${(s / 1024).toFixed(1)} KB` },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: TrafficRecording) => (
        <Button
          size="small"
          onClick={() => handleStopRecording(record.id)}
          disabled={record.status !== 'recording'}
        >
          Stop
        </Button>
      ),
    },
  ];

  const replayColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 100, render: (id: string) => id.slice(0, 8) },
    { title: 'Recording', dataIndex: 'recording_id', key: 'recording_id', width: 100 },
    { title: 'Target', dataIndex: 'target_env', key: 'target_env' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'running' ? 'blue' : status === 'completed' ? 'green' : status === 'failed' ? 'red' : 'default'}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Progress',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress: number) => <Progress percent={progress || 0} size="small" />,
    },
    { title: 'Matched', dataIndex: 'matched_count', key: 'matched_count' },
    { title: 'Mismatched', dataIndex: 'mismatched_count', key: 'mismatched_count' },
    { title: 'Started', dataIndex: 'started_at', render: (d: string) => new Date(d).toLocaleString() },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Tabs
        items={[
          {
            key: 'twins',
            label: <><CloudServerOutlined /> Twin Bodies</>,
            children: (
              <Card
                title="Digital Twin Registry"
                extra={
                  <Space>
                    <Button icon={<PlusOutlined />} onClick={() => setSandboxModal(true)}>
                      Create Sandbox
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>
                  </Space>
                }
              >
                <Row gutter={16} style={{ marginBottom: spacing.lg }}>
                  <Col span={6}>
                    <Card>
                      <Statistic title="Total Twins" value={twins.length} />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic title="Active" value={twins.filter(t => t.status === 'active').length} />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic title="Snapshots" value={snapshots.length} />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic title="Recordings" value={recordings.length} />
                    </Card>
                  </Col>
                </Row>
                <Table
                  columns={twinColumns}
                  dataSource={twins}
                  rowKey="id"
                  loading={loading}
                />
              </Card>
            ),
          },
          {
            key: 'snapshots',
            label: <><CameraOutlined /> Environment Snapshots</>,
            children: (
              <Card
                title="Environment Snapshots"
                extra={
                  <Space>
                    <Button icon={<PlusOutlined />} onClick={() => setSnapshotModal(true)}>
                      Create Snapshot
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>
                  </Space>
                }
              >
                <Table
                  columns={snapshotColumns}
                  dataSource={snapshots}
                  rowKey="id"
                  loading={loading}
                />
              </Card>
            ),
          },
          {
            key: 'recordings',
            label: <><ControlOutlined /> Traffic Recording</>,
            children: (
              <Card
                title="Traffic Recording"
                extra={
                  <Space>
                    <Button icon={<PlusOutlined />} onClick={() => setRecordingModal(true)}>
                      Start Recording
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>
                  </Space>
                }
              >
                <Table
                  columns={recordingColumns}
                  dataSource={recordings}
                  rowKey="id"
                  loading={loading}
                />
              </Card>
            ),
          },
          {
            key: 'replays',
            label: <><SwapOutlined /> Traffic Replay</>,
            children: (
              <Card
                title="Traffic Replay"
                extra={
                  <Space>
                    <Button icon={<PlayCircleOutlined />} onClick={() => setReplayModal(true)}>
                      Start Replay
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>
                  </Space>
                }
              >
                <Table
                  columns={replayColumns}
                  dataSource={replays}
                  rowKey="id"
                  loading={loading}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* Create Snapshot Modal */}
      <Modal
        title="Create Snapshot"
        open={snapshotModal}
        onCancel={() => setSnapshotModal(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateSnapshot}>
          <Form.Item label="Environment" name="environment" required>
            <Select options={[
              { value: 'production', label: 'Production' },
              { value: 'staging', label: 'Staging' },
              { value: 'development', label: 'Development' },
            ]} />
          </Form.Item>
          <Form.Item label="Note" name="note">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Start Recording Modal */}
      <Modal
        title="Start Traffic Recording"
        open={recordingModal}
        onCancel={() => setRecordingModal(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleStartRecording}>
          <Form.Item label="Source Environment" name="source_env" required>
            <Select options={[
              { value: 'production', label: 'Production' },
              { value: 'staging', label: 'Staging' },
            ]} />
          </Form.Item>
          <Form.Item label="Path Prefixes" name="path_prefixes">
            <Input placeholder="/api/v1/*" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Start Replay Modal */}
      <Modal
        title="Start Traffic Replay"
        open={replayModal}
        onCancel={() => setReplayModal(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleStartReplay}>
          <Form.Item label="Recording ID" name="recording_id" required>
            <Input placeholder="Enter recording ID" />
          </Form.Item>
          <Form.Item label="Target Environment" name="target_env" required>
            <Select options={[
              { value: 'staging', label: 'Staging' },
              { value: 'development', label: 'Development' },
              { value: 'sandbox', label: 'Sandbox' },
            ]} />
          </Form.Item>
          <Form.Item label="Speed Multiplier" name="speed_multiplier">
            <Select options={[
              { value: 0.5, label: '0.5x (Slow)' },
              { value: 1, label: '1x (Normal)' },
              { value: 2, label: '2x (Fast)' },
              { value: 5, label: '5x (Very Fast)' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Create Sandbox Modal */}
      <Modal
        title="Create Sandbox Environment"
        open={sandboxModal}
        onCancel={() => setSandboxModal(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateSandbox}>
          <Form.Item label="Name" name="name" required>
            <Input placeholder="sandbox-001" />
          </Form.Item>
          <Form.Item label="Base Snapshot" name="snapshot_id">
            <Select
              options={snapshots.map(s => ({
                value: s.id,
                label: `${s.environment} - ${s.id.slice(0, 8)}`,
              }))}
            />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DigitalTwinPage;
