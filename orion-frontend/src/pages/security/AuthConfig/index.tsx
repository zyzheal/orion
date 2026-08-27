/**
 * Auth Configuration Page (H1.1 认证授权)
 * OAuth2/OIDC/MFA/SSO provider management and authentication policy configuration
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Row,
  Col,
  Table,
  Statistic,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Tooltip,
  message,
  Empty,
} from 'antd';
import {
  SafetyOutlined,
  KeyOutlined,
  GlobalOutlined,
  LockOutlined,
  UserSwitchOutlined,
  BellOutlined,
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;
const { Option } = Select;

type ProviderType = 'oauth2' | 'oidc' | 'sso_saml' | 'ldap' | 'mfa';
type ProviderStatus = 'active' | 'inactive' | 'error';

interface AuthProvider {
  id: string;
  name: string;
  type: ProviderType;
  status: ProviderStatus;
  users: number;
  lastSync: string;
  config?: Record<string, unknown>;
}

interface AuthPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  scope: string;
}

async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`/api/v1/auth${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
      ...options?.headers,
    },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    const msg = err.message || err.error?.message || err.error?.Message || `HTTP ${resp.status}`;
    throw new Error(msg);
  }
  const json = await resp.json();
  return (json.data || json) as T;
}

const typeConfig: Record<ProviderType, { label: string; color: string; icon: React.ReactNode }> = {
  oauth2: { label: 'OAuth2', color: 'blue', icon: <GlobalOutlined /> },
  oidc: { label: 'OIDC', color: 'purple', icon: <KeyOutlined /> },
  sso_saml: { label: 'SAML SSO', color: 'cyan', icon: <UserSwitchOutlined /> },
  ldap: { label: 'LDAP', color: 'green', icon: <LockOutlined /> },
  mfa: { label: 'MFA', color: 'orange', icon: <BellOutlined /> },
};

const statusConfig: Record<ProviderStatus, { label: string; color: string }> = {
  active: { label: '活跃', color: 'success' },
  inactive: { label: '未启用', color: 'default' },
  error: { label: '错误', color: 'error' },
};

const AuthConfigPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<AuthProvider[]>([]);
  const [policies, setPolicies] = useState<AuthPolicy[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm] = Form.useForm<{ name: string; type: ProviderType; clientId?: string; clientSecret?: string; discoveryUrl?: string }>();

  const loadProviders = async () => {
    setLoading(true);
    try {
      const [providersRes, policiesRes] = await Promise.all([
        apiCall<AuthProvider[]>('/providers'),
        apiCall<AuthPolicy[]>('/policies'),
      ]);
      setProviders(Array.isArray(providersRes) ? providersRes : []);
      setPolicies(Array.isArray(policiesRes) ? policiesRes : []);
    } catch (_err: unknown) {
      message.warning('认证配置数据加载失败，显示默认状态');
      setProviders([]);
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProviders(); }, []);

  const providerColumns: ColumnsType<AuthProvider> = [
    {
      title: '认证源名称',
      dataIndex: 'name',
      key: 'name',
      render: (val: string) => <Text strong>{val}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (val: ProviderType) => {
        const cfg = typeConfig[val];
        return <Tag color={cfg.color}>{cfg.icon} {cfg.label}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (val: ProviderStatus) => (
        <Tag color={statusConfig[val].color}>{statusConfig[val].label}</Tag>
      ),
    },
    {
      title: '绑定用户数',
      dataIndex: 'users',
      key: 'users',
      width: 100,
      render: (val: number) => <Text>{val}</Text>,
    },
    {
      title: '最后同步',
      dataIndex: 'lastSync',
      key: 'lastSync',
      width: 160,
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: unknown, record: AuthProvider) => (
        <Space size="small">
          <Tooltip title="编辑功能待实现" placement="topLeft">
            <Button size="small" icon={<EditOutlined />} disabled>编辑</Button>
          </Tooltip>
          <Tooltip title="删除功能待实现" placement="topLeft">
            <Button size="small" danger icon={<DeleteOutlined />} disabled>删除</Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const policyColumns: ColumnsType<AuthPolicy> = [
    {
      title: '策略名称',
      dataIndex: 'name',
      key: 'name',
      render: (val: string) => <Text strong>{val}</Text>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '范围',
      dataIndex: 'scope',
      key: 'scope',
      width: 120,
      render: (val: string) => <Tag>{val}</Tag>,
    },
    {
      title: '启用状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 90,
      render: (val: boolean) => (
        <Tooltip title="启用/禁用功能待实现" placement="top">
          <Switch checked={val} size="small" disabled />
        </Tooltip>
      ),
    },
  ];

  const totalUsers = providers.reduce((sum, p) => sum + p.users, 0);
  const activeProviders = providers.filter((p) => p.status === 'active').length;

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <SafetyOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
        认证授权管理
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        OAuth2 / OIDC / MFA / SSO 认证源配置与访问策略管理
      </Text>

      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="认证源总数" value={providers.length} prefix={<KeyOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="活跃认证源" value={activeProviders} prefix={<SafetyOutlined />} valueStyle={{ color: colors.success[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="绑定用户数" value={totalUsers} prefix={<UserSwitchOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="策略规则数" value={policies.length} prefix={<BellOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card
        title="认证源列表"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadProviders}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
              新建认证源
            </Button>
          </Space>
        }
        style={{ marginBottom: spacing.md }}
      >
        <Table
          dataSource={providers}
          columns={providerColumns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={false}
          locale={{ emptyText: <Empty description="暂无认证源配置，请添加 OAuth2/OIDC/MFA/SSO 认证源" /> }}
        />
      </Card>

      <Card title="访问策略规则">
        <Table
          dataSource={policies}
          columns={policyColumns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={false}
          locale={{ emptyText: <Empty description="暂无访问策略规则" /> }}
        />
      </Card>

      <Modal
        title="新建认证源"
        open={createModalOpen}
        confirmLoading={creating}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields(); }}
        onOk={async () => {
          const values = await createForm.validateFields();
          setCreating(true);
          try {
            await apiCall<AuthProvider>('/providers', {
              method: 'POST',
              body: JSON.stringify(values),
            });
            message.success(`认证源 "${values.name}" 创建成功`);
            setCreateModalOpen(false);
            createForm.resetFields();
            loadProviders();
          } catch (_err: unknown) {
            message.warning('认证源创建失败，请联系管理员');
          } finally {
            setCreating(false);
          }
        }}
        okText="创建"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item label="认证源名称" name="name" rules={[{ required: true, message: '请输入认证源名称' }]}>
            <Input placeholder="例: Google OAuth2" />
          </Form.Item>
          <Form.Item label="认证类型" name="type" rules={[{ required: true, message: '请选择认证类型' }]}>
            <Select placeholder="选择认证类型">
              <Option value="oauth2">OAuth2</Option>
              <Option value="oidc">OIDC</Option>
              <Option value="sso_saml">SAML SSO</Option>
              <Option value="ldap">LDAP</Option>
              <Option value="mfa">MFA</Option>
            </Select>
          </Form.Item>
          <Form.Item label="Client ID">
            <Input placeholder="OAuth2/OIDC Client ID" />
          </Form.Item>
          <Form.Item label="Client Secret">
            <Input.Password placeholder="OAuth2/OIDC Client Secret" />
          </Form.Item>
          <Form.Item label="Discovery URL">
            <Input placeholder="OIDC Discovery URL" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AuthConfigPage;
