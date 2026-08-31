/**
 * MCP Server Management Page (A7 + B6)
 *
 * 管理 MCP (Model Context Protocol) 服务注册、启停、工具发现。
 * 后端 /api/v1/mcp/* 已实现。
 *
 * Features:
 * - Server CRUD: list / create / update / delete MCP servers
 * - Enable/disable servers
 * - Tool discovery: list tools per server
 * - Stats overview: total servers, active, total tools
 */
import React, { useState, useCallback, useMemo } from 'react';
import { api } from '@/api/client';
import {
  Typography,
  Button,
  Space,
  Card,
  Modal,
  Form,
  Input,
  Table,
  Statistic,
  message,
  Popconfirm,
  Empty,
  Row,
  Col,
  Switch,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ToolOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
  CloudServerOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

// --- Types ---

interface MCPServer {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

interface MCPTool {
  id: string;
  server_id: string;
  name: string;
  params?: string;
  created_at?: string;
}

// --- API ---

// 委托 axios 实例（src/api/client.ts）：请求拦截器注入 authStore token 并支持
// 401 自动刷新重放，响应拦截器统一解包 { success, data }，另带重试与请求取消注册。
// 保留原有 fetch 风格签名与"失败抛出 Error(message)"语义，调用方 catch 无需修改。
async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const method = (options?.method ?? 'GET').toUpperCase();
  const data = typeof options?.body === 'string' ? JSON.parse(options.body) : undefined;
  const url = `/mcp${path}`;
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

// --- Page ---

const MCPManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [total, setTotal] = useState(0);
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedServer, setSelectedServer] = useState<MCPServer | null>(null);
  const [createForm] = Form.useForm<{ name: string; url: string; enabled: boolean }>();
  const [editForm] = Form.useForm<{ name: string; url: string; enabled: boolean }>();

  const loadServers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiCall<{ servers: MCPServer[]; total: number }>('/servers');
      setServers(res.servers || []);
      setTotal(res.total || 0);
    } catch (error: unknown) {
      setServers([]);
      setTotal(0);
      message.error(`加载 MCP 服务失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTools = useCallback(async (serverId: string) => {
    setToolsLoading(true);
    try {
      const res = await apiCall<{ tools: MCPTool[]; total: number }>(
        `/tools?server_id=${serverId}`
      );
      setTools(res.tools || []);
    } catch (error: unknown) {
      setTools([]);
      message.error(`加载工具列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setToolsLoading(false);
    }
  }, []);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      await apiCall<MCPServer>('/servers', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      message.success(`MCP 服务 "${values.name}" 创建成功`);
      setCreateModalOpen(false);
      createForm.resetFields();
      loadServers();
    } catch (error: unknown) {
      if ((error as { errorFields?: unknown }).errorFields) return;
      message.error(`创建失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleEdit = async () => {
    if (!selectedServer) return;
    try {
      const values = await editForm.validateFields();
      await apiCall<MCPServer>(`/servers/${selectedServer.id}`, {
        method: 'PUT',
        body: JSON.stringify(values),
      });
      message.success('MCP 服务更新成功');
      setEditModalOpen(false);
      setSelectedServer(null);
      loadServers();
    } catch (error: unknown) {
      if ((error as { errorFields?: unknown }).errorFields) return;
      message.error(`更新失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await apiCall<void>(`/servers/${id}`, { method: 'DELETE' });
      message.success(`MCP 服务 "${name}" 已删除`);
      loadServers();
    } catch (error: unknown) {
      message.error(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    try {
      const enabled = !current;
      await apiCall<MCPServer>(`/servers/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
      });
      message.success(`MCP 服务已${enabled ? '启用' : '禁用'}`);
      loadServers();
    } catch (error: unknown) {
      message.error(`操作失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const serverColumns: ColumnsType<MCPServer> = useMemo(
    () => [
      {
        title: '服务名称',
        dataIndex: 'name',
        key: 'name',
        render: (val: string) => <Text strong>{val}</Text>,
      },
      {
        title: 'URL',
        dataIndex: 'url',
        key: 'url',
        render: (val: string) => (
          <Text code style={{ fontSize: 12 }}>
            {val}
          </Text>
        ),
      },
      {
        title: '状态',
        dataIndex: 'enabled',
        key: 'enabled',
        width: 80,
        render: (val: boolean, record: MCPServer) => (
          <Switch size="small" checked={val} onChange={() => handleToggle(record.id, val)} />
        ),
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 160,
      },
      {
        title: '操作',
        key: 'actions',
        width: 220,
        render: (_: unknown, record: MCPServer) => (
          <Space size="small">
            <Button
              size="small"
              icon={<ToolOutlined />}
              onClick={() => {
                setSelectedServer(record);
                loadTools(record.id);
              }}
            >
              工具
            </Button>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setSelectedServer(record);
                editForm.setFieldsValue(record);
                setEditModalOpen(true);
              }}
            >
              编辑
            </Button>
            <Popconfirm
              title="确认删除此 MCP 服务？"
              onConfirm={() => handleDelete(record.id, record.name)}
              okText="确定"
              cancelText="取消"
            >
              <Button size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [loadTools]
  );

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <CloudServerOutlined style={{ marginRight: spacing.sm, color: colors.info[500] }} />
        MCP 服务管理
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        管理 Model Context Protocol 服务注册、启停与工具发现（A7 + B6）。
      </Text>

      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="服务总数" value={total} prefix={<CloudServerOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="活跃服务"
              value={servers.filter((s) => s.enabled).length}
              valueStyle={{ color: colors.success[500] }}
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="工具总数" value={tools.length} prefix={<ToolOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="工具覆盖率"
              value={total > 0 ? `${Math.round((tools.length / total) * 100)}%` : '0%'}
              valueStyle={{ color: colors.purple[500] }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="MCP 服务列表"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadServers}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
              注册服务
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={servers}
          columns={serverColumns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={false}
          locale={{ emptyText: <Empty description="暂无 MCP 服务" /> }}
        />
      </Card>

      {/* Tool Discovery */}
      {selectedServer && (
        <Card
          title={`工具发现: ${selectedServer.name}`}
          extra={
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => loadTools(selectedServer.id)}
            >
              刷新工具
            </Button>
          }
          style={{ marginTop: spacing.md }}
        >
          <Table
            dataSource={tools}
            columns={[
              {
                title: '工具 ID',
                dataIndex: 'id',
                key: 'id',
                render: (v: string) => (
                  <Text code style={{ fontSize: 11 }}>
                    {v.slice(0, 8)}
                  </Text>
                ),
              },
              { title: '工具名称', dataIndex: 'name', key: 'name' },
              {
                title: '参数',
                dataIndex: 'params',
                key: 'params',
                render: (v: string) => (
                  <Text
                    code
                    style={{
                      fontSize: 11,
                      maxWidth: 200,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {v || '-'}
                  </Text>
                ),
              },
              { title: '注册时间', dataIndex: 'created_at', key: 'created_at', width: 160 },
            ]}
            rowKey="id"
            loading={toolsLoading}
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="暂无工具" /> }}
          />
        </Card>
      )}

      {/* Create Modal */}
      <Modal
        title="注册 MCP 服务"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
        }}
        onOk={handleCreate}
        okText="注册"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="name"
            label="服务名称"
            rules={[{ required: true, message: '请输入服务名称' }]}
          >
            <Input placeholder="例: github-mcp" />
          </Form.Item>
          <Form.Item
            name="url"
            label="服务 URL"
            rules={[{ required: true, message: '请输入服务 URL' }]}
          >
            <Input placeholder="例: http://localhost:3017/mcp" />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      {selectedServer && (
        <Modal
          title="编辑 MCP 服务"
          open={editModalOpen}
          onCancel={() => {
            setEditModalOpen(false);
            setSelectedServer(null);
          }}
          onOk={handleEdit}
          okText="保存"
          cancelText="取消"
        >
          <Form form={editForm} layout="vertical">
            <Form.Item name="name" label="服务名称" rules={[{ required: true }]}>
              <Input placeholder="服务名称" />
            </Form.Item>
            <Form.Item name="url" label="服务 URL" rules={[{ required: true }]}>
              <Input placeholder="服务 URL" />
            </Form.Item>
            <Form.Item name="enabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Form>
        </Modal>
      )}
    </div>
  );
};

export default MCPManagement;
