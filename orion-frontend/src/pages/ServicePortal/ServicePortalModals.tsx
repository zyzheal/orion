/**
 * ITSM Self-Service Portal — sub-components and modals
 *
 * Extracted from index.tsx:
 * - ServicePortalHeader      : 页面标题 + 全局刷新
 * - SummaryCards             : 我的工单 / 待审批 / 已完成 统计卡
 * - ServiceCatalogView       : 服务目录（分类筛选 + 服务卡片网格）
 * - MyTicketsView            : 我的工单列表（状态筛选 + 表格）
 * - TicketDetailView         : 工单详情（描述、表单数据、状态历史）
 * - RequestModal             : 提交服务请求弹窗
 * - DynamicServiceFields     : 按服务 form_schema 渲染动态表单字段
 */
import React from 'react';
import type { FormProps, ModalProps } from 'antd';
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
  Row,
  Col,
  Empty,
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
  StopOutlined,
  ArrowLeftOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { colors, spacing, componentRadius, shadows } from '@/tokens';
import type { ServiceCategory, ServiceItem, SelfServiceTicket } from '@/api/self-service';
import {
  CATEGORY_ICONS,
  PRIORITY_CONFIG,
  TICKET_STATUS_CONFIG,
  SERVICE_STATUS_CONFIG,
  PRIORITY_OPTIONS,
  DEFAULT_REQUEST_VALUES,
} from './config';
import { getTicketColumns } from './columns';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// 供页面主文件复用的排版组件
export { Title, Text, Paragraph };

/** 未匹配到配置时的回退标签配置 */
const DEFAULT_TAG_CONFIG: { color: string; label: string } = {
  color: 'default',
  label: '',
};

/** 状态/优先级值 → 标签配置（含回退） */
function tagConfig(config: Record<string, { color: string; label: string }>, value: string) {
  return config[value] || { color: DEFAULT_TAG_CONFIG.color, label: value };
}

// ============================================================================
// Page Header
// ============================================================================

export interface ServicePortalHeaderProps {
  onRefresh: () => void;
}

export function ServicePortalHeader({ onRefresh }: ServicePortalHeaderProps) {
  return (
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
        <Button icon={<ReloadOutlined />} onClick={onRefresh}>
          刷新
        </Button>
      </Space>
    </div>
  );
}

// ============================================================================
// Summary Cards
// ============================================================================

export interface SummaryCardsProps {
  ticketsCount: number;
  pendingCount: number;
  fulfilledCount: number;
}

export function SummaryCards({ ticketsCount, pendingCount, fulfilledCount }: SummaryCardsProps) {
  return (
    <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.lg }}>
      <Col xs={24} sm={8}>
        <Card
          size="small"
          style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
          styles={{ body: { padding: spacing.lg } }}
        >
          <Statistic
            title="我的工单"
            value={ticketsCount}
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
            prefix={<ClockCircleOutlined style={{ color: colors.warning[500] }} />}
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
            prefix={<CheckCircleOutlined style={{ color: colors.success[500] }} />}
          />
        </Card>
      </Col>
    </Row>
  );
}

// ============================================================================
// Service Catalog
// ============================================================================

export interface ServiceCatalogViewProps {
  categories: ServiceCategory[];
  services: ServiceItem[];
  loading: boolean;
  selectedCategory?: string;
  onSelectCategory: (value: string | undefined) => void;
  onRefresh: () => void;
  onRequestService: (service: ServiceItem) => void;
}

export function ServiceCatalogView({
  categories,
  services,
  loading,
  selectedCategory,
  onSelectCategory,
  onRefresh,
  onRequestService,
}: ServiceCatalogViewProps) {
  return (
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
          onChange={(v) => onSelectCategory(v)}
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
        <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
          刷新
        </Button>
      </div>

      {/* Services grid */}
      {services.length === 0 && !loading ? (
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
                        onClick={() => onRequestService(service)}
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
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Tag
                      color={SERVICE_STATUS_CONFIG[service.status]?.color || 'default'}
                      style={{ margin: 0, borderRadius: componentRadius.tag }}
                    >
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
}

// ============================================================================
// My Tickets List
// ============================================================================

export interface MyTicketsViewProps {
  filteredTickets: SelfServiceTicket[];
  loading: boolean;
  statusFilter?: string;
  onStatusFilterChange: (value: string | undefined) => void;
  onRefresh: () => void;
  handleViewTicket: (ticket: SelfServiceTicket) => void;
  handleCancelTicket: (ticket: SelfServiceTicket) => void;
  actionLoading: string | null;
}

export function MyTicketsView({
  filteredTickets,
  loading,
  statusFilter,
  onStatusFilterChange,
  onRefresh,
  handleViewTicket,
  handleCancelTicket,
  actionLoading,
}: MyTicketsViewProps) {
  const columns = getTicketColumns({
    handleViewTicket,
    handleCancelTicket,
    actionLoading,
    filteredTickets,
  });

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
          value={statusFilter}
          onChange={(v) => onStatusFilterChange(v)}
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
        <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
          刷新
        </Button>
      </div>

      {filteredTickets.length === 0 && !loading ? (
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
            loading={loading}
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
}

// ============================================================================
// Ticket Detail
// ============================================================================

export interface TicketDetailViewProps {
  ticket: SelfServiceTicket | null;
  actionLoading: string | null;
  onBack: () => void;
  handleCancelTicket: (ticket: SelfServiceTicket) => void;
}

export function TicketDetailView({
  ticket: selectedTicket,
  actionLoading,
  onBack,
  handleCancelTicket,
}: TicketDetailViewProps) {
  if (!selectedTicket) {
    return <Empty description="未选择工单" />;
  }

  const statusCfg = tagConfig(TICKET_STATUS_CONFIG, selectedTicket.status);
  const priorityCfg = tagConfig(PRIORITY_CONFIG, selectedTicket.priority);
  const canCancel = selectedTicket.status === 'pending' || selectedTicket.status === 'approved';

  return (
    <div>
      {/* Back + Actions header */}
      <div
        style={
          {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.lg,
          } as const
        }
      >
        <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
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
              <Button
                danger
                icon={<StopOutlined />}
                loading={actionLoading === `cancel-${selectedTicket.id}`}
              >
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
        styles={
          {
            body: { padding: spacing.lg },
          } as const
        }
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
          <Descriptions.Item label="关联服务">
            {selectedTicket.service_name || selectedTicket.id}
          </Descriptions.Item>
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
              style={{ background: colors.neutral[50], borderRadius: componentRadius.card }}
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
                            {dayjs(
                              selectedTicket.cancelled_at || selectedTicket.updated_at
                            ).format('YYYY-MM-DD HH:mm:ss')}
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
}

// ============================================================================
// Request Modal
// ============================================================================

export interface RequestModalProps {
  service: ServiceItem | null;
  open: boolean;
  form: FormProps['form'];
  submitting: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

export function RequestModal({
  service: selectedService,
  open,
  form: requestForm,
  submitting,
  onSubmit,
  onClose,
}: RequestModalProps) {
  const modalProps: Omit<ModalProps, 'open'> = {
    title: `提交请求: ${selectedService?.name || ''}`,
    onOk: onSubmit,
    onCancel: onClose,
    confirmLoading: submitting,
    okText: '提交请求',
    cancelText: '取消',
    width: 600,
    destroyOnClose: true,
  };

  return (
    <Modal open={open} {...modalProps}>
      <Form
        form={requestForm}
        layout="vertical"
        style={{ marginTop: spacing.md }}
        initialValues={DEFAULT_REQUEST_VALUES}
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
            {PRIORITY_OPTIONS.map((opt) => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Select>
        </Form.Item>

        {/* Dynamic fields from service form_schema */}
        {selectedService?.form_schema && <DynamicServiceFields schema={selectedService.form_schema} />}
      </Form>
    </Modal>
  );
}

// ============================================================================
// Dynamic Form Fields
// ============================================================================

export interface DynamicServiceFieldsProps {
  schema: unknown;
}

/** 按服务 form_schema 渲染动态表单字段（需渲染在 <Form> 内部） */
export function DynamicServiceFields({ schema }: DynamicServiceFieldsProps) {
  if (!schema || typeof schema !== 'object') return null;

  const fields = (schema as { fields?: unknown }).fields || schema;
  if (!Array.isArray(fields)) return null;

  return fields.map((field: any) => {
    const fieldName = field.name || field.key;
    const fieldLabel = field.label || fieldName;
    const fieldType = field.type || 'text';
    const required = field.required || false;

    const rules = required
      ? [{ required: true, message: `请输入${fieldLabel}` }]
      : undefined;

    if (fieldType === 'textarea') {
      return (
        <Form.Item
          key={fieldName}
          name={fieldName}
          label={fieldLabel}
          rules={rules}
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
          rules={rules}
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
          rules={rules}
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
        rules={rules}
      >
        <Input placeholder={field.placeholder || `请输入${fieldLabel}`} />
      </Form.Item>
    );
  });
}
