/**
 * Cross-Domain Orchestration Page
 * Phase 3 - Multi-service pipeline orchestration, dependency management, and workflow visualization
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
  BranchesOutlined,
  PlusOutlined,
  ReloadOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

interface Workflow {
  id: string;
  name: string;
  description: string;
  domains: string[];
  status: 'running' | 'completed' | 'failed' | 'draft' | 'scheduled';
  steps: number;
  currentStep: number;
  startedAt?: string;
  completedAt?: string;
  createdBy: string;
  createdAt: string;
}

interface Dependency {
  id: string;
  service: string;
  dependsOn: string;
  type: 'sync' | 'async' | 'conditional';
  status: 'satisfied' | 'pending' | 'failed';
}

const mockWorkflows: Workflow[] = [
  { id: 'wf1', name: 'Full Deployment Pipeline', description: 'Build -> Test -> Staging -> Production', domains: ['build', 'test', 'deploy'], status: 'running', steps: 8, currentStep: 5, startedAt: '2026-05-05 08:00', createdBy: 'admin', createdAt: '2025-06-15' },
  { id: 'wf2', name: 'Nightly Security Scan', description: 'SBOM -> Vulnerability Scan -> Report', domains: ['security', 'scan'], status: 'completed', steps: 5, currentStep: 5, startedAt: '2026-05-05 02:00', completedAt: '2026-05-05 02:45', createdBy: 'system', createdAt: '2025-07-20' },
  { id: 'wf3', name: 'Cross-Cloud Sync', description: 'Sync resources between AWS and Azure', domains: ['multi-cloud', 'sync'], status: 'failed', steps: 6, currentStep: 3, startedAt: '2026-05-04 10:00', completedAt: '2026-05-04 10:15', createdBy: 'ops-team', createdAt: '2025-08-10' },
];

const mockDependencies: Dependency[] = [
  { id: 'd1', service: 'deploy-service', dependsOn: 'build-service', type: 'sync', status: 'satisfied' },
  { id: 'd2', service: 'test-service', dependsOn: 'deploy-staging', type: 'sync', status: 'satisfied' },
  { id: 'd3', service: 'notify', dependsOn: 'deploy-production', type: 'async', status: 'pending' },
  { id: 'd4', service: 'rollback', dependsOn: 'health-check', type: 'conditional', status: 'pending' },
];

const OrchestrationPage: React.FC = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>(mockWorkflows);
  const [dependencies] = useState<Dependency[]>(mockDependencies);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailWorkflow, setDetailWorkflow] = useState<Workflow | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 500));
    } catch {
      message.error('Failed to load orchestration data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    const newWorkflow: Workflow = {
      id: `wf${Date.now()}`,
      name: values.name,
      description: values.description || '',
      domains: values.domains || [],
      status: 'draft',
      steps: 0,
      currentStep: 0,
      createdBy: 'current-user',
      createdAt: new Date().toISOString().split('T')[0],
    };
    setWorkflows([...workflows, newWorkflow]);
    message.success('Workflow created');
    setCreateModalOpen(false);
    form.resetFields();
  };

  const statusColor: Record<string, string> = {
    running: 'blue',
    completed: 'green',
    failed: 'red',
    draft: 'default',
    scheduled: 'gold',
  };

  const workflowColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Domains',
      dataIndex: 'domains',
      key: 'domains',
      render: (v: string[]) => v.map((d) => <Tag key={d}>{d}</Tag>),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag>,
    },
    {
      title: 'Progress',
      dataIndex: 'currentStep',
      key: 'progress',
      render: (v: number, record: Workflow) => `${v}/${record.steps}`,
    },
    { title: 'Started', dataIndex: 'startedAt', key: 'startedAt' },
    { title: 'Created By', dataIndex: 'createdBy', key: 'createdBy' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Workflow) => (
        <Space>
          <Button size="small" onClick={() => setDetailWorkflow(record)}>Details</Button>
          {record.status === 'draft' && (
            <Button size="small" type="primary" onClick={() => {
              setWorkflows(workflows.map((w) => (w.id === record.id ? { ...w, status: 'scheduled' as const } : w)));
              message.success('Workflow scheduled');
            }}>
              Run
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const dependencyColumns = [
    { title: 'Service', dataIndex: 'service', key: 'service' },
    { title: 'Depends On', dataIndex: 'dependsOn', key: 'dependsOn' },
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
      render: (v: string) => (
        <Tag color={v === 'satisfied' ? 'green' : v === 'failed' ? 'red' : 'gold'}>{v}</Tag>
      ),
    },
  ];

  const runningCount = workflows.filter((w) => w.status === 'running').length;
  const failedCount = workflows.filter((w) => w.status === 'failed').length;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <BranchesOutlined /> Cross-Domain Orchestration
          </Title>
          <Text type="secondary">Multi-service workflow orchestration and dependency management</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            New Workflow
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card><Statistic title="Workflows" value={workflows.length} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Running" value={runningCount} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Failed" value={failedCount} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Dependencies" value={dependencies.length} /></Card>
        </Col>
      </Row>

      {/* Workflow List */}
      <Card title="Workflows" style={{ marginBottom: 24 }}>
        <Table columns={workflowColumns} dataSource={workflows} rowKey="id" loading={loading} pagination={false} />
      </Card>

      {/* Dependencies */}
      <Card title={<><AppstoreOutlined /> Service Dependencies</>}>
        <Table columns={dependencyColumns} dataSource={dependencies} rowKey="id" loading={loading} pagination={false} />
      </Card>

      {/* Create Modal */}
      <Modal
        title="Create Workflow"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="Name" name="name" rules={[{ required: true }]}>
            <Input placeholder="Workflow name" />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} placeholder="Workflow description" />
          </Form.Item>
          <Form.Item label="Domains" name="domains">
            <Select
              mode="multiple"
              placeholder="Select domains"
              options={[
                { value: 'build', label: 'Build' },
                { value: 'test', label: 'Test' },
                { value: 'deploy', label: 'Deploy' },
                { value: 'security', label: 'Security' },
                { value: 'monitoring', label: 'Monitoring' },
                { value: 'multi-cloud', label: 'Multi-Cloud' },
                { value: 'sync', label: 'Sync' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        title="Workflow Details"
        open={!!detailWorkflow}
        onCancel={() => setDetailWorkflow(null)}
        footer={null}
        width={700}
      >
        {detailWorkflow && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Name">{detailWorkflow.name}</Descriptions.Item>
            <Descriptions.Item label="Description">{detailWorkflow.description}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={statusColor[detailWorkflow.status]}>{detailWorkflow.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Domains">
              {detailWorkflow.domains.map((d) => <Tag key={d}>{d}</Tag>)}
            </Descriptions.Item>
            <Descriptions.Item label="Progress">{detailWorkflow.currentStep}/{detailWorkflow.steps}</Descriptions.Item>
            <Descriptions.Item label="Started">{detailWorkflow.startedAt || '-'}</Descriptions.Item>
            <Descriptions.Item label="Completed">{detailWorkflow.completedAt || '-'}</Descriptions.Item>
            <Descriptions.Item label="Created By">{detailWorkflow.createdBy}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default OrchestrationPage;
