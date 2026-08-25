/**
 * DigitalTwin — 数字孪生
 * 对接后端 /api/v1/digital-twins 完整能力
 * 含孪生管理、快照、流量录制回放、沙箱环境
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Empty,
  Tabs,
  Progress,
  Badge,
} from 'antd';
import {
  ClusterOutlined,
  PlusOutlined,
  DeleteOutlined,
  ReloadOutlined,
  EyeOutlined,
  CameraOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { digitalTwinApi, type DigitalTwin, type SandboxEnv, type TrafficRecording, type TrafficReplay, type TwinSnapshot } from '@/api/digital-twin';
import { colors } from '@/tokens';

const { Title, Text } = Typography;

const STATUS_COLORS: Record<string, string> = {
  active: 'green',
  inactive: 'default',
  creating: 'processing',
  stopped: 'default',
  running: 'processing',
  pending: 'orange',
  completed: 'green',
  failed: 'red',
  recording: 'processing',
  ready: 'green',
  restoring: 'warning',
};

const DigitalTwinPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('twins');
  const [loading, setLoading] = useState(false);
  const [twins, setTwins] = useState<DigitalTwin[]>([]);
  const [sandboxes, setSandboxes] = useState<SandboxEnv[]>([]);
  const [snapshots, setSnapshots] = useState<TwinSnapshot[]>([]);
  const [recordings, setRecordings] = useState<TrafficRecording[]>([]);
  const [replays, setReplays] = useState<TrafficReplay[]>([]);
  const [twinModalOpen, setTwinModalOpen] = useState(false);
  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
  const [sandboxModalOpen, setSandboxModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTwin, setSelectedTwin] = useState<DigitalTwin | null>(null);
  const [twinForm] = Form.useForm();
  const [snapshotForm] = Form.useForm();
  const [sandboxForm] = Form.useForm();

  const loadTwins = useCallback(async () => {
    setLoading(true);
    try {
      const data = await digitalTwinApi.listTwins();
      const items = Array.isArray(data) ? data : data?.data ?? [];
      setTwins(items);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载数字孪生列表失败');
      setTwins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSandboxes = useCallback(async () => {
    try {
      const data = await digitalTwinApi.listSnapshots({ environment: 'sandbox' });
      const items = Array.isArray(data) ? data : data?.data ?? [];
      setSandboxes(items as unknown as SandboxEnv[]);
    } catch {
      setSandboxes([]);
    }
  }, []);

  const loadSnapshots = useCallback(async () => {
    try {
      const data = await digitalTwinApi.listSnapshots();
      const items = Array.isArray(data) ? data : data?.data ?? [];
      setSnapshots(items);
    } catch {
      setSnapshots([]);
    }
  }, []);

  const loadRecordings = useCallback(async () => {
    try {
      const data = await digitalTwinApi.listRecordings();
      const items = Array.isArray(data) ? data : data?.data ?? [];
      setRecordings(items);
    } catch {
      setRecordings([]);
    }
  }, []);

  const loadReplays = useCallback(async () => {
    try {
      const data = await digitalTwinApi.listReplays();
      const items = Array.isArray(data) ? data : data?.data ?? [];
      setReplays(items);
    } catch {
      setReplays([]);
    }
  }, []);

  useEffect(() => {
    loadTwins();
  }, [loadTwins]);

  useEffect(() => {
    switch (activeTab) {
      case 'sandboxes': loadSandboxes(); break;
      case 'snapshots': loadSnapshots(); break;
      case 'recordings': loadRecordings(); break;
      case 'replays': loadReplays(); break;
    }
  }, [activeTab, loadSandboxes, loadSnapshots, loadRecordings, loadReplays]);

  const handleCreateTwin = () => {
    twinForm.resetFields();
    setTwinModalOpen(true);
  };

  const handleSubmitTwin = async () => {
    try {
      const values = await twinForm.validateFields();
      setSubmitting(true);
      await digitalTwinApi.registerTwin(values);
      message.success('创建数字孪生成功');
      setTwinModalOpen(false);
      loadTwins();
    } catch (error: unknown) {
      if (error instanceof Error) message.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSnapshot = async () => {
    if (!selectedTwin) return;
    try {
      const values = await snapshotForm.validateFields();
      await digitalTwinApi.createSnapshot(values);
      message.success('创建快照成功');
      setSnapshotModalOpen(false);
      loadSnapshots();
    } catch (error: unknown) {
      if (error instanceof Error) message.error(error.message);
    }
  };

  const handleDeleteSnapshot = async (snapshotId: string) => {
    try {
      await digitalTwinApi.deleteSnapshot(snapshotId);
      message.success('删除快照成功');
      loadSnapshots();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '删除快照失败');
    }
  };

  const handleCreateSandbox = () => {
    sandboxForm.resetFields();
    setSandboxModalOpen(true);
  };

  const handleSubmitSandbox = async () => {
    try {
      const values = await sandboxForm.validateFields();
      await digitalTwinApi.createSandbox(values);
      message.success('创建沙箱成功');
      setSandboxModalOpen(false);
      loadSandboxes();
    } catch (error: unknown) {
      if (error instanceof Error) message.error(error.message);
    }
  };

  const handleViewDetail = async (twin: DigitalTwin) => {
    setSelectedTwin(twin);
  };

  const twinColumns: ColumnsType<DigitalTwin> = useMemo(
    () => [
      { title: '名称', dataIndex: 'name', key: 'name', width: '18%', render: (text: string) => <Text strong>{text}</Text> },
      {
        title: '环境',
        dataIndex: 'environment',
        key: 'environment',
        width: '15%',
        render: (val: string) => <Tag>{val}</Tag>,
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: '12%',
        render: (status: string) => (
          <Badge status={(STATUS_COLORS[status] || 'default') as 'success' | 'processing' | 'default' | 'error' | 'warning'} text={status} />
        ),
      },
      {
        title: '服务数',
        dataIndex: 'services',
        key: 'services',
        width: '10%',
        render: (services: string[]) => (services ? services.length : 0),
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: '20%',
        render: (val: string) => (val ? new Date(val).toLocaleString('zh-CN') : '-'),
      },
      {
        title: '操作',
        key: 'action',
        width: '25%',
        render: (_: unknown, record: DigitalTwin) => (
          <Space size="small">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>详情</Button>
            <Button type="link" size="small" icon={<CameraOutlined />} onClick={() => { setSelectedTwin(record); setSnapshotModalOpen(true); snapshotForm.resetFields(); }}>快照</Button>
          </Space>
        ),
      },
    ],
    []
  );

  const snapshotColumns: ColumnsType<TwinSnapshot> = useMemo(
    () => [
      { title: 'ID', dataIndex: 'id', key: 'id', width: '20%', render: (val: string) => <Text code>{val.slice(0, 8)}...</Text> },
      { title: '环境', dataIndex: 'environment', key: 'environment', width: '15%' },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: '12%',
        render: (status: string) => <Badge status={(STATUS_COLORS[status] || 'default') as 'success' | 'processing' | 'default' | 'error' | 'warning'} text={status} />,
      },
      {
        title: '大小',
        dataIndex: 'size_bytes',
        key: 'size_bytes',
        width: '12%',
        render: (bytes: number) => {
          if (bytes > 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
          if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
          if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`;
          return `${bytes} B`;
        },
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        key: 'created_at',
        width: '20%',
        render: (val: string) => (val ? new Date(val).toLocaleString('zh-CN') : '-'),
      },
      {
        title: '操作',
        key: 'action',
        width: '21%',
        render: (_: unknown, record: TwinSnapshot) => (
          <Popconfirm title="确认删除此快照？" onConfirm={() => handleDeleteSnapshot(record.id)} okText="确认" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        ),
      },
    ],
    []
  );

  const recordingColumns: ColumnsType<TrafficRecording> = useMemo(
    () => [
      { title: 'ID', dataIndex: 'id', key: 'id', width: '18%', render: (val: string) => <Text code>{val.slice(0, 8)}...</Text> },
      { title: '源环境', dataIndex: 'source_env', key: 'source_env', width: '15%' },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: '12%',
        render: (status: string) => <Badge status={(STATUS_COLORS[status] || 'default') as 'success' | 'processing' | 'default' | 'error' | 'warning'} text={status} />,
      },
      { title: '请求数', dataIndex: 'request_count', key: 'request_count', width: '10%' },
      {
        title: '大小',
        dataIndex: 'size_bytes',
        key: 'size_bytes',
        width: '10%',
        render: (bytes: number) => {
          if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
          if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`;
          return `${bytes} B`;
        },
      },
      {
        title: '开始时间',
        dataIndex: 'started_at',
        key: 'started_at',
        width: '20%',
        render: (val: string) => (val ? new Date(val).toLocaleString('zh-CN') : '-'),
      },
    ],
    []
  );

  const replayColumns: ColumnsType<TrafficReplay> = useMemo(
    () => [
      { title: 'ID', dataIndex: 'id', key: 'id', width: '15%', render: (val: string) => <Text code>{val.slice(0, 8)}...</Text> },
      { title: '录制 ID', dataIndex: 'recording_id', key: 'recording_id', width: '15%', render: (val: string) => <Text code>{val.slice(0, 8)}...</Text> },
      { title: '目标环境', dataIndex: 'target_env', key: 'target_env', width: '12%' },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: '10%',
        render: (status: string) => <Badge status={(STATUS_COLORS[status] || 'default') as 'success' | 'processing' | 'default' | 'error' | 'warning'} text={status} />,
      },
      {
        title: '进度',
        dataIndex: 'progress',
        key: 'progress',
        width: '15%',
        render: (progress: number) => <Progress percent={Math.round(progress * 100)} size="small" />,
      },
      {
        title: '匹配/不匹配',
        key: 'match',
        width: '15%',
        render: (_: unknown, record: TrafficReplay) => (
          <Space>
            <Tag color="green">{record.matched_count} 匹配</Tag>
            <Tag color="red">{record.mismatched_count} 不匹配</Tag>
          </Space>
        ),
      },
    ],
    []
  );

  const sandboxColumns: ColumnsType<SandboxEnv> = useMemo(
    () => [
      { title: '名称', dataIndex: 'name', key: 'name', width: '20%', render: (text: string) => <Text strong>{text}</Text> },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: '15%',
        render: (status: string) => <Badge status={(STATUS_COLORS[status] || 'default') as 'success' | 'processing' | 'default' | 'error' | 'warning'} text={status} />,
      },
      {
        title: '快照 ID',
        dataIndex: 'snapshot_id',
        key: 'snapshot_id',
        width: '20%',
        render: (val: string | null) => (val ? <Text code>{val.slice(0, 8)}...</Text> : '-'),
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        key: 'created_at',
        width: '20%',
        render: (val: string) => (val ? new Date(val).toLocaleString('zh-CN') : '-'),
      },
    ],
    []
  );

  const tabItems = [
    {
      key: 'twins',
      label: '数字孪生',
      children: (
        <div>
          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateTwin}>创建孪生</Button>
            <Button icon={<ReloadOutlined />} onClick={loadTwins} loading={loading}>刷新</Button>
          </Space>
          <Table<DigitalTwin>
            columns={twinColumns}
            dataSource={twins}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 项` }}
            locale={{ emptyText: <Empty description="暂无数字孪生" /> }}
            scroll={{ x: 900 }}
          />
        </div>
      ),
    },
    {
      key: 'snapshots',
      label: '快照',
      children: (
        <div>
          <Space style={{ marginBottom: 16 }}>
            <Button icon={<ReloadOutlined />} onClick={loadSnapshots}>刷新</Button>
          </Space>
          <Table<TwinSnapshot>
            columns={snapshotColumns}
            dataSource={snapshots}
            rowKey="id"
            pagination={{ pageSize: 20 }}
            locale={{ emptyText: <Empty description="暂无快照" /> }}
            scroll={{ x: 900 }}
          />
        </div>
      ),
    },
    {
      key: 'sandboxes',
      label: '沙箱',
      children: (
        <div>
          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<ExperimentOutlined />} onClick={handleCreateSandbox}>创建沙箱</Button>
            <Button icon={<ReloadOutlined />} onClick={loadSandboxes}>刷新</Button>
          </Space>
          <Table<SandboxEnv>
            columns={sandboxColumns}
            dataSource={sandboxes}
            rowKey="id"
            pagination={{ pageSize: 20 }}
            locale={{ emptyText: <Empty description="暂无沙箱" /> }}
            scroll={{ x: 900 }}
          />
        </div>
      ),
    },
    {
      key: 'recordings',
      label: '流量录制',
      children: (
        <div>
          <Space style={{ marginBottom: 16 }}>
            <Button icon={<ReloadOutlined />} onClick={loadRecordings}>刷新</Button>
          </Space>
          <Table<TrafficRecording>
            columns={recordingColumns}
            dataSource={recordings}
            rowKey="id"
            pagination={{ pageSize: 20 }}
            locale={{ emptyText: <Empty description="暂无录制记录" /> }}
            scroll={{ x: 900 }}
          />
        </div>
      ),
    },
    {
      key: 'replays',
      label: '流量回放',
      children: (
        <div>
          <Space style={{ marginBottom: 16 }}>
            <Button icon={<ReloadOutlined />} onClick={loadReplays}>刷新</Button>
          </Space>
          <Table<TrafficReplay>
            columns={replayColumns}
            dataSource={replays}
            rowKey="id"
            pagination={{ pageSize: 20 }}
            locale={{ emptyText: <Empty description="暂无回放记录" /> }}
            scroll={{ x: 1000 }}
          />
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ marginBottom: 8 }}>
        <ClusterOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        数字孪生
      </Title>
      <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
        基础设施数字孪生模型 — 快照管理、沙箱环境、流量录制与回放
      </Text>

      <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 0 } }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ padding: '16px 16px 0' }}
          items={tabItems}
        />
      </Card>

      {/* 创建孪生 Modal */}
      <Modal
        title="创建数字孪生"
        open={twinModalOpen}
        onOk={handleSubmitTwin}
        onCancel={() => setTwinModalOpen(false)}
        confirmLoading={submitting}
        destroyOnClose
        okText="创建"
        cancelText="取消"
        width={480}
      >
        <Form form={twinForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：production-mirror" />
          </Form.Item>
          <Form.Item name="environment" label="环境" rules={[{ required: true, message: '请选择环境' }]}>
            <Select
              options={[
                { label: '生产', value: 'production' },
                { label: '预发布', value: 'staging' },
                { label: '测试', value: 'testing' },
                { label: '开发', value: 'development' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 创建快照 Modal */}
      <Modal
        title="创建快照"
        open={snapshotModalOpen}
        onOk={handleCreateSnapshot}
        onCancel={() => setSnapshotModalOpen(false)}
        destroyOnClose
        okText="创建"
        cancelText="取消"
        width={480}
      >
        <Form form={snapshotForm} layout="vertical">
          <Form.Item name="environment" label="环境" rules={[{ required: true, message: '请选择环境' }]}>
            <Select
              options={[
                { label: '生产', value: 'production' },
                { label: '预发布', value: 'staging' },
                { label: '测试', value: 'testing' },
              ]}
            />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} placeholder="快照备注（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 创建沙箱 Modal */}
      <Modal
        title="创建沙箱"
        open={sandboxModalOpen}
        onOk={handleSubmitSandbox}
        onCancel={() => setSandboxModalOpen(false)}
        destroyOnClose
        okText="创建"
        cancelText="取消"
        width={480}
      >
        <Form form={sandboxForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：sandbox-001" />
          </Form.Item>
          <Form.Item name="snapshot_id" label="快照 ID">
            <Input placeholder="基于快照创建（可选）" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="沙箱描述（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DigitalTwinPage;