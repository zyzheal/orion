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
  Divider,
  message,
  Typography,
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  RollbackOutlined,
  DiffOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import {
  listPlans,
  createPlan,
  deletePlan,
  executeMigration,
  validateMigration,
  rollbackMigration,
  getSchemaDiff,
  getMigrationStats,
  getSteps,
  type MigrationPlan,
  type MigrationType,
  type MigrationDirection,
  type MigrationStats,
  type SchemaDiff,
} from '@/api/migration';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

const phaseColorMap: Record<string, string> = {
  completed: 'green',
  failed: 'red',
  executing: 'blue',
  validating: 'orange',
  preflight: 'purple',
  rolled_back: 'default',
};

const MigrationPage: React.FC = () => {
  const [plans, setPlans] = useState<MigrationPlan[]>([]);
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [executeModalOpen, setExecuteModalOpen] = useState(false);
  const [rollbackModalOpen, setRollbackModalOpen] = useState(false);
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [stepsModalOpen, setStepsModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MigrationPlan | null>(null);
  const [schemaDiff, setSchemaDiff] = useState<SchemaDiff | null>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<any>(null);
  const [createForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [plansRes, statsRes] = await Promise.all([listPlans(), getMigrationStats()]);
      setPlans(Array.isArray(plansRes.data) ? plansRes.data : []);
      setStats(statsRes.data);
    } catch {
      message.error('Failed to load migration data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    try {
      await createPlan({
        name: values.name,
        type: values.type,
        source: {
          name: values.source_name,
          type: values.source_type,
          host: values.source_host,
          port: parseInt(values.source_port) || 5432,
          database: values.source_database,
        },
        target: {
          name: values.target_name,
          type: values.target_type,
          host: values.target_host,
          port: parseInt(values.target_port) || 5432,
          database: values.target_database,
        },
        direction: values.direction || 'forward',
        sql_statements: values.sql_statements?.split('\n').filter((s: string) => s.trim()),
        batch_size: parseInt(values.batch_size) || 100,
      });
      message.success('Migration plan created');
      setCreateModalOpen(false);
      createForm.resetFields();
      loadData();
    } catch {
      message.error('Failed to create migration plan');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePlan(id);
      message.success('Migration plan deleted');
      loadData();
    } catch {
      message.error('Failed to delete migration plan');
    }
  };

  const handleValidate = async (plan: MigrationPlan) => {
    setSelectedPlan(plan);
    setExecResult(null);
    setExecuteModalOpen(true);
    try {
      const res = await validateMigration(plan.id);
      setExecResult(res.data);
    } catch {
      message.error('Validation failed');
    }
  };

  const handleExecute = async (plan: MigrationPlan) => {
    setSelectedPlan(plan);
    setExecuting(true);
    try {
      const res = await executeMigration(plan.id);
      setExecResult(res.data);
      message.success('Migration executed successfully');
    } catch {
      message.error('Migration execution failed');
    } finally {
      setExecuting(false);
    }
  };

  const handleRollback = async (plan: MigrationPlan) => {
    setSelectedPlan(plan);
    try {
      const res = await rollbackMigration(plan.id);
      setExecResult(res.data);
      message.success('Rollback completed');
      setRollbackModalOpen(false);
    } catch {
      message.error('Rollback failed');
    }
  };

  const handleDiff = async (plan: MigrationPlan) => {
    setSelectedPlan(plan);
    setSchemaDiff(null);
    setDiffModalOpen(true);
    try {
      const res = await getSchemaDiff(plan.id);
      setSchemaDiff(res.data);
    } catch {
      message.error('Schema diff failed');
    }
  };

  const handleShowSteps = async (plan: MigrationPlan) => {
    setSelectedPlan(plan);
    setSteps([]);
    setStepsModalOpen(true);
    try {
      const res = await getSteps(plan.id);
      setSteps(Array.isArray(res.data) ? res.data : []);
    } catch {
      message.error('Failed to load steps');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (v: MigrationType) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Direction',
      dataIndex: 'direction',
      key: 'direction',
      render: (v: MigrationDirection) => (
        <Tag color={v === 'forward' ? 'green' : 'orange'}>{v}</Tag>
      ),
    },
    {
      title: 'Source',
      key: 'source',
      render: (_: unknown, record: MigrationPlan) =>
        `${record.source.name} (${record.source.host}:${record.source.port})`,
    },
    {
      title: 'Target',
      key: 'target',
      render: (_: unknown, record: MigrationPlan) =>
        `${record.target.name} (${record.target.host}:${record.target.port})`,
    },
    { title: 'Created', dataIndex: 'created_at', key: 'created_at' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: MigrationPlan) => (
        <Space size="small">
          <Button size="small" icon={<CheckCircleOutlined />} onClick={() => handleValidate(record)}>
            Validate
          </Button>
          <Button size="small" icon={<PlayCircleOutlined />} loading={executing} onClick={() => handleExecute(record)}>
            Execute
          </Button>
          <Button size="small" icon={<RollbackOutlined />} onClick={() => { setSelectedPlan(record); setRollbackModalOpen(true); }}>
            Rollback
          </Button>
          <Button size="small" icon={<DiffOutlined />} onClick={() => handleDiff(record)}>
            Diff
          </Button>
          <Button size="small" icon={<SwapOutlined />} onClick={() => handleShowSteps(record)}>
            Steps
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
            <SwapOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            数据迁移管理
          </Title>
          <Text type="secondary">数据库迁移计划、执行、验证与回滚</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            创建迁移计划
          </Button>
        </Space>
      </div>

      <Row gutter={24} style={{ marginBottom: spacing.lg }}>
        <Col span={4}>
          <Card><Statistic title="Total Plans" value={stats?.total_plans ?? 0} /></Card>
        </Col>
        <Col span={4}>
          <Card><Statistic title="Active" value={stats?.active_plans ?? 0} valueStyle={{ color: colors.info[500] }} /></Card>
        </Col>
        <Col span={4}>
          <Card><Statistic title="Completed" value={stats?.completed ?? 0} valueStyle={{ color: colors.success[500] }} /></Card>
        </Col>
        <Col span={4}>
          <Card><Statistic title="Failed" value={stats?.failed ?? 0} valueStyle={{ color: colors.error[400] }} /></Card>
        </Col>
        <Col span={8}>
          <Card><Statistic title="Rows Migrated" value={stats?.rows_migrated ?? 0} /></Card>
        </Col>
      </Row>

      <Card title="Migration Plans">
        <Table columns={columns} dataSource={plans} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
      </Card>

      <Modal title="Create Migration Plan" open={createModalOpen} onCancel={() => setCreateModalOpen(false)}
        onOk={() => createForm.submit()} width={700} okText="Create" cancelText="Cancel">
        <Form form={createForm} layout="vertical" onFinish={handleCreate} initialValues={{ type: 'schema', direction: 'forward', batch_size: 100 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Name" name="name" rules={[{ required: true }]}>
                <Input placeholder="Migration plan name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Type" name="type" rules={[{ required: true }]}>
                <Select options={[
                  { value: 'schema', label: 'Schema Only' },
                  { value: 'data', label: 'Data Only' },
                  { value: 'hybrid', label: 'Schema + Data' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Source Name" name="source_name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Source DB" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Source Type" name="source_type" initialValue="postgresql">
                <Select options={[
                  { value: 'postgresql', label: 'PostgreSQL' },
                  { value: 'mysql', label: 'MySQL' },
                  { value: 'redis', label: 'Redis' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Source Host" name="source_host" rules={[{ required: true }]}>
                <Input placeholder="localhost" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Source Port" name="source_port" initialValue="5432">
                <Input placeholder="5432" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Source Database" name="source_database" rules={[{ required: true }]}>
            <Input placeholder="mydb" />
          </Form.Item>
          <Divider orientation="left">Target</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Target Name" name="target_name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Target DB" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Target Type" name="target_type" initialValue="postgresql">
                <Select options={[
                  { value: 'postgresql', label: 'PostgreSQL' },
                  { value: 'mysql', label: 'MySQL' },
                  { value: 'redis', label: 'Redis' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Target Host" name="target_host" rules={[{ required: true }]}>
                <Input placeholder="localhost" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Target Port" name="target_port" initialValue="5432">
                <Input placeholder="5432" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Target Database" name="target_database" rules={[{ required: true }]}>
            <Input placeholder="mydb_new" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Direction" name="direction">
                <Select options={[
                  { value: 'forward', label: 'Forward' },
                  { value: 'rollback', label: 'Rollback' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Batch Size" name="batch_size">
                <Input placeholder="100" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="SQL Statements (one per line)" name="sql_statements">
            <Input.TextArea rows={4} placeholder="CREATE TABLE ..." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Migration Execute" open={executeModalOpen} onCancel={() => setExecuteModalOpen(false)}
        footer={null} width={600}>
        {selectedPlan && (
          <Descriptions column={1} bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Plan">{selectedPlan.name}</Descriptions.Item>
            <Descriptions.Item label="Type">{selectedPlan.type}</Descriptions.Item>
            <Descriptions.Item label="Direction">{selectedPlan.direction}</Descriptions.Item>
            <Descriptions.Item label="Source">{selectedPlan.source.name}</Descriptions.Item>
            <Descriptions.Item label="Target">{selectedPlan.target.name}</Descriptions.Item>
          </Descriptions>
        )}
        {execResult && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Phase">
              <Tag color={phaseColorMap[execResult.phase] || 'default'}>{execResult.phase}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={execResult.status === 'success' ? 'green' : 'red'}>{execResult.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Steps">{execResult.steps}</Descriptions.Item>
            <Descriptions.Item label="Rows Moved">{execResult.rows_moved}</Descriptions.Item>
            {execResult.error && <Descriptions.Item label="Error">{execResult.error}</Descriptions.Item>}
          </Descriptions>
        )}
      </Modal>

      <Modal title="Rollback Migration" open={rollbackModalOpen} onCancel={() => setRollbackModalOpen(false)}
        onOk={() => { if (selectedPlan) handleRollback(selectedPlan); }}
        okText="Rollback" cancelText="Cancel" width={500}
        okButtonProps={{ danger: true }}>
        {selectedPlan && (
          <div>
            <Text>Confirm rollback of plan:</Text>
            <Title level={4}>{selectedPlan.name}</Title>
            <Text type="danger" style={{ display: 'block', marginTop: 8 }}>
              Warning: This will reverse all changes made by this migration.
            </Text>
          </div>
        )}
      </Modal>

      <Modal title="Schema Diff" open={diffModalOpen} onCancel={() => setDiffModalOpen(false)}
        footer={null} width={700}>
        {schemaDiff && (
          <div>
            <Descriptions column={2} bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Source">{schemaDiff.source}</Descriptions.Item>
              <Descriptions.Item label="Target">{schemaDiff.target}</Descriptions.Item>
              <Descriptions.Item label="Checked At">{schemaDiff.checked_at}</Descriptions.Item>
            </Descriptions>
            {!!schemaDiff.additions?.length && (
              <Card title="Additions" size="small" style={{ marginBottom: 8 }}>
                <ul>{schemaDiff.additions!.map((o, i) => <li key={i}>{o.name} ({o.type})</li>)}</ul>
              </Card>
            )}
            {!!schemaDiff.removals?.length && (
              <Card title="Removals" size="small" style={{ marginBottom: 8 }}>
                <ul>{schemaDiff.removals!.map((o, i) => <li key={i}>{o.name} ({o.type})</li>)}</ul>
              </Card>
            )}
            {(!schemaDiff.additions?.length && !schemaDiff.removals?.length) && (
              <Text type="secondary">No schema differences found.</Text>
            )}
          </div>
        )}
      </Modal>

      <Modal title="Migration Steps" open={stepsModalOpen} onCancel={() => setStepsModalOpen(false)}
        footer={null} width={700}>
        {steps.length === 0 ? (
          <Text type="secondary">No steps recorded yet.</Text>
        ) : (
          <Table
            columns={[
              { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true },
              { title: 'Phase', dataIndex: 'phase', key: 'phase', render: (v: string) => <Tag color={phaseColorMap[v] || 'default'}>{v}</Tag> },
              { title: 'Status', dataIndex: 'status', key: 'status' },
              { title: 'SQL', dataIndex: 'sql', key: 'sql', ellipsis: true },
              { title: 'Rows', dataIndex: 'rows', key: 'rows' },
            ]}
            dataSource={steps}
            rowKey="id"
            pagination={false}
            size="small"
          />
        )}
      </Modal>
    </div>
  );
};

export default MigrationPage;
