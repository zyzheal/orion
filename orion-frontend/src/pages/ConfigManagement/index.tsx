/**
 * Configuration Management Page
 * GitOps, config approval, and diff analysis
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Row,
  Col,
  Table,
  Tag,
  Space,
  Button,
  Statistic,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Drawer,
  Descriptions,
} from 'antd';
import {
  ReloadOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  CloudSyncOutlined,
} from '@ant-design/icons';
import DashboardLayout from '@/components/DashboardLayout';
import {
  getConfigs,
  createConfig,
  getGitOpsConfig,
  syncFromGit,
  submitForApproval,
  type ConfigItem,
  type GitOpsConfig,
} from '@/api/config';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface ConfigRecord {
  key: string;
  id: string;
  keyName: string;
  value: string;
  environment: string;
  category: string;
  status: string;
  sensitive: boolean;
  updatedAt: string;
  updatedBy: string;
}

const ConfigManagementPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [gitOpsConfig, setGitOpsConfig] = useState<GitOpsConfig | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<ConfigItem | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [configsRes, gitOpsRes] = await Promise.all([
        getConfigs({ pageSize: 50 }),
        getGitOpsConfig(),
      ]);
      setConfigs(configsRes.data.data.configs || []);
      setGitOpsConfig(gitOpsRes.data.data);
    } catch (error) {
      console.error('Failed to load config data:', error);
      message.error('加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (values: any) => {
    try {
      await createConfig(values);
      message.success('配置创建成功');
      setCreateModalOpen(false);
      loadData();
    } catch (error) {
      message.error('创建配置失败');
    }
  };

  const handleSync = async () => {
    try {
      await syncFromGit();
      message.success('Git 同步成功');
      loadData();
    } catch (error) {
      message.error('同步失败');
    }
  };

  const statusColorMap: Record<string, string> = {
    draft: 'default',
    pending_approval: 'orange',
    approved: 'blue',
    rejected: 'red',
    active: 'green',
  };

  const columns = [
    {
      title: '配置键',
      dataIndex: 'key',
      key: 'key',
      render: (text: string, record: ConfigItem) => (
        <Space>
          <FileTextOutlined />
          <Text strong>{text}</Text>
          {record.sensitive && <Tag color="red">敏感</Tag>}
          {record.encrypted && <Tag color="purple">加密</Tag>}
        </Space>
      ),
    },
    {
      title: '值',
      dataIndex: 'value',
      key: 'value',
      render: (value: any, record: ConfigItem) =>
        record.sensitive ? '***' : JSON.stringify(value)?.slice(0, 50),
    },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      filters: [
        { text: 'development', value: 'development' },
        { text: 'testing', value: 'testing' },
        { text: 'staging', value: 'staging' },
        { text: 'production', value: 'production' },
      ],
      onFilter: (value: any, record: ConfigItem) => record.environment === value,
      render: (env: string) => <Tag color={env === 'production' ? 'red' : 'blue'}>{env}</Tag>,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusColorMap[status] || 'default'}>
          {status === 'active' ? '已激活' : status === 'pending_approval' ? '待审批' : status}
        </Tag>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (ts: string) => new Date(ts).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: ConfigItem) => (
        <Space>
          <Button type="link" size="small" onClick={() => { setSelectedConfig(record); setDetailDrawerOpen(true); }}>
            详情
          </Button>
          {record.status === 'draft' && (
            <Button type="link" size="small" onClick={() => handleApproval(record.id)}>
              提交审批
            </Button>
          )}
        </Space>
      ),
    },
  ] as any[];

  const handleApproval = async (id: string) => {
    try {
      await submitForApproval(id, ['admin']);
      message.success('已提交审批');
    } catch (error) {
      message.error('提交失败');
    }
  };

  const tableData: ConfigRecord[] = configs.map((config) => ({
    key: config.id,
    id: config.id,
    keyName: config.key,
    value: JSON.stringify(config.value),
    environment: config.environment,
    category: config.category,
    status: config.status,
    sensitive: config.sensitive,
    updatedAt: config.updatedAt,
    updatedBy: config.updatedBy,
  }));

  return (
    <DashboardLayout>
      <div style={{ padding: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <Title level={2}>配置管理</Title>
            <Text type="secondary">GitOps 工作流、变更审批、差异分析</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
              刷新
            </Button>
            <Button icon={<CloudSyncOutlined />} onClick={handleSync} loading={loading}>
              Git 同步
            </Button>
            <Button icon={<PlusOutlined />} type="primary" onClick={() => setCreateModalOpen(true)}>
              新建配置
            </Button>
          </Space>
        </div>

        {/* Summary Cards */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}>
            <Card>
              <Statistic title="配置总数" value={configs.length} />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="已激活"
                value={configs.filter((c) => c.status === 'active').length}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="待审批"
                value={configs.filter((c) => c.status === 'pending_approval').length}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="草稿"
                value={configs.filter((c) => c.status === 'draft').length}
                valueStyle={{ color: '#8c8c8c' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="敏感配置"
                value={configs.filter((c) => c.sensitive).length}
                valueStyle={{ color: '#f5222d' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="GitOps 状态"
                value={gitOpsConfig?.syncStatus === 'success' ? 1 : 0}
                valueStyle={{ color: gitOpsConfig?.syncStatus === 'success' ? '#52c41a' : '#f5222d' }}
                prefix={gitOpsConfig?.syncStatus === 'success' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>

        {/* GitOps Status */}
        <Card title="GitOps 同步状态" style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Text type="secondary">状态:</Text>{' '}
              <Tag color={gitOpsConfig?.syncStatus === 'success' ? 'green' : 'default'}>
                {gitOpsConfig?.syncStatus || 'idle'}
              </Tag>
            </Col>
            <Col span={6}>
              <Text type="secondary">仓库:</Text>{' '}
              <Text code>{gitOpsConfig?.repository || '未配置'}</Text>
            </Col>
            <Col span={6}>
              <Text type="secondary">分支:</Text>{' '}
              <Text code>{gitOpsConfig?.branch || 'main'}</Text>
            </Col>
            <Col span={6}>
              <Text type="secondary">最后同步:</Text>{' '}
              {gitOpsConfig?.lastSyncAt ? new Date(gitOpsConfig.lastSyncAt).toLocaleString() : '从未'}
            </Col>
          </Row>
        </Card>

        {/* Config Table */}
        <Card title="配置列表">
          <Table
            columns={columns}
            dataSource={tableData}
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Card>

        {/* Create Modal */}
        <Modal
          title="新建配置"
          open={createModalOpen}
          onCancel={() => setCreateModalOpen(false)}
          onOk={() => form.submit()}
          width={600}
        >
          <Form form={form} layout="vertical" onFinish={handleCreate}>
            <Form.Item label="配置键" name="key" rules={[{ required: true }]}>
              <Input placeholder="例如：app.name" />
            </Form.Item>
            <Form.Item label="配置值" name="value" rules={[{ required: true }]}>
              <TextArea placeholder='例如：{"key": "value"}' rows={3} />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="环境" name="environment" rules={[{ required: true }]}>
                  <Select>
                    <Select.Option value="development">development</Select.Option>
                    <Select.Option value="testing">testing</Select.Option>
                    <Select.Option value="staging">staging</Select.Option>
                    <Select.Option value="production">production</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="分类" name="category" rules={[{ required: true }]}>
                  <Select>
                    <Select.Option value="application">application</Select.Option>
                    <Select.Option value="database">database</Select.Option>
                    <Select.Option value="cache">cache</Select.Option>
                    <Select.Option value="feature">feature</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="敏感配置" name="sensitive" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="加密存储" name="encrypted" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="描述" name="description">
              <TextArea rows={2} />
            </Form.Item>
          </Form>
        </Modal>

        {/* Detail Drawer */}
        <Drawer
          title="配置详情"
          placement="right"
          width={700}
          open={detailDrawerOpen}
          onClose={() => setDetailDrawerOpen(false)}
        >
          {selectedConfig && (
            <Descriptions column={1} bordered>
              <Descriptions.Item label="ID">{selectedConfig.id}</Descriptions.Item>
              <Descriptions.Item label="配置键">{selectedConfig.key}</Descriptions.Item>
              <Descriptions.Item label="配置值">
                <pre>{JSON.stringify(selectedConfig.value, null, 2)}</pre>
              </Descriptions.Item>
              <Descriptions.Item label="版本">{selectedConfig.version}</Descriptions.Item>
              <Descriptions.Item label="环境">{selectedConfig.environment}</Descriptions.Item>
              <Descriptions.Item label="分类">{selectedConfig.category}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColorMap[selectedConfig.status]}>{selectedConfig.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="敏感">{selectedConfig.sensitive ? '是' : '否'}</Descriptions.Item>
              <Descriptions.Item label="加密">{selectedConfig.encrypted ? '是' : '否'}</Descriptions.Item>
              <Descriptions.Item label="创建者">{selectedConfig.createdBy}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {new Date(selectedConfig.createdAt).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="更新者">{selectedConfig.updatedBy}</Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {new Date(selectedConfig.updatedAt).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
          )}
        </Drawer>
      </div>
    </DashboardLayout>
  );
};

export default ConfigManagementPage;
