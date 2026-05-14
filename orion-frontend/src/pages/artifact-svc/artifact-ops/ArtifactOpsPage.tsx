/**
 * Artifact Operations Page
 * Phase 3 - Artifact lifecycle management, promotion, and security scanning
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Space,
  Statistic,
  Row,
  Col,
  message,
  Typography,
} from 'antd';
import {
  BoxPlotOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  getArtifacts,
  getArtifactStats,
  promoteArtifact,
  deprecateArtifact,
  quarantineArtifact,
  type Artifact,
  type ArtifactStats as ArtifactStatsType,
} from '@/api/artifacts';

const { Title, Text } = Typography;

const ArtifactOpsPage: React.FC = () => {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [stats, setStats] = useState<ArtifactStatsType | null>(null);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [artifactRes, statsRes] = await Promise.all([
        getArtifacts(),
        getArtifactStats(),
      ]);
      const data = artifactRes.data?.data ?? artifactRes.data;
      setArtifacts(Array.isArray(data) ? data : []);
      const statsData = statsRes.data?.data ?? statsRes.data;
      setStats(statsData || null);
    } catch {
      message.error('Failed to load artifact data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (_values: any) => {
    message.info('Artifact creation would be handled by backend API');
    setCreateModalOpen(false);
    form.resetFields();
  };

  const handlePromote = async (id: string) => {
    try {
      await promoteArtifact(id, { promotedBy: 'current-user', reason: 'Manual promotion' });
      message.success('Artifact promoted');
      loadData();
    } catch {
      message.error('Failed to promote artifact');
    }
  };

  const handleDeprecate = async (id: string) => {
    try {
      await deprecateArtifact(id);
      message.success('Artifact deprecated');
      loadData();
    } catch {
      message.error('Failed to deprecate');
    }
  };

  const handleQuarantine = async (id: string) => {
    try {
      await quarantineArtifact(id);
      message.success('Artifact quarantined');
      loadData();
    } catch {
      message.error('Failed to quarantine');
    }
  };

  const stageColor: Record<string, string> = {
    snapshot: 'default',
    release_candidate: 'blue',
    stable: 'green',
    production: 'purple',
    archived: 'gold',
  };

  const statusColor: Record<string, string> = {
    available: 'green',
    deprecated: 'gold',
    quarantined: 'red',
    uploading: 'blue',
    deleted: 'default',
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Namespace', dataIndex: 'namespace', key: 'namespace' },
    { title: 'Version', dataIndex: 'version', key: 'version' },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => <Tag color="cyan">{v}</Tag>,
    },
    {
      title: 'Stage',
      dataIndex: 'stage',
      key: 'stage',
      render: (v: string) => <Tag color={stageColor[v] || 'default'}>{v}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={statusColor[v] || 'default'}>{v}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Artifact) => (
        <Space>
          {record.stage !== 'production' && (
            <Button size="small" type="primary" onClick={() => handlePromote(record.id)}>
              Promote
            </Button>
          )}
          <Button size="small" onClick={() => handleDeprecate(record.id)}>Deprecate</Button>
          <Button size="small" danger onClick={() => handleQuarantine(record.id)}>Quarantine</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <BoxPlotOutlined /> Artifact Operations
          </Title>
          <Text type="secondary">Artifact lifecycle management, promotion, and security</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            Create Artifact
          </Button>
        </Space>
      </div>

      {/* Stats */}
      {stats && (
        <Row gutter={24} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card><Statistic title="Total Artifacts" value={stats.total} /></Card>
          </Col>
          <Col span={6}>
            <Card><Statistic title="Available" value={stats.byStatus?.available || 0} /></Card>
          </Col>
          <Col span={6}>
            <Card><Statistic title="Total Size" value={(stats.totalSizeBytes / (1024 * 1024)).toFixed(0)} suffix="MB" /></Card>
          </Col>
          <Col span={6}>
            <Card><Statistic title="Security Score" value={stats.avgSecurityScore ?? 0} suffix="/ 100" /></Card>
          </Col>
        </Row>
      )}

      {/* Artifact List */}
      <Card title="Artifacts">
        <Table
          columns={columns}
          dataSource={artifacts}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="Create Artifact"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="Name" name="name" rules={[{ required: true }]}>
            <Input placeholder="Artifact name" />
          </Form.Item>
          <Form.Item label="Namespace" name="namespace" rules={[{ required: true }]}>
            <Input placeholder="Namespace" />
          </Form.Item>
          <Form.Item label="Version" name="version" rules={[{ required: true }]}>
            <Input placeholder="1.0.0" />
          </Form.Item>
          <Form.Item label="Type" name="type" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'container_image', label: 'Container Image' },
                { value: 'helm_chart', label: 'Helm Chart' },
                { value: 'jar_artifact', label: 'JAR' },
                { value: 'npm_package', label: 'NPM Package' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ArtifactOpsPage;
