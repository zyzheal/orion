/**
 * Workspace Management Page (KubeSphere-style)
 * Multi-tenant workspace isolation: CRUD, resource quota, member roles
 */
import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@/providers/QueryProvider';
import {
  Typography,
  Card,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Statistic,
  Row,
  Col,
  Empty,
  Progress,
} from 'antd';
import {
  ProjectOutlined,
  ClusterOutlined,
  UserOutlined,
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EditOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { colors, spacing } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
const { Title, Text } = Typography;
const { Option } = Select;

interface Workspace {
  id: string;
  name: string;
  description: string;
  clusterId: string;
  status: 'active' | 'disabled';
  cpuQuota: number;
  cpuUsed: number;
  memoryQuota: number;
  memoryUsed: number;
  storageQuota: number;
  storageUsed: number;
  memberCount: number;
  createdAt: string;
}

// 委托 axios 实例（src/api/client.ts）：请求拦截器注入 authStore token 并支持
// 401 自动刷新重放，响应拦截器统一解包 { success, data }，另带重试与请求取消注册。
// 保留原有 fetch 风格签名与"失败抛出 Error(message)"语义，调用方 catch 无需修改。
async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const method = (options?.method ?? 'GET').toUpperCase();
  const data = typeof options?.body === 'string' ? JSON.parse(options.body) : undefined;
  const url = `/workspaces${path}`;
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

const WorkspacePage: React.FC = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Workspace | null>(null);
  const [form] = Form.useForm<{
    name: string; description: string; clusterId: string;
    cpuQuota: number; memoryQuota: number; storageQuota: number;
  }>();

  const {
    data = { workspaces: [] as Workspace[] },
    isLoading: loading,
    refetch: loadWorkspaces,
    error: queryError,
  } = useQuery({
    queryKey: ['workspaces', 'all'],
    queryFn: async () => {
      const ws = await apiCall<Workspace[]>('/');
      return { workspaces: Array.isArray(ws) ? ws : [] };
    },
  });

  useEffect(() => {
    if (queryError) message.warning('工作空间数据加载失败');
  }, [queryError]);

  const upsertMutation = useMutation({
    mutationFn: (values: { id?: string; name: string; description: string; clusterId: string; cpuQuota: number; memoryQuota: number; storageQuota: number }) =>
      values.id
        ? apiCall<Workspace>(`/${values.id}`, { method: 'PUT', body: JSON.stringify(values) })
        : apiCall<Workspace>('/', { method: 'POST', body: JSON.stringify(values) }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['workspaces'] });
      const prev = queryClient.getQueryData<{ workspaces: Workspace[] }>(['workspaces', 'all']);
      const optimistic: Workspace = {
        id: variables.id || `new-${Date.now()}`,
        name: variables.name,
        description: variables.description || '',
        clusterId: variables.clusterId,
        status: 'active',
        cpuQuota: variables.cpuQuota || 4,
        cpuUsed: 0,
        memoryQuota: variables.memoryQuota || 8,
        memoryUsed: 0,
        storageQuota: variables.storageQuota || 100,
        storageUsed: 0,
        memberCount: 0,
        createdAt: new Date().toISOString(),
      };
      if (prev) {
        queryClient.setQueryData(['workspaces', 'all'], {
          workspaces: optimistic.id.startsWith('new-')
            ? [...prev.workspaces, optimistic]
            : prev.workspaces.map((w) => w.id === optimistic.id ? optimistic : w),
        });
      }
      return { prev };
    },
    onSuccess: (_data, variables) => {
      message.success(variables.id ? '工作空间已更新' : '工作空间已创建');
    },
    onError: (_err, _variables, ctx) => {
      message.warning('操作失败');
      if (ctx?.prev) queryClient.setQueryData(['workspaces', 'all'], ctx.prev);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiCall<void>(`/${id}`, { method: 'DELETE' }),
    onSuccess: () => message.success('工作空间已删除'),
    onError: () => message.warning('删除失败'),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
  });

  const workspaces = data.workspaces;
  const activeCount = workspaces.filter((w) => w.status === 'active').length;
  const totalCpu = workspaces.reduce((s, w) => s + w.cpuQuota, 0);
  const totalMemory = workspaces.reduce((s, w) => s + w.memoryQuota, 0);

  const columns: ColumnsType<Workspace> = [
    { title: '工作空间', dataIndex: 'name', key: 'name', render: (v: string) => <Text strong>{v}</Text> },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '集群', dataIndex: 'clusterId', key: 'clusterId', width: 120, render: (v: string) => <Tag>{v}</Tag> },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (v: string) => <Tag color={v === 'active' ? 'green' : 'default'}>{v === 'active' ? '活跃' : '停用'}</Tag>,
    },
    {
      title: 'CPU', key: 'cpu', width: 100,
      render: (_: unknown, r: Workspace) => (
        <Progress type="circle" size={32} percent={r.cpuQuota > 0 ? Math.round(r.cpuUsed / r.cpuQuota * 100) : 0} format={() => `${r.cpuUsed}/${r.cpuQuota}`} />
      ),
    },
    {
      title: '内存', key: 'mem', width: 100,
      render: (_: unknown, r: Workspace) => (
        <Progress type="circle" size={32} percent={r.memoryQuota > 0 ? Math.round(r.memoryUsed / r.memoryQuota * 100) : 0} format={() => `${r.memoryUsed}/${r.memoryQuota}G`} />
      ),
    },
    { title: '成员', dataIndex: 'memberCount', key: 'memberCount', width: 80 },
    {
      title: '操作', key: 'action', width: 140,
      render: (_: unknown, record: Workspace) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(record); form.setFieldsValue(record); setModalOpen(true); }}>编辑</Button>
          <Popconfirm title="确认删除?" onConfirm={() => deleteMutation.mutate(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <ProjectOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
        多租户工作空间管理
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        KubeSphere Workspace 模式 · 资源隔离 · 配额管理 · 成员角色
      </Text>

      {loading ? (
        <PageSkeleton rows={6} />
      ) : (
        <>
          <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
            <Col span={6}>
              <Card size="small"><Statistic title="工作空间总数" value={workspaces.length} prefix={<DatabaseOutlined />} /></Card>
            </Col>
            <Col span={6}>
              <Card size="small"><Statistic title="活跃空间" value={activeCount} prefix={<ProjectOutlined />} valueStyle={{ color: colors.success[500] }} /></Card>
            </Col>
            <Col span={6}>
              <Card size="small"><Statistic title="CPU 配额总数" value={totalCpu} suffix="核" prefix={<ClusterOutlined />} /></Card>
            </Col>
            <Col span={6}>
              <Card size="small"><Statistic title="内存配额总数" value={totalMemory} suffix="G" prefix={<UserOutlined />} /></Card>
            </Col>
          </Row>

          <Card
            title="工作空间列表"
            extra={
              <Space>
                <Button icon={<ReloadOutlined />} onClick={() => { void loadWorkspaces(); }}>刷新</Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>创建工作空间</Button>
              </Space>
            }
          >
            <Table
              dataSource={workspaces}
              columns={columns}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10 }}
              locale={{ emptyText: <Empty description="暂无工作空间，请创建工作空间以实现多租户隔离" /> }}
            />
          </Card>
        </>
      )}

      <Modal
        title={editing ? '编辑工作空间' : '创建工作空间'}
        open={modalOpen}
        confirmLoading={upsertMutation.isPending}
        onCancel={() => { setModalOpen(false); form.resetFields(); setEditing(null); }}
        onOk={async () => {
          const values = await form.validateFields();
          upsertMutation.mutate({ ...(editing || {}), ...values }, {
            onSettled: () => { setModalOpen(false); form.resetFields(); setEditing(null); },
          });
        }}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item label="空间名称" name="name" rules={[{ required: true, message: '请输入空间名称' }]}>
            <Input placeholder="例: production-team-a" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} placeholder="空间用途描述" />
          </Form.Item>
          <Form.Item label="所属集群" name="clusterId" rules={[{ required: true, message: '请选择集群' }]}>
            <Select placeholder="选择集群">
              <Option value="cluster-main">主集群</Option>
              <Option value="cluster-backup">备份集群</Option>
              <Option value="cluster-dev">开发集群</Option>
            </Select>
          </Form.Item>
          <Form.Item label="CPU 配额(核)" name="cpuQuota" initialValue={4}>
            <Input type="number" min={1} max={64} />
          </Form.Item>
          <Form.Item label="内存配额(GB)" name="memoryQuota" initialValue={8}>
            <Input type="number" min={1} max={256} />
          </Form.Item>
          <Form.Item label="存储配额(GB)" name="storageQuota" initialValue={100}>
            <Input type="number" min={10} max={10000} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WorkspacePage;
