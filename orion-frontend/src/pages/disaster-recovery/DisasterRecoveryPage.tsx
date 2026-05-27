/**
 * Disaster Recovery Page
 * Phase 3 - Backup management, restore operations, and recovery drills
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
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  UndoOutlined,
  SafetyCertificateOutlined,
  SyncOutlined,} from '@ant-design/icons';
import {
  getBackups,
  getBackupStats,
  createBackup,
  restoreBackup,
  deleteBackup,
  type BackupRecord,
  type BackupInput,
  type BackupStats,
} from '@/api/backup';
import { colors } from '@/tokens';

const { Title, Text } = Typography;

const DisasterRecoveryPage: React.FC = () => {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupRecord | null>(null);
  const [createForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [backupRes, statsRes] = await Promise.all([
        getBackups(),
        getBackupStats(),
      ]);
      setBackups((backupRes.data as { backups?: unknown[] })?.backups ?? []);
      setStats((statsRes.data as { stats?: unknown })?.stats ?? null);
    } catch {
      message.error('Failed to load backup data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: BackupInput) => {
    try {
      await createBackup(values);
      message.success('Backup created');
      setCreateModalOpen(false);
      createForm.resetFields();
      loadData();
    } catch {
      message.error('Failed to create backup');
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await restoreBackup(id);
      message.success('Restore initiated');
      setRestoreModalOpen(false);
      loadData();
    } catch {
      message.error('Failed to restore backup');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBackup(id);
      message.success('Backup deleted');
      loadData();
    } catch {
      message.error('Failed to delete backup');
    }
  };

  const statusColor: Record<string, string> = {
    completed: 'green',
    failed: 'red',
    in_progress: 'blue',
    scheduled: 'gold',
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag>,
    },
    { title: 'Size', dataIndex: 'size', key: 'size', render: (v: number) => v > 0 ? `${(v / (1024 * 1024)).toFixed(0)} MB` : '-' },
    { title: 'Created', dataIndex: 'createdAt', key: 'createdAt' },
    { title: 'Completed', dataIndex: 'completedAt', key: 'completedAt' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: BackupRecord) => (
        <Space>
          <Button
            size="small"
            icon={<UndoOutlined />}
            disabled={record.status !== 'completed'}
            onClick={() => { setSelectedBackup(record); setRestoreModalOpen(true); }}
          >
            Restore
          </Button>
          <Button size="small" danger onClick={() => handleDelete(record.id)}>Delete</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <SyncOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            <SafetyCertificateOutlined /> Disaster Recovery
          </Title>
          <Text type="secondary">Backup management, restore operations, and recovery drills</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            Create Backup
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card><Statistic title="Total Backups" value={stats?.total ?? 0} /></Card>
        </Col>
        <Col span={8}>
          <Card><Statistic title="Successful" value={stats?.successful ?? 0} valueStyle={{ color: colors.success[500] }} /></Card>
        </Col>
        <Col span={8}>
          <Card><Statistic title="Failed" value={stats?.failed ?? 0} valueStyle={{ color: colors.error[400] }} /></Card>
        </Col>
      </Row>

      {/* Backup List */}
      <Card title="Backups">
        <Table
          columns={columns}
          dataSource={backups}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="Create Backup"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => createForm.submit()}
        width={500}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="Name" name="name" rules={[{ required: true }]}>
            <Input placeholder="Backup name" />
          </Form.Item>
          <Form.Item label="Type" name="type" initialValue="database" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'database', label: 'Database' },
                { value: 'config', label: 'Configuration' },
                { value: 'full', label: 'Full System' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Restore Confirmation Modal */}
      <Modal
        title="Confirm Restore"
        open={restoreModalOpen}
        onCancel={() => setRestoreModalOpen(false)}
        onOk={() => selectedBackup && handleRestore(selectedBackup.id)}
        okText="Confirm Restore"
        okButtonProps={{ danger: true }}
      >
        {selectedBackup && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Name">{selectedBackup.name}</Descriptions.Item>
            <Descriptions.Item label="Type">{selectedBackup.type}</Descriptions.Item>
            <Descriptions.Item label="Created">{selectedBackup.createdAt}</Descriptions.Item>
            <Descriptions.Item label="Size">
              {selectedBackup.size > 0 ? `${(selectedBackup.size / (1024 * 1024)).toFixed(0)} MB` : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
        <div style={{ marginTop: 16 }}>
          <Text type="danger">Warning: Restoring will overwrite current data. This action cannot be undone.</Text>
        </div>
      </Modal>
    </div>
  );
};

export default DisasterRecoveryPage;
