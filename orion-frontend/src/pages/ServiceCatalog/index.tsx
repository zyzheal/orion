/**
 * Service Catalog Page
 *
 * Full-featured service catalog management with:
 * - Tab 1: Service Catalog (card grid + table view with CRUD)
 * - Tab 2: Service Detail (shown when clicking a service)
 * - Tab 3: Service Requests (table with workflow status transitions)
 * - Tab 4: Request Detail (shown when clicking a request)
 * - Stats bar at top (total services, total requests, requests by status)
 *
 * Aligned with backend /api/v1/catalog/* routes
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Button,
  Modal,
  Form,
  Select,
  Tag,
  Tabs,
  Empty,
  message,
  Space,
  Typography,
  Descriptions,
  Popconfirm,
  Input,
  Badge,
  Row,
  Col,
  Statistic,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  AppstoreOutlined,
  ReloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  StopOutlined,
  SendOutlined,
  ArrowLeftOutlined,
  UserOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { Layout } from '@/components/Layout';
import {
  type CatalogService,
  type CatalogRequest,
  type CatalogStats,
  getCatalogServices,
  getCatalogService,
  createCatalogService,
  updateCatalogService,
  deleteCatalogService,
  getServiceRequests,
  getServiceRequest,
  submitServiceRequest,
  updateServiceRequestStatus,
  getCatalogStats,
} from '@/api/service-catalog';
import Table from '@/components/Table';
import { colors, spacing, componentRadius, shadows } from '@/tokens';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// ============================================================================
// Constants & Configs
// ============================================================================

const SLA_TIER_COLORS: Record<string, string> = {
  gold: '#faad14',
  silver: '#bfbfbf',
  bronze: '#d48806',
};

const SLA_TIER_LABELS: Record<string, string> = {
  gold: '金牌',
  silver: '银牌',
  bronze: '铜牌',
};

const SERVICE_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  active: { color: 'success', label: '活跃' },
  inactive: { color: 'default', label: '停用' },
  retired: { color: 'error', label: '退役' },
};

const REQUEST_PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  critical: { color: 'red', label: '紧急' },
  high: { color: 'orange', label: '高' },
  medium: { color: 'blue', label: '中' },
  low: { color: 'green', label: '低' },
};

const REQUEST_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending: { color: 'blue', label: '待审批' },
  approved: { color: 'green', label: '已批准' },
  in_progress: { color: 'orange', label: '处理中' },
  fulfilled: { color: 'default', label: '已完成' },
  rejected: { color: 'red', label: '已拒绝' },
  cancelled: { color: 'default', label: '已取消' },
};

const CATEGORY_OPTIONS = [
  '基础设施',
  '数据库',
  '中间件',
  '安全',
  '监控',
  'CI/CD',
  '容器平台',
  'AI 平台',
  '数据平台',
  '其他',
];

/** Status transition rules: current status -> allowed actions */
const STATUS_TRANSITIONS: Record<string, { action: string; label: string; icon: React.ReactNode }[]> = {
  pending: [
    { action: 'approve', label: '批准', icon: <CheckCircleOutlined /> },
    { action: 'reject', label: '拒绝', icon: <CloseCircleOutlined /> },
  ],
  approved: [
    { action: 'fulfill', label: '开始处理', icon: <SyncOutlined /> },
  ],
  in_progress: [
    { action: 'fulfill', label: '完成', icon: <CheckCircleOutlined /> },
  ],
};

// ============================================================================
// ServiceCatalog Page Component
// ============================================================================

const ServiceCatalog: React.FC = () => {
  // ---- Tab & Navigation State ----
  const [activeTab, setActiveTab] = useState<string>('services');
  const [selectedService, setSelectedService] = useState<CatalogService | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<CatalogRequest | null>(null);

  // ---- Services State ----
  const [services, setServices] = useState<CatalogService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState<string | undefined>(undefined);
  const [serviceStatusFilter, setServiceStatusFilter] = useState<string | undefined>(undefined);
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');

  // ---- Requests State ----
  const [requests, setRequests] = useState<CatalogRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestStatusFilter, setRequestStatusFilter] = useState<string | undefined>(undefined);
  const [requestPriorityFilter, setRequestPriorityFilter] = useState<string | undefined>(undefined);

  // ---- Stats State ----
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // ---- Modal State ----
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [serviceModalMode, setServiceModalMode] = useState<'create' | 'edit'>('create');
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ---- Forms ----
  const [serviceForm] = Form.useForm();
  const [requestForm] = Form.useForm();

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadServices = useCallback(async () => {
    setServicesLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 100, offset: 0 };
      if (serviceCategoryFilter) params.category = serviceCategoryFilter;
      if (serviceStatusFilter) params.status = serviceStatusFilter;
      const res = await getCatalogServices(params);
      setServices(res.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '未知错误';
      message.error(`加载服务目录失败: ${msg}`);
    } finally {
      setServicesLoading(false);
    }
  }, [serviceCategoryFilter, serviceStatusFilter]);

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 100, offset: 0 };
      if (requestStatusFilter) params.status = requestStatusFilter;
      const res = await getServiceRequests(params);
      setRequests(res.data || []);
    } catch (err: any) {
      message.error(`加载服务请求失败: ${err.message || '未知错误'}`);
    } finally {
      setRequestsLoading(false);
    }
  }, [requestStatusFilter]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await getCatalogStats();
      setStats(data);
    } catch {
      // Stats failure is non-critical
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadAll = useCallback(() => {
    loadServices();
    loadRequests();
    loadStats();
  }, [loadServices, loadRequests, loadStats]);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // ============================================================================
  // Service CRUD Handlers
  // ============================================================================

  const handleCreateService = () => {
    setServiceModalMode('create');
    serviceForm.resetFields();
    setServiceModalOpen(true);
  };

  const handleEditService = (record: CatalogService) => {
    setServiceModalMode('edit');
    serviceForm.setFieldsValue({
      name: record.name,
      description: record.description,
      category: record.category,
      owner: record.owner,
      support_team: record.support_team,
      sla_tier: record.sla_tier,
      availability_target: record.availability_target,
      response_time_target: record.response_time_target,
      status: record.status,
    });
    setSelectedService(record);
    setServiceModalOpen(true);
  };

  const handleServiceModalSubmit = async () => {
    try {
      const values = await serviceForm.validateFields();
      setActionLoading('service-save');
      if (serviceModalMode === 'create') {
        await createCatalogService(values);
        message.success('服务创建成功');
      } else if (selectedService) {
        await updateCatalogService(selectedService.id, values);
        message.success('服务更新成功');
      }
      setServiceModalOpen(false);
      loadServices();
      loadStats();
    } catch (err: any) {
      if (err.errorFields) return; // form validation error
      message.error(`操作失败: ${err.message || '未知错误'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteService = async (id: string) => {
    try {
      setActionLoading(`delete-${id}`);
      await deleteCatalogService(id);
      message.success('服务已删除');
      if (selectedService?.id === id) {
        setSelectedService(null);
        setActiveTab('services');
      }
      loadServices();
      loadStats();
    } catch (err: any) {
      message.error(`删除失败: ${err.message || '未知错误'}`);
    } finally {
      setActionLoading(null);
    }
  };

  // ============================================================================
  // Service Detail Handlers
  // ============================================================================

  const handleViewService = async (record: CatalogService) => {
    try {
      const detail = await getCatalogService(record.id);
      setSelectedService(detail);
      setActiveTab('service-detail');
    } catch (err: any) {
      message.error(`加载服务详情失败: ${err.message || '未知错误'}`);
    }
  };

  // ============================================================================
  // Request Handlers
  // ============================================================================

  const handleOpenRequestModal = (service: CatalogService) => {
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
      await submitServiceRequest(selectedService.id, values);
      message.success('服务请求已提交');
      setRequestModalOpen(false);
      loadRequests();
      loadStats();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(`提交失败: ${err.message || '未知错误'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewRequest = async (record: CatalogRequest) => {
    try {
      const detail = await getServiceRequest(record.id);
      setSelectedRequest(detail);
      setActiveTab('request-detail');
    } catch (err: any) {
      message.error(`加载请求详情失败: ${err.message || '未知错误'}`);
    }
  };

  const handleRequestStatusTransition = async (
    requestId: string,
    action: 'approve' | 'reject' | 'fulfill' | 'cancel',
  ) => {
    try {
      setActionLoading(`${action}-${requestId}`);
      await updateServiceRequestStatus(requestId, action);
      message.success(`操作成功`);
      // Refresh the selected request if viewing detail
      if (selectedRequest?.id === requestId) {
        const updated = await getServiceRequest(requestId);
        setSelectedRequest(updated);
      }
      loadRequests();
      loadStats();
    } catch (err: any) {
      message.error(`操作失败: ${err.message || '未知错误'}`);
    } finally {
      setActionLoading(null);
    }
  };

  // ============================================================================
  // Filtered Services (search)
  // ============================================================================

  const filteredServices = useMemo(() => {
    if (!serviceSearchQuery) return services;
    const q = serviceSearchQuery.toLowerCase();
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q) ||
        (s.owner || '').toLowerCase().includes(q) ||
        (s.support_team || '').toLowerCase().includes(q),
    );
  }, [services, serviceSearchQuery]);

  // ============================================================================
  // Service name resolver for requests table
  // ============================================================================

  const serviceNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    services.forEach((s) => {
      map[s.id] = s.name;
    });
    return map;
  }, [services]);

  // ============================================================================
  // Stats Cards
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
            title="服务总数"
            value={stats?.totalServices ?? services.length}
            prefix={<AppstoreOutlined style={{ color: colors.primary[500] }} />}
            loading={statsLoading}
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
            title="请求总数"
            value={stats?.totalRequests ?? requests.length}
            prefix={<FileTextOutlined style={{ color: colors.info[500] }} />}
            loading={statsLoading}
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
            title="待审批"
            value={stats?.requestsByStatus?.pending ?? 0}
            prefix={<ClockCircleOutlined style={{ color: colors.warning[500] }} />}
            loading={statsLoading}
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
            title="处理中"
            value={stats?.requestsByStatus?.in_progress ?? 0}
            prefix={<SyncOutlined style={{ color: colors.primary[500] }} />}
            loading={statsLoading}
          />
        </Card>
      </Col>
    </Row>
  );

  // ============================================================================
  // Tab 1: Service Catalog List
  // ============================================================================

  const renderServiceCatalog = () => (
    <div>
      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginBottom: spacing.md,
          alignItems: 'center',
        }}
      >
        <Input
          placeholder="搜索服务名称、描述、负责人..."
          prefix={<SearchOutlined style={{ color: colors.neutral[400] }} />}
          value={serviceSearchQuery}
          onChange={(e) => setServiceSearchQuery(e.target.value)}
          style={{ width: 280, borderRadius: componentRadius.input }}
          allowClear
        />
        <Select
          placeholder="分类筛选"
          value={serviceCategoryFilter}
          onChange={(v) => setServiceCategoryFilter(v)}
          allowClear
          style={{ width: 140, borderRadius: componentRadius.input }}
        >
          {CATEGORY_OPTIONS.map((cat) => (
            <Option key={cat} value={cat}>
              {cat}
            </Option>
          ))}
        </Select>
        <Select
          placeholder="状态筛选"
          value={serviceStatusFilter}
          onChange={(v) => setServiceStatusFilter(v)}
          allowClear
          style={{ width: 120, borderRadius: componentRadius.input }}
        >
          <Option value="active">活跃</Option>
          <Option value="inactive">停用</Option>
          <Option value="retired">退役</Option>
        </Select>
        <div style={{ flex: 1 }} />
        <Button icon={<ReloadOutlined />} onClick={loadServices} loading={servicesLoading}>
          刷新
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateService}>
          创建服务
        </Button>
      </div>

      {/* Service cards grid */}
      {filteredServices.length === 0 && !servicesLoading ? (
        <Empty description="暂无服务" style={{ marginTop: spacing.xl }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateService}>
            创建第一个服务
          </Button>
        </Empty>
      ) : (
        <Row gutter={[spacing.md, spacing.md]}>
          {filteredServices.map((service) => (
            <Col key={service.id} xs={24} sm={12} lg={8} xl={6}>
              <Card
                hoverable
                style={{
                  borderRadius: componentRadius.card,
                  boxShadow: shadows.card,
                  borderLeft: `3px solid ${service.sla_tier ? SLA_TIER_COLORS[service.sla_tier] || colors.neutral[300] : colors.neutral[300]}`,
                  height: '100%',
                }}
                styles={{ body: { padding: spacing.lg } }}
                onClick={() => handleViewService(service)}
                actions={[
                  <Tooltip title="编辑" key="edit">
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditService(service);
                      }}
                    />
                  </Tooltip>,
                  <Tooltip title="请求此服务" key="request">
                    <Button
                      type="text"
                      size="small"
                      icon={<SendOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenRequestModal(service);
                      }}
                      disabled={service.status !== 'active'}
                    />
                  </Tooltip>,
                  <Popconfirm
                    key="delete"
                    title="确定要删除此服务吗？"
                    description="删除后不可恢复"
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      handleDeleteService(service.id);
                    }}
                    onCancel={(e) => e?.stopPropagation()}
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                  >
                    <Tooltip title="删除">
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => e.stopPropagation()}
                        loading={actionLoading === `delete-${service.id}`}
                      />
                    </Tooltip>
                  </Popconfirm>,
                ]}
              >
                <div style={{ marginBottom: spacing.sm }}>
                  <Space size={spacing.xs} align="center">
                    <Text strong style={{ fontSize: 15, color: colors.neutral[900] }}>
                      {service.name}
                    </Text>
                  </Space>
                </div>
                <div style={{ marginBottom: spacing.sm }}>
                  <Space size={spacing.xs} wrap>
                    <Tag
                      color={SERVICE_STATUS_CONFIG[service.status]?.color || 'default'}
                      style={{ margin: 0, borderRadius: componentRadius.tag }}
                    >
                      {SERVICE_STATUS_CONFIG[service.status]?.label || service.status}
                    </Tag>
                    {service.sla_tier && (
                      <Tag
                        style={{
                          margin: 0,
                          borderRadius: componentRadius.tag,
                          color: SLA_TIER_COLORS[service.sla_tier],
                          borderColor: SLA_TIER_COLORS[service.sla_tier],
                          background: `${SLA_TIER_COLORS[service.sla_tier]}10`,
                        }}
                      >
                        <SafetyCertificateOutlined style={{ marginRight: 4 }} />
                        {SLA_TIER_LABELS[service.sla_tier] || service.sla_tier}
                      </Tag>
                    )}
                    {service.category && (
                      <Tag style={{ margin: 0, borderRadius: componentRadius.tag }}>{service.category}</Tag>
                    )}
                  </Space>
                </div>
                <Paragraph
                  type="secondary"
                  ellipsis={{ rows: 2 }}
                  style={{ marginBottom: spacing.sm, fontSize: 13, minHeight: 40 }}
                >
                  {service.description || '暂无描述'}
                </Paragraph>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <Text type="secondary">
                    <UserOutlined style={{ marginRight: 4 }} />
                    {service.owner || '未指定'}
                  </Text>
                  <Text type="secondary">
                    <TeamOutlined style={{ marginRight: 4 }} />
                    {service.support_team || '未指定'}
                  </Text>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );

  // ============================================================================
  // Tab 2: Service Detail
  // ============================================================================

  const renderServiceDetail = () => {
    if (!selectedService) {
      return <Empty description="未选择服务" />;
    }
    const statusCfg = SERVICE_STATUS_CONFIG[selectedService.status] || { color: 'default', label: selectedService.status };

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
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => {
                setActiveTab('services');
                setSelectedService(null);
              }}
            >
              返回列表
            </Button>
          </Space>
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => handleEditService(selectedService)}
            >
              编辑
            </Button>
            {selectedService.status === 'active' && (
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={() => handleOpenRequestModal(selectedService)}
              >
                请求此服务
              </Button>
            )}
            <Popconfirm
              title="确定要删除此服务吗？"
              description="删除后不可恢复"
              onConfirm={() => handleDeleteService(selectedService.id)}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<DeleteOutlined />} loading={actionLoading === `delete-${selectedService.id}`}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        </div>

        {/* Header */}
        <div style={{ marginBottom: spacing.lg }}>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <AppstoreOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            {selectedService.name}
          </Title>
          <Space size={spacing.xs}>
            <Tag color={statusCfg.color} style={{ borderRadius: componentRadius.tag }}>
              {statusCfg.label}
            </Tag>
            {selectedService.sla_tier && (
              <Tag
                style={{
                  borderRadius: componentRadius.tag,
                  color: SLA_TIER_COLORS[selectedService.sla_tier],
                  borderColor: SLA_TIER_COLORS[selectedService.sla_tier],
                  background: `${SLA_TIER_COLORS[selectedService.sla_tier]}10`,
                }}
              >
                <SafetyCertificateOutlined style={{ marginRight: 4 }} />
                {SLA_TIER_LABELS[selectedService.sla_tier] || selectedService.sla_tier}
              </Tag>
            )}
          </Space>
        </div>

        {/* Detail Descriptions */}
        <Card
          style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
          styles={{ body: { padding: spacing.lg } }}
        >
          <Descriptions column={{ xs: 1, sm: 2, md: 2 }} bordered size="small">
            <Descriptions.Item label="服务名称">{selectedService.name}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Badge status={statusCfg.color as any} text={statusCfg.label} />
            </Descriptions.Item>
            <Descriptions.Item label="分类">{selectedService.category || '-'}</Descriptions.Item>
            <Descriptions.Item label="SLA 等级">
              {selectedService.sla_tier ? (
                <Tag
                  style={{
                    color: SLA_TIER_COLORS[selectedService.sla_tier],
                    borderColor: SLA_TIER_COLORS[selectedService.sla_tier],
                  }}
                >
                  {SLA_TIER_LABELS[selectedService.sla_tier]}
                </Tag>
              ) : (
                '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="负责人">{selectedService.owner || '-'}</Descriptions.Item>
            <Descriptions.Item label="支持团队">{selectedService.support_team || '-'}</Descriptions.Item>
            <Descriptions.Item label="可用性目标">
              {selectedService.availability_target != null
                ? `${selectedService.availability_target}%`
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="响应时间目标">
              {selectedService.response_time_target != null
                ? `${selectedService.response_time_target} 分钟`
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>
              {selectedService.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(selectedService.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {dayjs(selectedService.updated_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </div>
    );
  };

  // ============================================================================
  // Tab 3: Service Requests Table
  // ============================================================================

  const requestColumns = [
    {
      title: '请求标题',
      dataIndex: 'title',
      key: 'title',
      width: 220,
      render: (value: string, record: CatalogRequest) => (
        <Text
          strong
          style={{ cursor: 'pointer', color: colors.primary[500] }}
          onClick={() => handleViewRequest(record)}
        >
          {value}
        </Text>
      ),
    },
    {
      title: '关联服务',
      dataIndex: 'service_id',
      key: 'service_id',
      width: 140,
      render: (value: string) => (
        <Text>{serviceNameMap[value] || value}</Text>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (value: string) => {
        const cfg = REQUEST_PRIORITY_CONFIG[value] || { color: 'default', label: value };
        return (
          <Tag color={cfg.color} style={{ margin: 0, borderRadius: componentRadius.tag }}>
            {cfg.label}
          </Tag>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value: string) => {
        const cfg = REQUEST_STATUS_CONFIG[value] || { color: 'default', label: value };
        return <Badge status={cfg.color as any} text={cfg.label} />;
      },
    },
    {
      title: '请求人',
      dataIndex: 'requester_id',
      key: 'requester_id',
      width: 100,
      ellipsis: true,
    },
    {
      title: '处理人',
      dataIndex: 'assigned_to',
      key: 'assigned_to',
      width: 100,
      render: (value: string | undefined) => value || <Text type="secondary">未分配</Text>,
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
      width: 200,
      render: (_: any, record: CatalogRequest) => {
        const transitions = STATUS_TRANSITIONS[record.status] || [];
        const canCancel = !['fulfilled', 'rejected', 'cancelled'].includes(record.status);

        return (
          <Space size={4}>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewRequest(record)}
            >
              详情
            </Button>
            {transitions.map((t) => (
              <Popconfirm
                key={t.action}
                title={`确定要${t.label}此请求吗？`}
                onConfirm={() =>
                  handleRequestStatusTransition(record.id, t.action as 'approve' | 'reject' | 'fulfill' | 'cancel')
                }
                okText="确认"
                cancelText="取消"
              >
                <Button
                  type="link"
                  size="small"
                  icon={t.icon}
                  loading={actionLoading === `${t.action}-${record.id}`}
                >
                  {t.label}
                </Button>
              </Popconfirm>
            ))}
            {canCancel && (
              <Popconfirm
                title="确定要取消此请求吗？"
                onConfirm={() => handleRequestStatusTransition(record.id, 'cancel')}
                okText="确认"
                cancelText="取消"
              >
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<StopOutlined />}
                  loading={actionLoading === `cancel-${record.id}`}
                >
                  取消
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  const renderServiceRequests = () => (
    <div>
      {/* Filter bar */}
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
          value={requestStatusFilter}
          onChange={(v) => setRequestStatusFilter(v)}
          allowClear
          style={{ width: 140 }}
        >
          {Object.entries(REQUEST_STATUS_CONFIG).map(([key, cfg]) => (
            <Option key={key} value={key}>
              {cfg.label}
            </Option>
          ))}
        </Select>
        <Select
          placeholder="优先级筛选"
          value={requestPriorityFilter}
          onChange={(v) => setRequestPriorityFilter(v)}
          allowClear
          style={{ width: 120 }}
        >
          {Object.entries(REQUEST_PRIORITY_CONFIG).map(([key, cfg]) => (
            <Option key={key} value={key}>
              {cfg.label}
            </Option>
          ))}
        </Select>
        <div style={{ flex: 1 }} />
        <Button icon={<ReloadOutlined />} onClick={loadRequests} loading={requestsLoading}>
          刷新
        </Button>
      </div>

      {/* Requests table */}
      <Table
        columns={requestColumns as any}
        dataSource={requests}
        rowKey="id"
        loading={requestsLoading}
        pagination={{
          current: 1,
          pageSize: 20,
          total: requests.length,
        }}
        showTotal
      />
    </div>
  );

  // ============================================================================
  // Tab 4: Request Detail
  // ============================================================================

  const renderRequestDetail = () => {
    if (!selectedRequest) {
      return <Empty description="未选择请求" />;
    }
    const statusCfg = REQUEST_STATUS_CONFIG[selectedRequest.status] || {
      color: 'default',
      label: selectedRequest.status,
    };
    const priorityCfg = REQUEST_PRIORITY_CONFIG[selectedRequest.priority] || {
      color: 'default',
      label: selectedRequest.priority,
    };
    const transitions = STATUS_TRANSITIONS[selectedRequest.status] || [];
    const canCancel = !['fulfilled', 'rejected', 'cancelled'].includes(selectedRequest.status);

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
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => {
              setActiveTab('requests');
              setSelectedRequest(null);
            }}
          >
            返回列表
          </Button>
          <Space>
            {transitions.map((t) => (
              <Popconfirm
                key={t.action}
                title={`确定要${t.label}此请求吗？`}
                onConfirm={() =>
                  handleRequestStatusTransition(
                    selectedRequest.id,
                    t.action as 'approve' | 'reject' | 'fulfill' | 'cancel',
                  )
                }
                okText="确认"
                cancelText="取消"
              >
                <Button
                  type={t.action === 'reject' ? 'default' : 'primary'}
                  danger={t.action === 'reject'}
                  icon={t.icon}
                  loading={actionLoading === `${t.action}-${selectedRequest.id}`}
                >
                  {t.label}
                </Button>
              </Popconfirm>
            ))}
            {canCancel && (
              <Popconfirm
                title="确定要取消此请求吗？"
                onConfirm={() => handleRequestStatusTransition(selectedRequest.id, 'cancel')}
                okText="确认"
                cancelText="取消"
              >
                <Button
                  danger
                  icon={<StopOutlined />}
                  loading={actionLoading === `cancel-${selectedRequest.id}`}
                >
                  取消请求
                </Button>
              </Popconfirm>
            )}
          </Space>
        </div>

        {/* Header */}
        <div style={{ marginBottom: spacing.lg }}>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <FileTextOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            {selectedRequest.title}
          </Title>
          <Space size={spacing.sm}>
            <Tag color={statusCfg.color} style={{ borderRadius: componentRadius.tag }}>
              {statusCfg.label}
            </Tag>
            <Tag color={priorityCfg.color} style={{ borderRadius: componentRadius.tag }}>
              {priorityCfg.label}
            </Tag>
            {selectedRequest.sla_breach && (
              <Tag color="red" style={{ borderRadius: componentRadius.tag }}>
                <ExclamationCircleOutlined style={{ marginRight: 4 }} />
                SLA 违约
              </Tag>
            )}
          </Space>
        </div>

        {/* Request Detail */}
        <Card
          style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
          styles={{ body: { padding: spacing.lg } }}
        >
          <Descriptions column={{ xs: 1, sm: 2, md: 2 }} bordered size="small">
            <Descriptions.Item label="请求标题">{selectedRequest.title}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Badge status={statusCfg.color as any} text={statusCfg.label} />
            </Descriptions.Item>
            <Descriptions.Item label="优先级">
              <Tag color={priorityCfg.color} style={{ margin: 0 }}>
                {priorityCfg.label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="关联服务">
              {serviceNameMap[selectedRequest.service_id] || selectedRequest.service_id}
            </Descriptions.Item>
            <Descriptions.Item label="请求人">{selectedRequest.requester_id}</Descriptions.Item>
            <Descriptions.Item label="处理人">{selectedRequest.assigned_to || '-'}</Descriptions.Item>
            <Descriptions.Item label="审批人">{selectedRequest.approved_by || '-'}</Descriptions.Item>
            <Descriptions.Item label="审批时间">
              {selectedRequest.approved_at
                ? dayjs(selectedRequest.approved_at).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="完成时间">
              {selectedRequest.fulfilled_at
                ? dayjs(selectedRequest.fulfilled_at).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="SLA 违约">
              {selectedRequest.sla_breach ? (
                <Tag color="red">是</Tag>
              ) : (
                <Tag color="green">否</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>
              {selectedRequest.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(selectedRequest.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {dayjs(selectedRequest.updated_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>

          {/* Form data section */}
          {selectedRequest.form_data && Object.keys(selectedRequest.form_data).length > 0 && (
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
                  {Object.entries(selectedRequest.form_data).map(([key, value]) => (
                    <Descriptions.Item key={key} label={key}>
                      {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </Card>
            </div>
          )}
        </Card>
      </div>
    );
  };

  // ============================================================================
  // Service Create/Edit Modal
  // ============================================================================

  const renderServiceModal = () => (
    <Modal
      title={serviceModalMode === 'create' ? '创建服务' : '编辑服务'}
      open={serviceModalOpen}
      onOk={handleServiceModalSubmit}
      onCancel={() => setServiceModalOpen(false)}
      confirmLoading={actionLoading === 'service-save'}
      okText={serviceModalMode === 'create' ? '创建' : '保存'}
      cancelText="取消"
      width={640}
      destroyOnClose
    >
      <Form
        form={serviceForm}
        layout="vertical"
        style={{ marginTop: spacing.md }}
        initialValues={{ sla_tier: 'silver', status: 'active' }}
      >
        <Row gutter={spacing.md}>
          <Col span={12}>
            <Form.Item
              name="name"
              label="服务名称"
              rules={[{ required: true, message: '请输入服务名称' }]}
            >
              <Input placeholder="输入服务名称" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="category" label="分类">
              <Select placeholder="选择分类" allowClear>
                {CATEGORY_OPTIONS.map((cat) => (
                  <Option key={cat} value={cat}>
                    {cat}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="description" label="描述">
          <TextArea rows={3} placeholder="输入服务描述" />
        </Form.Item>

        <Row gutter={spacing.md}>
          <Col span={12}>
            <Form.Item name="owner" label="负责人">
              <Input placeholder="输入负责人" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="support_team" label="支持团队">
              <Input placeholder="输入支持团队" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={spacing.md}>
          <Col span={8}>
            <Form.Item name="sla_tier" label="SLA 等级">
              <Select placeholder="选择 SLA 等级">
                <Option value="gold">金牌</Option>
                <Option value="silver">银牌</Option>
                <Option value="bronze">铜牌</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="availability_target" label="可用性目标 (%)">
              <Input type="number" min={0} max={100} placeholder="99.9" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="response_time_target" label="响应时间目标 (分钟)">
              <Input type="number" min={0} placeholder="30" />
            </Form.Item>
          </Col>
        </Row>

        {serviceModalMode === 'edit' && (
          <Form.Item name="status" label="状态">
            <Select placeholder="选择状态">
              <Option value="active">活跃</Option>
              <Option value="inactive">停用</Option>
              <Option value="retired">退役</Option>
            </Select>
          </Form.Item>
        )}
      </Form>
    </Modal>
  );

  // ============================================================================
  // Request Submission Modal
  // ============================================================================

  const renderRequestModal = () => (
    <Modal
      title={`请求服务: ${selectedService?.name || ''}`}
      open={requestModalOpen}
      onOk={handleSubmitRequest}
      onCancel={() => setRequestModalOpen(false)}
      confirmLoading={actionLoading === 'request-submit'}
      okText="提交请求"
      cancelText="取消"
      width={520}
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
      </Form>
    </Modal>
  );

  // ============================================================================
  // Tab Items
  // ============================================================================

  const tabItems = useMemo(() => {
    const items = [
      {
        key: 'services',
        label: (
          <span>
            <AppstoreOutlined />
            服务目录
          </span>
        ),
        children: renderServiceCatalog(),
      },
      {
        key: 'requests',
        label: (
          <span>
            <FileTextOutlined />
            服务请求
            {stats?.requestsByStatus?.pending ? (
              <Badge
                count={stats.requestsByStatus.pending}
                size="small"
                style={{ marginLeft: 6 }}
                overflowCount={99}
              />
            ) : null}
          </span>
        ),
        children: renderServiceRequests(),
      },
    ];

    if (selectedService) {
      items.push({
        key: 'service-detail',
        label: (
          <span>
            <EyeOutlined />
            服务详情
          </span>
        ),
        children: renderServiceDetail(),
      });
    }

    if (selectedRequest) {
      items.push({
        key: 'request-detail',
        label: (
          <span>
            <EyeOutlined />
            请求详情
          </span>
        ),
        children: renderRequestDetail(),
      });
    }

    return items;
  }, [
    services,
    filteredServices,
    requests,
    selectedService,
    selectedRequest,
    stats,
    servicesLoading,
    requestsLoading,
    serviceSearchQuery,
    serviceCategoryFilter,
    serviceStatusFilter,
    requestStatusFilter,
    requestPriorityFilter,
    actionLoading,
  ]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Layout>
      <div data-testid="service-catalog-page">
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
              服务目录
            </Title>
            <Text type="secondary">管理和浏览平台服务目录，提交服务请求</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadAll}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateService}>
              创建服务
            </Button>
          </Space>
        </div>

        {/* Stats bar */}
        {renderStatsBar()}

        {/* Main content tabs */}
        <Card
          style={{
            borderRadius: componentRadius.card,
            boxShadow: shadows.card,
          }}
          styles={{ body: { padding: spacing.lg } }}
        >
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key)}
            items={tabItems}
            destroyInactiveTabPane={false}
          />
        </Card>

        {/* Modals */}
        {renderServiceModal()}
        {renderRequestModal()}
      </div>
    </Layout>
  );
};

export default ServiceCatalog;
