import { colors, spacing } from '@/tokens';

/**
 * Configuration Management Page
 * Phase 3 - GitOps config management, environment diffs, and approval workflows
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
  Tabs,
  Descriptions,
} from 'antd';
import {
  SettingOutlined,
  PlusOutlined,
  ReloadOutlined,
  DiffOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import {
  getConfigs,
  getConfigStats,
  createConfig,
  deleteConfig,
  getGitOpsConfig,
  syncFromGit,
  compareEnvironments,
  type ConfigItem,
  type GitOpsConfig,
} from '@/api/config';

const { Title, Text } = Typography;

const ConfigMgmtPage: React.FC = () => {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [gitOpsConfig, setGitOpsConfig] = useState<GitOpsConfig | null>(null);
  const [stats, setStats] = useState<{ total: number; byEnvironment: Record<string, number>; byCategory: Record<string, number>; byStatus: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [diffForm] = Form.useForm();
  const [diffResult, setDiffResult] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configRes, statsRes, gitOpsRes] = await Promise.all([
        getConfigs(),
        getConfigStats(),
        getGitOpsConfig(),
      ]);
      const configData = configRes.data as { configs?: unknown[]; data?: { configs?: unknown[] } };
      setConfigs((configData?.configs ?? (configData?.data as { configs?: unknown[] })?.configs ?? []) as ConfigItem[]);
      const statsData = statsRes.data as { data?: unknown };
      setStats((statsData?.data ?? null) as any);
      const gitOpsData = gitOpsRes.data as { data?: unknown };
      setGitOpsConfig((gitOpsData?.data ?? null) as any);
    } catch {
      message.error('Failed to load configuration data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    try {
      await createConfig({
        key: values.key,
        value: values.value,
        environment: values.environment,
        category: values.category,
        description: values.description,
        sensitive: values.sensitive || false,
      });
      message.success('Config created');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
    } catch {
      message.error('Failed to create config');
    }
  };

  const handleSync = async () => {
    try {
      await syncFromGit();
      message.success('Git sync triggered');
      loadData();
    } catch {
      message.error('Failed to sync from Git');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteConfig(id);
      message.success('Config deleted');
      loadData();
    } catch {
      message.error('Failed to delete config');
    }
  };

  const handleCompare = async (values: any) => {
    try {
      const res = await compareEnvironments(values.sourceEnv, values.targetEnv);
      setDiffResult(res.data);
    } catch {
      message.error('Failed to compare environments');
    }
  };

  const statusColor: Record<string, string> = {
    draft: 'default',
    pending_approval: 'gold',
    approved: 'blue',
    rejected: 'red',
    active: 'green',
  };

  const configColumns = [
    { title: 'Key', dataIndex: 'key', key: 'key' },
    { title: 'Environment', dataIndex: 'environment', key: 'environment' },
    { title: 'Category', dataIndex: 'category', key: 'category' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag>,
    },
    {
      title: 'Sensitive',
      dataIndex: 'sensitive',
      key: 'sensitive',
      render: (v: boolean) => v ? <Tag color="red">Yes</Tag> : <Tag>No</Tag>,
    },
    { title: 'Version', dataIndex: 'version', key: 'version' },
    { title: 'Updated By', dataIndex: 'updatedBy', key: 'updatedBy' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: ConfigItem) => (
        <Space>
          <Button size="small" danger disabled={record.status === 'active'} onClick={() => handleDelete(record.id)}>
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
            <SettingOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            <SettingOutlined /> Configuration Management
          </Title>
          <Text type="secondary">GitOps config, environment diffs, and approval workflows</Text>
        </div>
        <Space>
          <Button icon={<SyncOutlined />} onClick={handleSync}>Sync from Git</Button>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            Add Config
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={24} style={{ marginBottom: spacing.lg }}>
        <Col span={6}>
          <Card><Statistic title="Total Configs" value={stats?.total ?? configs.length} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Active" value={stats?.byStatus?.active ?? 0} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Pending Approval" value={stats?.byStatus?.pending_approval ?? 0} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="GitOps" value={gitOpsConfig?.enabled ? 'Enabled' : 'Disabled'} /></Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          defaultActiveKey="configs"
          items={[
            {
              key: 'configs',
              label: 'Configurations',
              children: (
                <Table columns={configColumns} dataSource={configs} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
              ),
            },
            {
              key: 'diff',
              label: 'Environment Diff',
              children: (
                <div>
                  <Form form={diffForm} layout="inline" onFinish={handleCompare} style={{ marginBottom: spacing.md }}>
                    <Form.Item label="Source" name="sourceEnv" rules={[{ required: true }]}>
                      <Select
                        options={[
                          { value: 'development', label: 'Development' },
                          { value: 'staging', label: 'Staging' },
                          { value: 'production', label: 'Production' },
                        ]}
                        style={{ width: 180 }}
                      />
                    </Form.Item>
                    <Form.Item label="Target" name="targetEnv" rules={[{ required: true }]}>
                      <Select
                        options={[
                          { value: 'development', label: 'Development' },
                          { value: 'staging', label: 'Staging' },
                          { value: 'production', label: 'Production' },
                        ]}
                        style={{ width: 180 }}
                      />
                    </Form.Item>
                    <Form.Item>
                      <Button type="primary" icon={<DiffOutlined />} htmlType="submit">
                        Compare
                      </Button>
                    </Form.Item>
                  </Form>
                  {diffResult && (
                    <Descriptions bordered column={1}>
                      <Descriptions.Item label="Source">{diffResult.sourceEnv}</Descriptions.Item>
                      <Descriptions.Item label="Target">{diffResult.targetEnv}</Descriptions.Item>
                      <Descriptions.Item label="Total Configs">{diffResult.totalConfigs}</Descriptions.Item>
                      <Descriptions.Item label="Only in Source">{diffResult.onlyInSource?.join(', ') || 'None'}</Descriptions.Item>
                      <Descriptions.Item label="Only in Target">{diffResult.onlyInTarget?.join(', ') || 'None'}</Descriptions.Item>
                      <Descriptions.Item label="Identical">{diffResult.identical}</Descriptions.Item>
                    </Descriptions>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="Add Configuration"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="Key" name="key" rules={[{ required: true }]}>
            <Input placeholder="config.key.name" />
          </Form.Item>
          <Form.Item label="Value" name="value" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="Configuration value" />
          </Form.Item>
          <Form.Item label="Environment" name="environment" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'development', label: 'Development' },
                { value: 'staging', label: 'Staging' },
                { value: 'production', label: 'Production' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Category" name="category" rules={[{ required: true }]}>
            <Input placeholder="database / feature-flag / etc" />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input placeholder="Config description" />
          </Form.Item>
          <Form.Item label="Sensitive" name="sensitive" valuePropName="checked">
            <Select options={[{ value: true, label: 'Yes' }, { value: false, label: 'No' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ConfigMgmtPage;
