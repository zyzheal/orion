/**
 * ITSM Self-Service Portal
 *
 * End-user facing portal for:
 * - Browsing service catalog by category
 * - Submitting service requests (with dynamic form fields)
 * - Viewing own tickets with status tracking
 * - Canceling pending tickets
 * - Viewing ticket details with timeline
 *
 * Aligned with backend /api/v1/self-service/* routes
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Badge,
  Card,
  Modal,
  Form,
  Select,
  Input,
  Descriptions,
  Timeline,
  message,
  Row,
  Col,
  Empty,
  Tabs,
  Tooltip,
  Popconfirm,
  Statistic,
  Table,
} from 'antd';
import {
  AppstoreOutlined,
  SendOutlined,
  FileTextOutlined,
  ReloadOutlined,
  EyeOutlined,
  StopOutlined,
  ArrowLeftOutlined,
  InboxOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  getServiceCategories,
  getCatalogServices,
  getMyTickets,
  getMyTicket,
  createMyTicket,
  cancelMyTicket,
  type ServiceCategory,
  type ServiceItem,
  type SelfServiceTicket,
  type CreateSelfServiceTicketPayload,
} from '@/api/self-service';
import { colors, spacing, componentRadius, shadows } from '@/tokens';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// ============================================================================
// Constants & Configs
// ============================================================================

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  infrastructure: <InboxOutlined />,
  application: <AppstoreOutlined />,
  database: <SyncOutlined />,
  network: <ExclamationCircleOutlined />,
  security: <CheckCircleOutlined />,
  deployment: <SendOutlined />,
  pipeline: <FileTextOutlined />,
  performance: <ClockCircleOutlined />,
  cost: <CloseCircleOutlined />,
};

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  critical: { color: colors.error[400], label: '紧急' },
  high: { color: colors.warning[500], label: '高' },
  medium: { color: colors.primary[500], label: '中' },
  low: { color: colors.neutral[500], label: '低' },
};

const TICKET_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending: { color: 'blue', label: '待审批' },
  approved: { color: 'cyan', label: '已批准' },
  in_progress: { color: 'orange', label: '处理中' },
  fulfilled: { color: 'success', label: '已完成' },
  rejected: { color: 'error', label: '已拒绝' },
  cancelled: { color: 'default', label: '已取消' },
};

const SERVICE_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  active: { color: 'success', label: '可用' },
  inactive: { color: 'default', label: '不可用' },
};

// ============================================================================
// Helper: Render dynamic form fields based on service form_schema
// ============================================================================

function renderDynamicFields(schema: Record<string, unknown>, form: Form.FormInstance) {
  if (!schema || typeof schema !== 'object') return null;

  const fields = schema.fields || schema;
  if (!Array.isArray(fields)) return null;

  return fields.map((field: any) => {
    const fieldName = field.name || field.key;
    const fieldLabel = field.label || fieldName;
    const fieldType = field.type || 'text';
    const required = field.required || false;

    if (fieldType === 'textarea') {
      return (
        <Form.Item
          key={fieldName}
          name={fieldName}
          label={fieldLabel}
          rules={required ? [{ required: true, message: `请输入${fieldLabel}` }] : undefined}
        >
          <Input.TextArea rows={3} placeholder={field.placeholder || `请输入${fieldLabel}`} />
        </Form.Item>
      );
    }

    if (fieldType === 'select' && field.options) {
      return (
        <Form.Item
          key={fieldName}
          name={fieldName}
          label={fieldLabel}
          rules={required ? [{ required: true, message: `请选择${fieldLabel}` }] : undefined}
        >
          <Select placeholder={`请选择${fieldLabel}`} allowClear>
            {field.options.map((opt: any) => (
              <Option key={opt.value || opt} value={opt.value || opt}>
                {opt.label || opt}
              </Option>
            ))}
          </Select>
        </Form.Item>
      );
    }

    if (fieldType === 'number') {
      return (
        <Form.Item
          key={fieldName}
          name={fieldName}
          label={fieldLabel}
          rules={required ? [{ required: true, message: `请输入${fieldLabel}` }] : undefined}
        >
          <Input type="number" placeholder={field.placeholder || `请输入${fieldLabel}`} />
        </Form.Item>
      );
    }

    // Default: text input
    return (
      <Form.Item
        key={fieldName}
        name={fieldName}
        label={fieldLabel}
        rules={required ? [{ required: true, message: `请输入${fieldLabel}` }] : undefined}
      >
        <Input placeholder={field.placeholder || `请输入${fieldLabel}`} />
      </Form.Item>
    );
  });
}

// ============================================================================
// ServicePortal Page Component
// ============================================================================

const ServicePortal: React.FC = () => {
  const navigate = useNavigate();

  // ---- Catalog State ----
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);

  // ---- Tickets State ----
  const [tickets, setTickets] = useState<SelfServiceTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string | undefined>(undefined);
  const [selectedTicket, setSelectedTicket] = useState<SelfServiceTicket | null>(null);

  // ---- Modals & Forms ----
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [requestForm] = Form.useForm();

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadCategories = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const res = await getServiceCategories();
      setCategories(res.data || []);
    } catch (err: any) {
      message.error(`加载服务分类失败: ${err.message || '未知错误'}`);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const loadServices = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 100, offset: 0 };
      if (selectedCategory) params.category_id = selectedCategory;
      const res = await getCatalogServices(params);
      setServices(res.data || []);
    } catch (err: any) {
      message.error(`加载服务目录失败: ${err.message || '未知错误'}`);
    } finally {
      setCatalogLoading(false);
    }
  }, [selectedCategory]);

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 50, offset: 0 };
      if (ticketStatusFilter) params.status = ticketStatusFilter;
      const res = await getMyTickets(params);
      setTickets(res.data || []);
    } catch (err: any) {
      message.error(`加载我的工单失败: ${err.message || '未知错误'}`);
    } finally {
      setTicketsLoading(false);
    }
  }, [ticketStatusFilter]);

  const loadTicketDetail = useCallback(async (id: string) => {
    try {
      const detail = await getMyTicket(id);
      setSelectedTicket(detail);
    } catch (err: any) {
      message.error(`加载工单详情失败: ${err.message || '未知错误'}`);
    }
  }, []);

  useEffect(() => {
    loadCategories();
    loadTickets();
  }, [loadCategories, loadTickets]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  // ============================================================================
  // Request Submission
  // ============================================================================

  const handleOpenRequestModal = (service: ServiceItem) => {
    setSelectedService(service);
    requestForm.resetFields();
    requestForm.setFieldsValue({ priority: 'medium' });
    setRequestModalOpen(true);
  };

  const handleSubmitRequest = async () => {
    if (!selectedService) return;
    try {
      const values = await requestForm.validateFields();
      setActionLoading('request-submit');
      const payload: CreateSelfServiceTicketPayload = {
        service_id: selectedService.id,
        title: values.title,
        description: values.description || '',
        priority: values.priority || 'medium',
        form_data: values.form_data || {},
      };
      await createMyTicket(payload);
      message.success('服务请求已提交');
      setRequestModalOpen(false);
      loadTickets();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(`提交失败: ${err.message || '未知错误'}`);
    } finally {
      setActionLoading(null);
    }
  };

  // ============================================================================
  // Ticket Actions
  // ============================================================================

  const handleViewTicket = async (ticket: SelfServiceTicket) => {
    await loadTicketDetail(ticket.id);
  };

  const handleCancelTicket = async (ticket: SelfServiceTicket) => {
    try {
      setActionLoading(`cancel-${ticket.id}`);
      await cancelMyTicket(ticket.id);
      message.success('工单已取消');
      loadTickets();
      if (selectedTicket?.id === ticket.id) {
        setSelectedTicket(null);
      }
    } catch (err: any) {
      message.error(`取消失败: ${err.message || '未知错误'}`);
    } finally {
      setActionLoading(null);
    }
  };

  // ============================================================================
  // Stats
  // ============================================================================

  const pendingCount = useMemo(
    () => tickets.filter((t) => t.status === 'pending').length,
    [tickets]
  );
  const inProgressCount = useMemo(
    () => tickets.filter((t) => t.status === 'in_progress').length,
    [tickets]
  );
  const fulfilledCount = useMemo(
    () => tickets.filter((t) => t.status === 'fulfilled').length,
    [tickets]
  );

  // ============================================================================
  // Render: Catalog Grid
  // ============================================================================

  const renderCatalog = () => (
    <div>
      {/* Category filter + actions */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginBottom: spacing.md,
          alignItems: 'center',
        }}
      >
        <Select
          placeholder="按分类筛选"
          value={selectedCategory}
          onChange={(v) => setSelectedCategory(v)}
          allowClear
          style={{ width: 180, borderRadius: componentRadius.input }}
        >
          {categories.map((cat) => (
            <Option key={cat.id} value={cat.id}>
              {cat.name}
            </Option>
          ))}
        </Select>
        <div style={{ flex: 1 }} />
        <Button icon={<ReloadOutlined />} onClick={loadServices} loading={catalogLoading}>
          刷新
        </Button>
      </div>

      {/* Services grid */}
      {services.length === 0 && !catalogLoading ? (
        <Empty description="暂无可用服务" style={{ marginTop: spacing.xl }} />
      ) : (
        <Row gutter={[spacing.md, spacing.md]}>
          {services.map((service) => {
            const category = categories.find((c) => c.id === service.category_id);
            return (
              <Col key={service.id} xs={24} sm={12} lg={8} xl={6}>
                <Card
                  hoverable
                  style={{
                    borderRadius: componentRadius.card,
                    boxShadow: shadows.card,
                    height: '100%',
                  }}
                  styles={{ body: { padding: spacing.lg } }}
                  actions={[
                    <Tooltip title="提交请求" key="request">
                      <Button
                        type="text"
                        size="small"
                        icon={<SendOutlined />}
                        onClick={() => handleOpenRequestModal(service)}
                        disabled={service.status !== 'active'}
                      />
                    </Tooltip>,
                  ]}
                >
                  <div style={{ marginBottom: spacing.sm }}>
                    <Space size={spacing.xs} align="center">
                      {CATEGORY_ICONS[service.category_id] ? (
                        <span style={{ color: colors.primary[500], fontSize: 18 }}>
                          {CATEGORY_ICONS[service.category_id]}
                        </span>
                      ) : null}
                      <Text strong style={{ fontSize: 15, color: colors.neutral[900] }}>
                        {service.name}
                      </Text>
                    </Space>
                  </div>
                  <Paragraph
                    type="secondary"
                    ellipsis={{ rows: 2 }}
                    style={{ marginBottom: spacing.sm, fontSize: 13, minHeight: 40 }}
                  >
                    {service.description || '暂无描述'}
                  </Paragraph>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Tag color={SERVICE_STATUS_CONFIG[service.status]?.color || 'default'} style={{ margin: 0, borderRadius: componentRadius.tag }}>
                      {SERVICE_STATUS_CONFIG[service.status]?.label || service.status}
                    </Tag>
                    {category && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {category.name}
                      </Text>
                    )}
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );

  // ============================================================================
  // Render: My Tickets List
  // ============================================================================

  const renderMyTickets = () => {
    const filteredTickets = useMemo(() => {
      if (!ticketStatusFilter || ticketStatusFilter === 'all') return tickets;
      return tickets.filter((t) => t.status === ticketStatusFilter);
    }, [tickets, ticketStatusFilter]);

    const columns = [
      {
        title: '工单ID',
        dataIndex: 'id',
        key: 'id',
        width: 100,
        render: (value: string) => (
          <Text strong style={{ color: colors.primary[500], cursor: 'pointer' }} onClick={() => handleViewTicket({ ...filteredTickets.find((t) => t.id === value) } as any)}>
            {value}
          </Text>
        ),
      },
      {
        title: '标题',
        dataIndex: 'title',
        key: 'title',
        width: 260,
        render: (value: string, record: SelfServiceTicket) => (
          <Space direction="vertical" size={0}>
            <Text strong style={{ cursor: 'pointer', color: colors.primary[500] }} onClick={() => handleViewTicket(record)}>
              {value}
            </Text>
            <Text type="secondary" style={{ fontSize: spacing[3] }}>
              {record.service_name || record.category_name || ''}
            </Text>
          </Space>
        ),
      },
      {
        title: '优先级',
        dataIndex: 'priority',
        key: 'priority',
        width: 80,
        render: (value: string) => {
          const cfg = PRIORITY_CONFIG[value] || { color: 'default', label: value };
          return <Tag color={cfg.color} style={{ margin: 0, borderRadius: componentRadius.tag }}>{cfg.label}</Tag>;
        },
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: (value: string) => {
          const cfg = TICKET_STATUS_CONFIG[value] || { color: 'default', label: value };
          return <Badge status={cfg.color as any} text={cfg.label} />;
        },
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 140,
        render: (value: string) => (
          <Text type="secondary" style={{ fontSize: 13 }}>
            {dayjs(value).format('MM-DD HH:mm')}
          </Text>
        ),
      },
      {
        title: '操作',
        key: 'actions',
        width: 120,
        render: (_: any, record: SelfServiceTicket) => (
          <Space size="small">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewTicket(record)}>
              详情
            </Button>
            {record.status === 'pending' && (
              <Popconfirm
                title="确定要取消此工单吗？"
                onConfirm={() => handleCancelTicket(record)}
                okText="确认"
                cancelText="取消"
              >
                <Button type="link" size="small" danger icon={<StopOutlined />} loading={actionLoading === `cancel-${record.id}`}>
                  取消
                </Button>
              </Popconfirm>
            )}
          </Space>
        ),
      },
    ];

    return (
      <div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: spacing.sm,
            marginBottom: spacing.md,
            alignItems: 'center',
          }}
        >
          <Select
            placeholder="状态筛选"
            value={ticketStatusFilter}
            onChange={(v) => setTicketStatusFilter(v)}
            allowClear
            style={{ width: 140 }}
          >
            <Option value="all">全部</Option>
            {Object.entries(TICKET_STATUS_CONFIG).map(([key, cfg]) => (
              <Option key={key} value={key}>
                {cfg.label}
              </Option>
            ))}
          </Select>
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={loadTickets} loading={ticketsLoading}>
            刷新
          </Button>
        </div>

        {filteredTickets.length === 0 && !ticketsLoading ? (
          <Empty description="暂无工单" style={{ marginTop: spacing.xl }}>
            <Text type="secondary">浏览服务目录并提交您的第一个请求</Text>
          </Empty>
        ) : (
          <Card
            style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
            styles={{ body: { padding: 0 } }}
          >
            <Table
              columns={columns}
              dataSource={filteredTickets}
              loading={ticketsLoading}
              rowKey="id"
              size="middle"
              pagination={{
                pageSize: 10,
                showTotal: (total) => `共 ${total} 条`,
              }}
            />
          </Card>
        )}
      </div>
    );
  };

  // ============================================================================
  // Render: Ticket Detail
  // ============================================================================

  const renderTicketDetail = () => {
    if (!selectedTicket) {
      return <Empty description="未选择工单" />;
    }

    const statusCfg = TICKET_STATUS_CONFIG[selectedTicket.status] || { color: 'default', label: selectedTicket.status };
    const priorityCfg = PRIORITY_CONFIG[selectedTicket.priority] || { color: 'default', label: selectedTicket.priority };
    const canCancel = selectedTicket.status === 'pending' || selectedTicket.status === 'approved';

    return (
      <div>
        {/* Back + Actions header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.lg,
          }}
        >
          <Button icon={<ArrowLeftOutlined />} onClick={() => setSelectedTicket(null)}>
            返回列表
          </Button>
          <Space>
            {canCancel && (
              <Popconfirm
                title="确定要取消此工单吗？"
                onConfirm={() => handleCancelTicket(selectedTicket)}
                okText="确认"
                cancelText="取消"
              >
                <Button danger icon={<StopOutlined />} loading={actionLoading === `cancel-${selectedTicket.id}`}>
                  取消工单
                </Button>
              </Popconfirm>
            )}
          </Space>
        </div>

        {/* Header */}
        <div style={{ marginBottom: spacing.lg }}>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <FileTextOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            {selectedTicket.title}
          </Title>
          <Space size={spacing.sm}>
            <Tag color={statusCfg.color} style={{ borderRadius: componentRadius.tag }}>
              {statusCfg.label}
            </Tag>
            <Tag color={priorityCfg.color} style={{ borderRadius: componentRadius.tag }}>
              {priorityCfg.label}
            </Tag>
          </Space>
        </div>

        {/* Detail Card */}
        <Card
          style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
          styles={{ body: { padding: spacing.lg } }}
        >
          <Descriptions column={{ xs: 1, sm: 2, md: 2 }} bordered size="small">
            <Descriptions.Item label="工单标题">{selectedTicket.title}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Badge status={statusCfg.color as any} text={statusCfg.label} />
            </Descriptions.Item>
            <Descriptions.Item label="优先级">
              <Tag color={priorityCfg.color} style={{ margin: 0 }}>
                {priorityCfg.label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="关联服务">{selectedTicket.service_name || selectedTicket.id}</Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>
              {selectedTicket.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(selectedTicket.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {dayjs(selectedTicket.updated_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            {selectedTicket.cancelled_at && (
              <Descriptions.Item label="取消时间">
                {dayjs(selectedTicket.cancelled_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            )}
          </Descriptions>

          {/* Dynamic form data section */}
          {selectedTicket.form_data && Object.keys(selectedTicket.form_data).length > 0 && (
            <div style={{ marginTop: spacing.lg }}>
              <Title level={4} style={{ marginBottom: spacing.sm }}>
                表单数据
              </Title>
              <Card
                size="small"
                style={{
                  background: colors.neutral[50],
                  borderRadius: componentRadius.card,
                }}
              >
                <Descriptions column={1} size="small" colon>
                  {Object.entries(selectedTicket.form_data).map(([key, value]) => (
                    <Descriptions.Item key={key} label={key}>
                      {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </Card>
            </div>
          )}

          {/* Timeline / Status history */}
          <div style={{ marginTop: spacing.lg }}>
            <Title level={4} style={{ marginBottom: spacing.sm }}>
              状态历史
            </Title>
            <Timeline
              items={[
                {
                  color: 'blue',
                  children: (
                    <Space direction="vertical" size={0}>
                      <Text strong>工单已创建</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(selectedTicket.created_at).format('YYYY-MM-DD HH:mm:ss')}
                      </Text>
                    </Space>
                  ),
                },
                ...(selectedTicket.status !== 'pending'
                  ? [
                      {
                        color: 'cyan',
                        children: (
                          <Space direction="vertical" size={0}>
                            <Text strong>已批准</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              等待处理
                            </Text>
                          </Space>
                        ),
                      },
                    ]
                  : []),
                ...(selectedTicket.status === 'in_progress' || selectedTicket.status === 'fulfilled'
                  ? [
                      {
                        color: 'orange',
                        children: (
                          <Space direction="vertical" size={0}>
                            <Text strong>处理中</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              正在处理您的请求
                            </Text>
                          </Space>
                        ),
                      },
                    ]
                  : []),
                ...(selectedTicket.status === 'fulfilled'
                  ? [
                      {
                        color: 'green',
                        children: (
                          <Space direction="vertical" size={0}>
                            <Text strong>已完成</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {dayjs(selectedTicket.updated_at).format('YYYY-MM-DD HH:mm:ss')}
                            </Text>
                          </Space>
                        ),
                      },
                    ]
                  : []),
                ...(selectedTicket.status === 'cancelled'
                  ? [
                      {
                        color: 'gray',
                        children: (
                          <Space direction="vertical" size={0}>
                            <Text strong>已取消</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {dayjs(selectedTicket.cancelled_at || selectedTicket.updated_at).format('YYYY-MM-DD HH:mm:ss')}
                            </Text>
                          </Space>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        </Card>
      </div>
    );
  };

  // ============================================================================
  // Render: Request Modal
  // ============================================================================

  const renderRequestModal = () => {
    const dynamicFields = selectedService?.form_schema
      ? renderDynamicFields(selectedService.form_schema, requestForm)
      : null;

    return (
      <Modal
        title={`提交请求: ${selectedService?.name || ''}`}
        open={requestModalOpen}
        onOk={handleSubmitRequest}
        onCancel={() => setRequestModalOpen(false)}
        confirmLoading={actionLoading === 'request-submit'}
        okText="提交请求"
        cancelText="取消"
        width={600}
        destroyOnClose
      >
        <Form
          form={requestForm}
          layout="vertical"
          style={{ marginTop: spacing.md }}
          initialValues={{ priority: 'medium' }}
        >
          <Form.Item
            name="title"
            label="请求标题"
            rules={[{ required: true, message: '请输入请求标题' }]}
          >
            <Input placeholder="简述您的请求" />
          </Form.Item>

          <Form.Item name="description" label="详细描述">
            <TextArea rows={4} placeholder="详细描述您的需求..." />
          </Form.Item>

          <Form.Item name="priority" label="优先级">
            <Select>
              <Option value="critical">紧急</Option>
              <Option value="high">高</Option>
              <Option value="medium">中</Option>
              <Option value="low">低</Option>
            </Select>
          </Form.Item>

          {/* Dynamic fields from service form_schema */}
          {dynamicFields}
        </Form>
      </Modal>
    );
  };

  // ============================================================================
  // Tab Items
  // ============================================================================

  const tabItems = useMemo(() => {
    const items = [
      {
        key: 'catalog',
        label: (
          <span>
            <AppstoreOutlined />
            服务目录
          </span>
        ),
        children: renderCatalog(),
      },
      {
        key: 'my-tickets',
        label: (
          <span>
            <FileTextOutlined />
            我的工单
            {pendingCount > 0 && (
              <Badge count={pendingCount} size="small" style={{ marginLeft: 6 }} overflowCount={99} />
            )}
          </span>
        ),
        children: renderMyTickets(),
      },
    ];

    if (selectedTicket) {
      items.push({
        key: 'ticket-detail',
        label: (
          <span>
            <EyeOutlined />
            工单详情
          </span>
        ),
        children: renderTicketDetail(),
      });
    }

    return items;
  }, [
    services,
    categories,
    selectedCategory,
    selectedService,
    tickets,
    selectedTicket,
    ticketStatusFilter,
    pendingCount,
    actionLoading,
  ]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div data-testid="service-portal-page">
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <AppstoreOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            自助服务门户
          </Title>
          <Text type="secondary">浏览服务目录、提交请求、查看工单状态</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { loadCategories(); loadTickets(); }}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Summary cards */}
      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.lg }}>
        <Col xs={24} sm={8}>
          <Card
            size="small"
            style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
            styles={{ body: { padding: spacing.lg } }}
          >
            <Statistic
              title="我的工单"
              value={tickets.length}
              prefix={<FileTextOutlined style={{ color: colors.primary[500] }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            size="small"
            style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
            styles={{ body: { padding: spacing.lg } }}
          >
            <Statistic
              title="待审批"
              value={pendingCount}
              prefix={<ClockCircleOutlined style={{ color: colors.warning[500] }} />
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            size="small"
            style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
            styles={{ body: { padding: spacing.lg } }}
          >
            <Statistic
              title="已完成"
              value={fulfilledCount}
              prefix={<CheckCircleOutlined style={{ color: colors.success[500] }} />
              }
            />
          </Card>
        </Col>
      </Row>

      {/* Main content tabs */}
      <Card
        style={{
          borderRadius: componentRadius.card,
          boxShadow: shadows.card,
        }}
        styles={{ body: { padding: spacing.lg } }}
      >
        <Tabs
          activeKey={selectedTicket ? 'ticket-detail' : 'catalog'}
          onChange={(key) => {
            if (key === 'catalog') setSelectedTicket(null);
            if (key === 'my-tickets') setSelectedTicket(null);
          }}
          items={tabItems}
          destroyInactiveTabPane={false}
        />
      </Card>

      {/* Request Modal */}
      {renderRequestModal()}
    </div>
  );
};

export default ServicePortal;
