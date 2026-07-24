/**
 * Digital Twin Page
 * Phase 4 - Production snapshot and traffic replay
 */

import React, { useState, useEffect } from 'react';
import { digitalTwinApi, TwinSnapshot, TrafficRecording } from '../../../api/digital-twin';
import { Card, Table, Button, Modal, Form, Select, Input, Tag, Tabs, message } from 'antd';
import { CameraOutlined, ControlOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';

const DigitalTwin: React.FC = () => {
  const [snapshots, setSnapshots] = useState<TwinSnapshot[]>([]);
  const [recordings, setRecordings] = useState<TrafficRecording[]>([]);
  const [loading, setLoading] = useState(false);
  const [snapshotModal, setSnapshotModal] = useState(false);
  const [recordingModal, setRecordingModal] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [snapRes, recRes] = await Promise.all([
        digitalTwinApi.listSnapshots(),
        digitalTwinApi.listRecordings(),
      ]);
      setSnapshots(snapRes || []);
      setRecordings(recRes || []);
    } catch (error) {
      message.error('Failed to load data');
    }
    setLoading(false);
  };

  const handleCreateSnapshot = async (values: any) => {
    try {
      await digitalTwinApi.createSnapshot(values);
      message.success('Snapshot creation started');
      setSnapshotModal(false);
      loadData();
    } catch (error) {
      message.error('Failed to create snapshot');
    }
  };

  const handleStartRecording = async (values: any) => {
    try {
      await digitalTwinApi.startRecording(values);
      message.success('Recording started');
      setRecordingModal(false);
      loadData();
    } catch (error) {
      message.error('Failed to start recording');
    }
  };

  const handleStopRecording = async (recordingId: string) => {
    try {
      await digitalTwinApi.stopRecording(recordingId);
      message.success('Recording stopped');
      loadData();
    } catch (error) {
      message.error('Failed to stop recording');
    }
  };

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
    { title: 'Components', dataIndex: 'components', render: (c: any[]) => c.length },
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
        <Button onClick={() => handleStopRecording(record.id)} disabled={record.status !== 'recording'}>
          Stop
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Tabs items={[
        {
          key: 'snapshots',
          label: <><CameraOutlined /> Snapshots</>,
          children: (
            <Card extra={<Button onClick={() => setSnapshotModal(true)}>Create Snapshot</Button>}>
              <Table columns={snapshotColumns} dataSource={snapshots} rowKey="id" loading={loading} />
            </Card>
          ),
        },
        {
          key: 'recordings',
          label: <><ControlOutlined /> Traffic Recording</>,
          children: (
            <Card extra={<Button onClick={() => setRecordingModal(true)}>Start Recording</Button>}>
              <Table columns={recordingColumns} dataSource={recordings} rowKey="id" loading={loading} />
            </Card>
          ),
        },
      ]} />

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
            ]} />
          </Form.Item>
          <Form.Item label="Note" name="note">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

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
            ]} />
          </Form.Item>
          <Form.Item label="Path Prefixes" name="path_prefixes">
            <Input placeholder="/api/v1/*" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DigitalTwin;