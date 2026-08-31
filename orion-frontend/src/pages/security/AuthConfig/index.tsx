/**
 * Auth Configuration Page (H1.1 认证授权)
 * OAuth2/OIDC/MFA/SSO provider management and authentication policy configuration
 */
import React, { useState, useEffect } from 'react';
import { useQuery } from '@/providers/QueryProvider';
import { api } from '@/api/client';
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

// 委托 axios 实例（src/api/client.ts）：请求拦截器注入 authStore token 并支持
// 401 自动刷新重放，响应拦截器统一解包 { success, data }，另带重试与请求取消注册。
// 保留原有 fetch 风格签名与"失败抛出 Error(message)"语义，调用方 catch 无需修改。
async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const method = (options?.method ?? 'GET').toUpperCase();
  const data = typeof options?.body === 'string' ? JSON.parse(options.body) : undefined;
  const url = `/auth${path}`;
  try {
    const resp = method === 'POST' ? await api.post<unknown>(url, data)
      : method === 'PUT' ? await api.put<unknown>(url, data)
      : method === 'PATCH' ? await api.patch<unknown>(url, data)
      : method === 'DELETE' ? await api.delete<unknown>(url)
      : await api.get<unknown>(url);
    return resp.data as T;
  } catch (err) {
    const ax = err as { message?: string; response?: { status: number; data?: { error?: string; message?: string; Message?: string } } };
    const body = ax.response?.data;
    throw new Error(body?.error || body?.message || body?.Message || ax.message || (ax.response ? `HTTP ${ax.response.status}` : '网络请求失败'));
  }
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
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm] = Form.useForm<{ name: string; type: ProviderType; clientId?: string; clientSecret?: string; discoveryUrl?: string }>();

  const { data: rawData, isLoading: loading, isError, refetch } = useQuery<{ providers: AuthProvider[]; policies: AuthPolicy[] }>({
    queryKey: ['auth-config'],
    queryFn: async () => {
      const [providersRes, policiesRes] = await Promise.all([
        apiCall<AuthProvider[]>('/providers'),
        apiCall<AuthPolicy[]>('/policies'),
      ]);
      return {
        providers: Array.isArray(providersRes) ? providersRes : [],
        policies: Array.isArray(policiesRes) ? policiesRes : [],
      };
    },
    retry: 0,
    staleTime: 30_000,
  });

  const safeProviders = rawData?.providers ?? [];
  const safePolicies = rawData?.policies ?? [];

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  // （QueryObserver 未实现 observer 级回调），统一用 isError + useEffect 呈现。
  useEffect(() => {
    if (isError) {
      message.warning('认证配置数据加载失败，显示默认状态');
    }
  }, [isError]);

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

  const totalUsers = safeProviders.reduce((sum, p) => sum + p.users, 0);
  const activeProviders = safeProviders.filter((p) => p.status === 'active').length;

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
            <Statistic title="认证源总数" value={safeProviders.length} prefix={<KeyOutlined />} />
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
            <Statistic title="策略规则数" value={safePolicies.length} prefix={<BellOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card
        title="认证源列表"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
              新建认证源
            </Button>
          </Space>
        }
        style={{ marginBottom: spacing.md }}
      >
        <Table
          dataSource={safeProviders}
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
          dataSource={safePolicies}
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
            refetch();
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
