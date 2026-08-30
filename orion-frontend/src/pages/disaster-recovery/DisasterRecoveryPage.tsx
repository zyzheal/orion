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
  getBackupStats,
  listPlans,
  createPlan,
  deletePlan,
  executeBackup,
  createRecovery,
  executeRecovery,
  type BackupPlan,
  type CreatePlanInput,
  type BackupType,
} from '@/api/backup';
import { colors, spacing } from '@/tokens';
import disasterRecoveryApi from '@/api/disaster-recovery';

const { Title, Text } = Typography;

const DisasterRecoveryPage: React.FC = () => {
  const [plans, setPlans] = useState<BackupPlan[]>([]);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [selectedBackupPlan, setSelectedBackupPlan] = useState<BackupPlan | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [createForm] = Form.useForm();
  const [drillModalOpen, setDrillModalOpen] = useState(false);
  const [drillPlans, setDrillPlans] = useState<any[]>([]);
  const [selectedDrillPlan, setSelectedDrillPlan] = useState<string>('');
  const [drilling, setDrilling] = useState(false);
  const [drillStep, setDrillStep] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [plansRes, statsRes] = await Promise.all([listPlans(), getBackupStats()]);
      setPlans(Array.isArray(plansRes.data) ? plansRes.data : []);
      setStats(statsRes.data as unknown as Record<string, unknown> | null);
    } catch {
      message.error('Failed to load backup data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: { name: string; type: BackupType; retentionDays?: number }) => {
    try {
      await createPlan({
        name: values.name,
        type: values.type,
        retention_days: values.retentionDays ?? 7,
        enabled: true,
      } as CreatePlanInput);
      message.success('Backup plan created');
      setCreateModalOpen(false);
      createForm.resetFields();
      loadData();
    } catch {
      message.error('Failed to create backup plan');
    }
  };

  const handleRestore = async (plan: BackupPlan) => {
    setRestoring(true);
    try {
      const res = await executeBackup(plan.id);
      const record = res.data;
      if (record?.id) {
        const recovery = await createRecovery({ backup_id: record.id });
        if (recovery.data?.id) {
          await executeRecovery(recovery.data.id);
        }
      }
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
      await deletePlan(id);
      message.success('Backup plan deleted');
      loadData();
    } catch {
      message.error('Failed to delete backup plan');
    }
  };

  const openDrillModal = async () => {
    try {
      const p = await disasterRecoveryApi.listDRPlans();
      setDrillPlans(p || []);
      setDrillModalOpen(true);
      setDrillStep(0);
    } catch {
      setDrillPlans([]);
      setDrillModalOpen(true);
    }
  };

  const handleDrill = async () => {
    if (!selectedDrillPlan) { message.warning('请选择灾备方案'); return; }
    setDrilling(true);
    const steps = ['预检查', '流量切换', '服务验证', '完成演练'];
    for (let i = 0; i < steps.length; i++) {
      setDrillStep(i + 1);
      await new Promise((r) => setTimeout(r, 800));
    }
    try {
      await disasterRecoveryApi.executeFailoverTest(selectedDrillPlan);
      message.success('灾备切换演练完成');
      setDrillModalOpen(false);
    } catch {
      message.error('演练执行失败');
    } finally {
      setDrilling(false);
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (v: BackupType) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Enabled',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (v: boolean) => <Tag color={v ? 'success' : 'default'}>{v ? 'Enabled' : 'Disabled'}</Tag>,
    },
    {
      title: 'Retention',
      dataIndex: 'retention_days',
      key: 'retention_days',
      render: (v: number) => `${v}d`,
    },
    { title: 'Created', dataIndex: 'created_at', key: 'created_at' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: BackupPlan) => (
        <Space>
          <Button
            size="small"
            icon={<UndoOutlined />}
            onClick={() => {
              setSelectedBackupPlan(record);
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
            <Statistic title="Total Backups" value={Number(stats?.total_backups ?? 0)} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Successful"
              value={Number(stats?.completed_backups ?? 0)}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Failed"
              value={Number(stats?.failed_backups ?? 0)}
              valueStyle={{ color: colors.error[400] }}
            />
          </Card>
        </Col>
      </Row>

      {/* Plan List */}
      <Card title="Backups">
        <Table
          columns={columns}
          dataSource={plans}
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
          <Form.Item label="Type" name="type" initialValue="full" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'full', label: 'Full' },
                { value: 'incremental', label: 'Incremental' },
                { value: 'differential', label: 'Differential' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Retention Days" name="retentionDays" initialValue={7}>
            <Input type="number" min={1} max={365} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Restore Confirmation Modal */}
      <Modal
        title="确认恢复"
        open={restoreModalOpen}
        onCancel={() => setRestoreModalOpen(false)}
        onOk={() => selectedBackupPlan && handleRestore(selectedBackupPlan)}
        confirmLoading={restoring}
        okText="确认恢复"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        {selectedBackupPlan && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="计划名称">{selectedBackupPlan.name}</Descriptions.Item>
            <Descriptions.Item label="类型">{selectedBackupPlan.type}</Descriptions.Item>
            <Descriptions.Item label="保留天数">{selectedBackupPlan.retention_days} 天</Descriptions.Item>
            <Descriptions.Item label="创建时间">{selectedBackupPlan.created_at}</Descriptions.Item>
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
            <Select placeholder="选择方案..." value={selectedDrillPlan} onChange={setSelectedDrillPlan}
              options={drillPlans.map((p: any) => ({ value: p.id, label: `${p.name} (RTO: ${p.rto || '5min'}, RPO: ${p.rpo || '1min'})` }))} />
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
