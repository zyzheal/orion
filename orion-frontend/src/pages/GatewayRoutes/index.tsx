/**
 * Gateway Routes Management Page
 *
 * Admin page for API Gateway route management: create, edit, view, enable/disable, delete routes.
 * Uses api/gateway-routes.ts for all data operations.
 *
 * Route: /console/gateway-routes
 * Access: admin, platform_admin
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Typography, Button, Space, Tag, Card, Modal, Form, Input, Select,
  message, Popconfirm, Tooltip, Switch, Drawer, Descriptions, Row, Col,
  Statistic, Empty, Alert, Divider, Badge, Table, InputNumber,
} from 'antd';
import {
  ReloadOutlined, PlusOutlined, DeleteOutlined, EditOutlined,
  EyeOutlined, SearchOutlined, FilterOutlined, ClearOutlined,
  GatewayOutlined, ApiOutlined, CheckCircleOutlined, CloseCircleOutlined,
  SettingOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import { colors, spacing, componentRadius, shadows } from '@/tokens';
import type { GatewayRoute, GatewayRouteInput, GatewayRouteStats } from '@/api/gateway-routes';
import {
  getGatewayRoutes,
  createGatewayRoute,
  updateGatewayRoute,
  deleteGatewayRoute,
  toggleGatewayRoute,
  getGatewayRouteStats,
} from '@/api/gateway-routes';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// ============================================================================
// Constants & Configs
// ============================================================================

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

const HTTP_METHOD_COLORS: Record<string, string> = {
  GET: 'blue',
  POST: 'green',
  PUT: 'orange',
  DELETE: 'red',
  PATCH: 'purple',
  HEAD: 'default',
  OPTIONS: 'default',
};

const METHOD_LABELS: Record<string, string> = {
  GET: '查询',
  POST: '创建',
  PUT: '更新',
  DELETE: '删除',
  PATCH: '部分更新',
  HEAD: 'HEAD',
  OPTIONS: 'OPTIONS',
};

const AUTH_REQUIRED_OPTIONS = [
  { label: '是', value: true },
  { label: '否', value: false },
];

// ============================================================================
// GatewayRoutesPage Component
// ============================================================================

const GatewayRoutesPage: React.FC = () => {
  // ---- Data State ----
  const [routes, setRoutes] = useState<GatewayRoute[]>([]);
  const [stats, setStats] = useState<GatewayRouteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ---- Filter State ----
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [authFilter, setAuthFilter] = useState<string | undefined>(undefined);
  const [serviceFilter, setServiceFilter] = useState<string | undefined>(undefined);

  // ---- Modal State ----
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedRoute, setSelectedRoute] = useState<GatewayRoute | null>(null);

  // ---- Drawer State ----
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // ---- Form ----
  const [form] = Form.useForm();

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadRoutes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getGatewayRoutes();
      setRoutes(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('加载路由列表失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await getGatewayRouteStats();
      setStats(data);
    } catch {
      // Stats failure is non-critical
    }
  }, []);

  const loadAll = useCallback(() => {
    loadRoutes();
    loadStats();
  }, [loadRoutes, loadStats]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ============================================================================
  // CRUD Handlers
  // ============================================================================

  const handleCreate = () => {
    setModalMode('create');
    setSelectedRoute(null);
    form.resetFields();
    form.setFieldsValue({ enabled: true, authRequired: true, method: 'GET' });
    setModalVisible(true);
  };

  const handleEdit = (record: GatewayRoute) => {
    setModalMode('edit');
    setSelectedRoute(record);
    form.setFieldsValue({
      path: record.path,
      method: record.method,
      targetService: record.targetService,
      targetUrl: record.targetUrl,
      description: record.description,
      enabled: record.enabled,
      authRequired: record.authRequired,
      allowedRoles: record.allowedRoles,
      rateLimit: record.rateLimit,
      timeoutMs: record.timeoutMs,
    });
    setModalVisible(true);
  };

  const handleView = async (record: GatewayRoute) => {
    setDrawerLoading(true);
    setDrawerVisible(true);
    try {
      const detail = await getGatewayRoute(record.id);
      setSelectedRoute(detail);
    } catch (err: any) {
      message.error(`加载路由详情失败: ${err.message || '未知错误'}`);
      setSelectedRoute(record);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields();
      setActionLoading(modalMode === 'create' ? 'create' : `edit-${selectedRoute?.id}`);

      if (modalMode === 'create') {
        await createGatewayRoute(values);
        message.success('路由创建成功');
      } else if (selectedRoute) {
        await updateGatewayRoute(selectedRoute.id, values);
        message.success('路由更新成功');
      }

      setModalVisible(false);
      loadAll();
    } catch (err: any) {
      if (err.errorFields) return; // form validation error
      message.error(`操作失败: ${err.message || '未知错误'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setActionLoading(`delete-${id}`);
      await deleteGatewayRoute(id);
      message.success('路由已删除');
      loadAll();
    } catch (err: any) {
      message.error(`删除失败: ${err.message || '未知错误'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      setActionLoading(`toggle-${id}`);
      await toggleGatewayRoute(id, enabled);
      message.success(enabled ? '路由已启用' : '路由已禁用');
      loadRoutes();
    } catch (err: any) {
      message.error(`操作失败: ${err.message || '未知错误'}`);
    } finally {
      setActionLoading(null);
    }
  };

  // ============================================================================
  // Filtered Routes (search)
  // ============================================================================

  const filteredRoutes = useMemo(() => {
    let data = [...routes];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (r) =>
          r.path.toLowerCase().includes(q) ||
          r.targetService.toLowerCase().includes(q) ||
          (r.description || '').toLowerCase().includes(q) ||
          r.method.toLowerCase().includes(q),
      );
    }

    if (methodFilter) {
      data = data.filter((r) => r.method === methodFilter);
    }

    if (statusFilter) {
      const isEnabled = statusFilter === 'enabled';
      data = data.filter((r) => r.enabled === isEnabled);
    }

    if (authFilter !== undefined) {
      const required = authFilter === 'true';
      data = data.filter((r) => r.authRequired === required);
    }

    if (serviceFilter) {
      data = data.filter((r) => r.targetService === serviceFilter);
    }

    return data;
  }, [routes, searchQuery, methodFilter, statusFilter, authFilter, serviceFilter]);

  // Extract unique services for filter dropdown
  const uniqueServices = useMemo(() => {
    const services = new Set(routes.map((r) => r.targetService));
    return Array.from(services).sort();
  }, [routes]);

  // ============================================================================
  // Table Columns
  // ============================================================================

  const columns = useMemo(() => [
    {
      key: 'path',
      title: '路径',
      dataIndex: 'path',
      width: 220,
      ellipsis: true,
      render: (v: unknown, record: GatewayRoute) => (
        <Space>
          <Text code style={{ fontSize: 12 }}>{String(v)}</Text>
          <Tag color={HTTP_METHOD_COLORS[record.method] || 'default'} style={{ margin: 0, borderRadius: componentRadius.tag }}>
            {METHOD_LABELS[record.method] || record.method}
          </Tag>
        </Space>
      ),
    },
    {
      key: 'targetService',
      title: '目标服务',
      dataIndex: 'targetService',
      width: 140,
      render: (v: unknown) => <Text strong>{String(v)}</Text>,
    },
    {
      key: 'authRequired',
      title: '认证要求',
      dataIndex: 'authRequired',
      width: 100,
      render: (v: unknown) => (
        v ? (
          <Tag icon={<CheckCircleOutlined />} color="success" style={{ borderRadius: componentRadius.tag }}>需要</Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="default" style={{ borderRadius: componentRadius.tag }}>无需</Tag>
        )
      ),
    },
    {
      key: 'enabled',
      title: '状态',
      dataIndex: 'enabled',
      width: 100,
      render: (v: unknown, record: GatewayRoute) => (
        <Switch
          checked={Boolean(v)}
          onChange={(checked) => handleToggle(record.id, checked)}
          loading={actionLoading === `toggle-${record.id}`}
          size="small"
        />
      ),
    },
    {
      key: 'description',
      title: '描述',
      dataIndex: 'description',
      width: 180,
      ellipsis: true,
    },
    {
      key: 'requestCount',
      title: '请求量',
      dataIndex: 'requestCount',
      width: 100,
      render: (v: unknown) => (
        v ? <Text type="secondary">{Number(v).toLocaleString()}</Text> : <Text type="secondary">-</Text>
      ),
    },
    {
      key: 'errorRate',
      title: '错误率',
      dataIndex: 'errorRate',
      width: 100,
      render: (v: unknown) => {
        if (v == null) return <Text type="secondary">-</Text>;
        const rate = Number(v);
        const color = rate > 0.1 ? 'error' : rate > 0.05 ? 'warning' : 'success';
        return <Text type={color as any}>{`${(rate * 100).toFixed(1)}%`}</Text>;
      },
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 140,
      render: (v: unknown) => dayjs(String(v)).format('YYYY-MM-DD HH:mm'),
    },
    {
      key: 'actions',
      title: '操作',
      width: 120,
      fixed: 'right' as const,
      render: (_: unknown, record: GatewayRoute) => (
        <Space size={4}>
          <Tooltip title="查看详情">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除此路由吗？"
            description="删除后不可恢复"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="删除">
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={actionLoading === `delete-${record.id}`}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ], [actionLoading, handleToggle, handleView, handleEdit, handleDelete]);

  // ============================================================================
  // Stats Bar
  // ============================================================================

  const renderStatsBar = () => (
    <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.lg }}>
      <Col xs={24} sm={12} md={6}>
        <Card
          size="small"
          style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
          styles={{ body: { padding: spacing.lg } }}
        >
          <Statistic
            title="路由总数"
            value={stats?.total ?? routes.length}
            prefix={<GatewayOutlined style={{ color: colors.primary[500] }} />}
            loading={loading}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={6}>
        <Card
          size="small"
          style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
          styles={{ body: { padding: spacing.lg } }}
        >
          <Statistic
            title="已启用"
            value={stats?.enabled ?? routes.filter((r) => r.enabled).length}
            prefix={<CheckCircleOutlined style={{ color: colors.success[500] }} />}
            loading={loading}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={6}>
        <Card
          size="small"
          style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
          styles={{ body: { padding: spacing.lg } }}
        >
          <Statistic
            title="已禁用"
            value={stats?.disabled ?? routes.filter((r) => !r.enabled).length}
            prefix={<CloseCircleOutlined style={{ color: colors.neutral[500] }} />}
            loading={loading}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={6}>
        <Card
          size="small"
          style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
          styles={{ body: { padding: spacing.lg } }}
        >
          <Statistic
            title="总请求量"
            value={stats?.totalRequests ?? routes.reduce((sum, r) => sum + (r.requestCount || 0), 0)}
            prefix={<ApiOutlined style={{ color: colors.info[500] }} />}
            loading={loading}
          />
        </Card>
      </Col>
    </Row>
  );

  // ============================================================================
  // Create/Edit Modal
  // ============================================================================

  const renderModal = () => (
    <Modal
      title={modalMode === 'create' ? '新建路由' : '编辑路由'}
      open={modalVisible}
      onOk={handleModalSubmit}
      onCancel={() => setModalVisible(false)}
      confirmLoading={actionLoading === 'create' || actionLoading?.startsWith('edit-')}
      okText={modalMode === 'create' ? '创建' : '保存'}
      cancelText="取消"
      width={640}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        style={{ marginTop: spacing.md }}
        initialValues={{ enabled: true, authRequired: true, method: 'GET' }}
      >
        <Row gutter={spacing.md}>
          <Col span={12}>
            <Form.Item
              name="path"
              label="路由路径"
              rules={[{ required: true, message: '请输入路由路径' }]}
            >
              <Input placeholder="/api/v1/example" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="method"
              label="HTTP 方法"
              rules={[{ required: true, message: '请选择 HTTP 方法' }]}
            >
              <Select placeholder="选择方法">
                {HTTP_METHODS.map((m) => (
                  <Option key={m} value={m}>
                    {METHOD_LABELS[m] || m}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={spacing.md}>
          <Col span={12}>
            <Form.Item
              name="targetService"
              label="目标服务"
              rules={[{ required: true, message: '请输入目标服务名称' }]}
            >
              <Input placeholder="e.g. user-service" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="targetUrl" label="目标 URL (可选)">
              <Input placeholder="http://user-service:8080" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="description" label="描述">
          <TextArea rows={2} placeholder="路由用途描述" />
        </Form.Item>

        <Row gutter={spacing.md}>
          <Col span={8}>
            <Form.Item name="enabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="authRequired" label="需要认证" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="timeoutMs" label="超时 (ms)">
              <InputNumber min={1000} max={120000} placeholder="30000" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={spacing.md}>
          <Col span={12}>
            <Form.Item name={['rateLimit', 'maxRequests']} label="限流: 最大请求数">
              <InputNumber min={1} placeholder="100" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name={['rateLimit', 'windowMs']} label="限流: 时间窗口 (ms)">
              <InputNumber min={1000} placeholder="60000" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="allowedRoles" label="允许的角色 (逗号分隔)">
          <Select mode="tags" placeholder="admin, platform_admin" allowClear />
        </Form.Item>
      </Form>
    </Modal>
  );

  // ============================================================================
  // Detail Drawer
  // ============================================================================

  const renderDrawer = () => {
    if (!selectedRoute) return null;

    const methodColor = HTTP_METHOD_COLORS[selectedRoute.method] || 'default';
    const statusColor = selectedRoute.enabled ? 'success' : 'default';
    const statusText = selectedRoute.enabled ? '已启用' : '已禁用';

    return (
      <Drawer
        title={
          <Space>
            <GatewayOutlined style={{ color: colors.primary[500] }} />
            <span>路由详情</span>
          </Space>
        }
        placement="right"
        width={480}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        extra={
          <Space>
            <Button icon={<EditOutlined />} onClick={() => { setDrawerVisible(false); handleEdit(selectedRoute); }}>
              编辑
            </Button>
            <Popconfirm
              title="确定要删除此路由吗？"
              onConfirm={() => { setDrawerVisible(false); handleDelete(selectedRoute.id); }}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<DeleteOutlined />} loading={actionLoading === `delete-${selectedRoute.id}`}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        }
      >
        {drawerLoading ? (
          <div style={{ textAlign: 'center', padding: spacing.xl }}>
            <Text type="secondary">加载中...</Text>
          </div>
        ) : (
          <div>
            {/* Header info */}
            <div style={{ marginBottom: spacing.lg }}>
              <Space size={spacing.sm} style={{ marginBottom: spacing.sm }}>
                <Tag color={methodColor} style={{ borderRadius: componentRadius.tag, fontSize: 13, padding: '2px 8px' }}>
                  {METHOD_LABELS[selectedRoute.method] || selectedRoute.method}
                </Tag>
                <Tag color={statusColor} style={{ borderRadius: componentRadius.tag }}>
                  {statusText}
                </Tag>
                {selectedRoute.authRequired && (
                  <Tag color="purple" style={{ borderRadius: componentRadius.tag }}>需要认证</Tag>
                )}
              </Space>
              <Title level={4} style={{ marginBottom: spacing.xs, fontFamily: 'monospace' }}>
                {selectedRoute.path}
              </Title>
              {selectedRoute.description && (
                <Text type="secondary">{selectedRoute.description}</Text>
              )}
            </div>

            <Divider />

            {/* Descriptions */}
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="目标服务">
                <Badge status="processing" text={<Text strong>{selectedRoute.targetService}</Text>} />
              </Descriptions.Item>
              {selectedRoute.targetUrl && (
                <Descriptions.Item label="目标 URL">
                  <Text code>{selectedRoute.targetUrl}</Text>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="认证要求">
                {selectedRoute.authRequired ? '需要认证' : '无需认证'}
              </Descriptions.Item>
              {selectedRoute.allowedRoles && selectedRoute.allowedRoles.length > 0 && (
                <Descriptions.Item label="允许的角色">
                  <Space size={[4, 8]} wrap>
                    {selectedRoute.allowedRoles.map((role) => (
                      <Tag key={role} style={{ borderRadius: componentRadius.tag }}>{role}</Tag>
                    ))}
                  </Space>
                </Descriptions.Item>
              )}
              {selectedRoute.rateLimit && (
                <Descriptions.Item label="限流配置">
                  {selectedRoute.rateLimit.maxRequests} 次 / {selectedRoute.rateLimit.windowMs}ms
                </Descriptions.Item>
              )}
              {selectedRoute.timeoutMs && (
                <Descriptions.Item label="超时时间">
                  {selectedRoute.timeoutMs}ms
                </Descriptions.Item>
              )}
              <Descriptions.Item label="总请求数">
                {selectedRoute.requestCount?.toLocaleString() || '-'}
              </Descriptions.Item>
              {selectedRoute.errorRate != null && (
                <Descriptions.Item label="错误率">
                  <Text type={selectedRoute.errorRate > 0.1 ? 'danger' : 'secondary'}>
                    {(selectedRoute.errorRate * 100).toFixed(1)}%
                  </Text>
                </Descriptions.Item>
              )}
              {selectedRoute.lastRequestAt && (
                <Descriptions.Item label="最后请求时间">
                  {dayjs(selectedRoute.lastRequestAt).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="创建时间">
                {dayjs(selectedRoute.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {dayjs(selectedRoute.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              {selectedRoute.createdBy && (
                <Descriptions.Item label="创建人">{selectedRoute.createdBy}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>
        )}
      </Drawer>
    );
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div style={{ padding: 0 }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg, alignItems: 'flex-start' }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <GatewayOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            API 网关路由
          </Title>
          <Text type="secondary">管理和监控 API Gateway 路由规则</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadAll} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建路由</Button>
        </Space>
      </div>

      {/* Stats bar */}
      {renderStatsBar()}

      {/* Error alert */}
      {error && (
        <Alert
          message={error.message}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: spacing.md, borderRadius: componentRadius.card }}
        />
      )}

      {/* Main table card */}
      <Card
        style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
        styles={{ body: { padding: 0 } }}
      >
        {/* Filter bar */}
        <div
          style={{
            padding: spacing.md,
            borderBottom: `1px solid ${colors.neutral[200]}`,
            display: 'flex',
            flexWrap: 'wrap',
            gap: spacing.sm,
            alignItems: 'center',
          }}
        >
          <Input
            placeholder="搜索路径、服务、描述..."
            prefix={<SearchOutlined style={{ color: colors.neutral[400] }} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 240, borderRadius: componentRadius.input }}
            allowClear
          />
          <Select
            placeholder="HTTP 方法"
            value={methodFilter}
            onChange={(v) => setMethodFilter(v)}
            allowClear
            style={{ width: 120, borderRadius: componentRadius.input }}
          >
            {HTTP_METHODS.map((m) => (
              <Option key={m} value={m}>
                {METHOD_LABELS[m] || m}
              </Option>
            ))}
          </Select>
          <Select
            placeholder="状态"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            allowClear
            style={{ width: 100, borderRadius: componentRadius.input }}
          >
            <Option value="enabled">已启用</Option>
            <Option value="disabled">已禁用</Option>
          </Select>
          <Select
            placeholder="认证"
            value={authFilter}
            onChange={(v) => setAuthFilter(v)}
            allowClear
            style={{ width: 100, borderRadius: componentRadius.input }}
          >
            <Option value="true">需要</Option>
            <Option value="false">无需</Option>
          </Select>
          <Select
            placeholder="目标服务"
            value={serviceFilter}
            onChange={(v) => setServiceFilter(v)}
            allowClear
            showSearch
            style={{ width: 160, borderRadius: componentRadius.input }}
            filterOption={(input, option) =>
              String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
            }
          >
            {uniqueServices.map((s) => (
              <Option key={s} value={s}>{s}</Option>
            ))}
          </Select>
          <div style={{ flex: 1 }} />
          <Button
            icon={<ClearOutlined />}
            onClick={() => {
              setSearchQuery('');
              setMethodFilter(undefined);
              setStatusFilter(undefined);
              setAuthFilter(undefined);
              setServiceFilter(undefined);
            }}
          >
            清除筛选
          </Button>
        </div>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={filteredRoutes}
          loading={loading}
          rowKey="id"
          size="middle"
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      {/* Create/Edit Modal */}
      {renderModal()}

      {/* Detail Drawer */}
      {renderDrawer()}
    </div>
  );
};

export default GatewayRoutesPage;
