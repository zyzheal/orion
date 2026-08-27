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
  SwapOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
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
import { colors, spacing } from '@/tokens';
import disasterRecoveryApi from '@/api/disaster-recovery';

const { Title, Text } = Typography;

const DisasterRecoveryPage: React.FC = () => {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupRecord | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [createForm] = Form.useForm();
  const [drillModalOpen, setDrillModalOpen] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [drilling, setDrilling] = useState(false);
  const [drillStep, setDrillStep] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [backupRes, statsRes] = await Promise.all([getBackups(), getBackupStats()]);
      setBackups(((backupRes.data as { backups?: unknown[] })?.backups ?? []) as BackupRecord[]);
      setStats(((statsRes.data as { stats?: unknown })?.stats ?? null) as BackupStats | null);
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
    setRestoring(true);
    try {
      await restoreBackup(id);
      message.success('Restore initiated');
      setRestoreModalOpen(false);
      loadData();
    } catch {
      message.error('Failed to restore backup');
    } finally {
      setRestoring(false);
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

  const openDrillModal = async () => {
    try {
      const plans = await disasterRecoveryApi.listDRPlans();
      setPlans(plans || []);
      setDrillModalOpen(true);
      setDrillStep(0);
    } catch {
      setPlans([]);
      setDrillModalOpen(true);
    }
  };

  const handleDrill = async () => {
    if (!selectedPlan) { message.warning('请选择灾备方案'); return; }
    setDrilling(true);
    const steps = ['预检查', '流量切换', '服务验证', '完成演练'];
    for (let i = 0; i < steps.length; i++) {
      setDrillStep(i + 1);
      await new Promise((r) => setTimeout(r, 800));
    }
    try {
      await disasterRecoveryApi.executeFailoverTest(selectedPlan);
      message.success('灾备切换演练完成');
      setDrillModalOpen(false);
    } catch {
      message.error('演练执行失败');
    } finally {
      setDrilling(false);
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
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      render: (v: number) => (v > 0 ? `${(v / (1024 * 1024)).toFixed(0)} MB` : '-'),
    },
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
            onClick={() => {
              setSelectedBackup(record);
              setRestoreModalOpen(true);
            }}
          >
            Restore
          </Button>
          <Button size="small" danger onClick={() => handleDelete(record.id)}>
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <SafetyCertificateOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            灾备恢复管理
          </Title>
          <Text type="secondary">备份管理、恢复操作与演练</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            创建备份
          </Button>
          <Button icon={<SwapOutlined />} onClick={openDrillModal}>
            切换演练
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={24} style={{ marginBottom: spacing.lg }}>
        <Col span={8}>
          <Card>
            <Statistic title="Total Backups" value={stats?.total ?? 0} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Successful"
              value={stats?.successful ?? 0}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Failed"
              value={stats?.failed ?? 0}
              valueStyle={{ color: colors.error[400] }}
            />
          </Card>
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
        title="确认恢复"
        open={restoreModalOpen}
        onCancel={() => setRestoreModalOpen(false)}
        onOk={() => selectedBackup && handleRestore(selectedBackup.id)}
        confirmLoading={restoring}
        okText="确认恢复"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        {selectedBackup && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="备份名称">{selectedBackup.name}</Descriptions.Item>
            <Descriptions.Item label="类型">{selectedBackup.type}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{selectedBackup.createdAt}</Descriptions.Item>
            <Descriptions.Item label="大小">
              {selectedBackup.size > 0
                ? `${(selectedBackup.size / (1024 * 1024)).toFixed(0)} MB`
                : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
        <div style={{ marginTop: spacing.md }}>
          <Text type="danger">
            警告：恢复操作将覆盖当前数据。此操作不可撤销。
          </Text>
        </div>
      </Modal>

      <Modal title="灾备切换演练" open={drillModalOpen} onCancel={() => setDrillModalOpen(false)}
        onOk={() => handleDrill()} confirmLoading={drilling} okText="开始演练" cancelText="取消"
        okButtonProps={{ danger: true }} width={560}
      >
        <Form layout="vertical">
          <Form.Item label="选择灾备方案">
            <Select placeholder="选择方案..." value={selectedPlan} onChange={setSelectedPlan}
              options={plans.map((p: any) => ({ value: p.id, label: `${p.name} (RTO: ${p.rto || '5min'}, RPO: ${p.rpo || '1min'})` }))} />
          </Form.Item>
        </Form>
        <div style={{ marginTop: 8 }}>
          <Text type="secondary">演练步骤：</Text>
          <Space wrap style={{ marginTop: 8 }}>
            {['预检查', '流量切换', '服务验证', '完成演练'].map((step, i) => (
              <Tag key={i} color={drillStep > i ? 'green' : drillStep === i ? 'blue' : 'default'}>
                {drillStep > i ? <CheckCircleOutlined /> : null} {step}
              </Tag>
            ))}
          </Space>
        </div>
      </Modal>
    </div>
  );
};

export default DisasterRecoveryPage;
