/**
 * TicketDetail Page
 * - Top section: Back button, Ticket ID + Title, Status badge, Priority badge
 * - Action bar: Assign, Escalate, Resolve, Close, Transfer (contextual based on status)
 * - Left column (main): Description, Tags, SLA, Relations, Transfer history
 * - Right column (sidebar): Info card, Assignment, Workflow history, Escalation
 * - Uses mock data from mockTicketData.ts
 * - Ant Design: Card, Timeline, Tag, Badge, Button, Space, Descriptions, Progress, Modal, Form
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Badge,
  Card,
  Timeline,
  Descriptions,
  Progress,
  Modal,
  Form,
  Select,
  Input,
  message,
  Row,
  Col,
  Avatar,
  Result,
} from 'antd';
import {
  ArrowLeftOutlined,
  UserOutlined,
  SwapOutlined,
  ArrowUpOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LinkOutlined,
  HistoryOutlined,
  TagOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  getTicket,
  assignTicket,
  resolveTicket,
  closeTicket,
} from '@/api/ticketing';
import { mockEngineers, mockTicketHistory, mockTicketRelations, mockTransferHistory } from '@/pages/__mocks__/mockTicketData';
import TicketComments from './TicketComments';
import { colors, spacing } from '@/tokens';

// Local Ticket type definition
interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  source: string;
  reporter: string;
  assignee: string | null;
  tags: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  dueDate: string;
  escalationLevel: number;
}

const { Title, Text, Paragraph } = Typography;

// ============================================================================
// Helpers
// ============================================================================

const priorityConfig: Record<string, { color: string; label: string }> = {
  critical: { color: colors.error[400], label: '紧急' },
  high: { color: colors.warning[600], label: '高' },
  medium: { color: 'blue', label: '中' },
  low: { color: colors.neutral[400], label: '低' },
};

const statusConfig: Record<string, { color: string; label: string }> = {
  open: { color: 'default', label: '待处理' },
  assigned: { color: 'processing', label: '已分配' },
  'in-progress': { color: 'blue', label: '处理中' },
  resolved: { color: 'success', label: '已解决' },
  closed: { color: 'default', label: '已关闭' },
};

const categoryLabels: Record<string, string> = {
  infrastructure: '基础设施',
  application: '应用',
  database: '数据库',
  network: '网络',
  security: '安全',
  deployment: '部署',
  pipeline: '流水线',
  performance: '性能',
  cost: '成本',
  other: '其他',
};

const sourceLabels: Record<string, string> = {
  manual: '手动',
  alert: '告警',
  incident: '事件',
  api: 'API',
};

const relationTypeLabels: Record<string, string> = {
  duplicate: '重复',
  'caused-by': '导致于',
  related: '关联',
  blocks: '阻塞',
};

const relationTypeColors: Record<string, string> = {
  duplicate: 'volcano',
  'caused-by': 'magenta',
  related: 'cyan',
  blocks: 'orange',
};

function calculateSLA(ticket: Ticket): {
  percent: number;
  elapsed: string;
  total: string;
  status: 'normal' | 'warning' | 'danger';
  overdue: boolean;
} {
  const now = dayjs();
  const created = dayjs(ticket.createdAt);
  const due = dayjs(ticket.dueDate);
  const totalMs = due.diff(created);
  const elapsedMs = Math.max(0, now.diff(created));
  const remainingMs = due.diff(now);
  const percent = Math.min(100, Math.round((elapsedMs / totalMs) * 100));

  if (remainingMs <= 0) {
    return {
      percent: 100,
      elapsed: formatDuration(elapsedMs),
      total: formatDuration(totalMs),
      status: 'danger',
      overdue: true,
    };
  }

  const status: 'normal' | 'warning' | 'danger' =
    percent > 75 ? 'danger' : percent > 50 ? 'warning' : 'normal';

  return {
    percent,
    elapsed: formatDuration(elapsedMs),
    total: formatDuration(totalMs),
    status,
    overdue: false,
  };
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}小时${minutes}分`;
  return `${minutes}分钟`;
}

const slaStatusColors: Record<string, string> = {
  normal: colors.success[500],
  warning: colors.warning[500],
  danger: colors.error[400],
};

// ============================================================================
// TicketDetail Component
// ============================================================================

const TicketDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [escalateModalOpen, setEscalateModalOpen] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);

  const [assignForm] = Form.useForm();
  const [escalateForm] = Form.useForm();
  const [resolveForm] = Form.useForm();
  const [transferForm] = Form.useForm();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [_loading, setLoading] = useState(false);

  // Load ticket from API
  useEffect(() => {
    if (id) loadTicket();
  }, [id]);

  const loadTicket = async () => {
    setLoading(true);
    try {
      const response = await getTicket(id!);
      setTicket((response as any).data?.data || null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        message.error(`加载工单详情失败：${err.message}`);
      } else {
        message.error('加载工单详情失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const history = useMemo(
    () => (id ? mockTicketHistory[id] || [] : []),
    [id]
  );

  const relations = useMemo(
    () => (id ? mockTicketRelations.filter((r) => r.ticketId === id) : []),
    [id]
  );

  const transfers = useMemo(
    () => (id ? mockTransferHistory.filter((t) => t.ticketId === id) : []),
    [id]
  );

  const sla = useMemo(() => (ticket ? calculateSLA(ticket) : null), [ticket]);

  if (!ticket) {
    return (
      <Result
        status="404"
        title="工单不存在"
        subTitle={`未找到工单 ${id}`}
        extra={
          <Button type="primary" onClick={() => navigate('/tickets')}>
            返回工单列表
          </Button>
        }
        data-testid="ticket-not-found"
      />
    );
  }

  const pConfig = priorityConfig[ticket.priority] || { color: 'default', label: ticket.priority };
  const sConfig = statusConfig[ticket.status] || { color: 'default', label: ticket.status };

  // Determine which actions are available based on status
  const canAssign = ticket.status === 'open';
  const canEscalate = ticket.status !== 'closed' && ticket.status !== 'resolved';
  const canResolve = ticket.status === 'in-progress' || ticket.status === 'assigned';
  const canClose = ticket.status === 'resolved';
  const canTransfer = ticket.status === 'assigned' || ticket.status === 'in-progress';

  // Action handlers
  const handleAssign = async () => {
    try {
      const values = await assignForm.validateFields();
      await assignTicket(ticket!.id, { assignee: values.assignee, assignedBy: 'current-user', reason: values.reason });
      message.success(`工单已分配给 ${values.assignee}`);
      setAssignModalOpen(false);
      assignForm.resetFields();
      loadTicket();
    } catch (error: unknown) {
      if (error !== true) {
        if (error instanceof Error) {
          message.error(`分配失败：${error.message}`);
        } else {
          message.error('分配失败，请稍后重试');
        }
      }
    }
  };

  const handleEscalate = async () => {
    try {
      const values = await escalateForm.validateFields();
      message.success(`工单已升级: ${values.reason || '无理由'}`);
      setEscalateModalOpen(false);
      escalateForm.resetFields();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`升级失败：${error.message}`);
        } else {
          message.error('升级失败');
        }
      }
    }
  };

  const handleResolve = async () => {
    try {
      const values = await resolveForm.validateFields();
      await resolveTicket(ticket!.id, {
        performedBy: 'current-user',
        resolutionNote: values.resolutionNote,
      });
      message.success('工单已标记为已解决');
      setResolveModalOpen(false);
      resolveForm.resetFields();
      loadTicket();
    } catch (error: unknown) {
      if (error !== true) {
        if (error instanceof Error) {
          message.error(`解决失败：${error.message}`);
        } else {
          message.error('解决失败，请稍后重试');
        }
      }
    }
  };

  const handleTransfer = async () => {
    try {
      const values = await transferForm.validateFields();
      await assignTicket(ticket!.id, {
        assignee: values.toEngineer,
        assignedBy: 'current-user',
        reason: values.reason,
      });
      message.success(`工单已转交给 ${values.toEngineer}`);
      setTransferModalOpen(false);
      transferForm.resetFields();
      loadTicket();
    } catch (error: unknown) {
      if (error !== true) {
        if (error instanceof Error) {
          message.error(`转交失败：${error.message}`);
        } else {
          message.error('转交失败，请稍后重试');
        }
      }
    }
  };

  const handleClose = async () => {
    try {
      await closeTicket(ticket!.id, { performedBy: 'current-user' });
      message.success('工单已关闭');
      loadTicket();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`关闭失败：${error.message}`);
      } else {
        message.error('关闭失败，请稍后重试');
      }
    }
  };

  const historyActionLabels: Record<string, string> = {
    created: '创建工单',
    assigned: '分配工单',
    transitioned: '状态变更',
    escalated: '升级工单',
    resolved: '解决工单',
    closed: '关闭工单',
  };

  return (
    <div style={{ padding: 0 }} data-testid="ticket-detail-page">
      {/* Top section: Back, Title, Badges */}
      <div style={{ marginBottom: 16 }}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/tickets')}
          style={{ padding: 0, marginBottom: 8 }}
          data-testid="back-to-tickets"
        >
          返回工单列表
        </Button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Title level={3} style={{ margin: 0 }}>
            {ticket.id}
          </Title>
          <Badge status={sConfig.color as any} text={sConfig.label} />
          <Tag color={pConfig.color} style={{ fontWeight: 500, padding: '2px 12px' }}>
            {pConfig.label}
          </Tag>
        </div>
        <Title level={4} style={{ margin: '8px 0 0', fontWeight: 'normal', color: colors.neutral[600] }}>
          {ticket.title}
        </Title>
      </div>

      {/* Action bar */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          {canAssign && (
            <Button
              type="primary"
              icon={<UserOutlined />}
              onClick={() => setAssignModalOpen(true)}
              data-testid="action-assign"
            >
              分配
            </Button>
          )}
          {canEscalate && (
            <Button
              icon={<ArrowUpOutlined />}
              danger={ticket.escalationLevel >= 2}
              onClick={() => setEscalateModalOpen(true)}
              data-testid="action-escalate"
            >
              升级 {ticket.escalationLevel > 0 && `(L${ticket.escalationLevel})`}
            </Button>
          )}
          {canResolve && (
            <Button
              icon={<CheckCircleOutlined />}
              onClick={() => setResolveModalOpen(true)}
              data-testid="action-resolve"
            >
              解决
            </Button>
          )}
          {canClose && (
            <Button
              icon={<CloseCircleOutlined />}
              onClick={handleClose}
              data-testid="action-close"
            >
              关闭
            </Button>
          )}
          {canTransfer && (
            <Button
              icon={<SwapOutlined />}
              onClick={() => setTransferModalOpen(true)}
              data-testid="action-transfer"
            >
              转交
            </Button>
          )}
        </Space>
      </Card>

      {/* Two-column layout */}
      <Row gutter={24}>
        {/* Left column (main) */}
        <Col span={16}>
          {/* Description */}
          <Card title="工单描述" size="small" style={{ marginBottom: 16 }}>
            <Paragraph>{ticket.description}</Paragraph>
          </Card>

          {/* Tags */}
          <Card
            title={
              <Space>
                <TagOutlined />
                标签
              </Space>
            }
            size="small"
            style={{ marginBottom: 16 }}
          >
            <Space wrap>
              {Object.entries(ticket.tags).map(([key, value]) => (
                <Tag key={key} color="blue">
                  {key}: {value}
                </Tag>
              ))}
            </Space>
          </Card>

          {/* SLA section */}
          {sla && (
            <Card title="SLA 信息" size="small" style={{ marginBottom: 16 }} data-testid="sla-section">
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text>已用时间: {sla.elapsed}</Text>
                  <Text>总时限: {sla.total}</Text>
                </div>
                <Progress
                  percent={sla.percent}
                  strokeColor={slaStatusColors[sla.status]}
                  status={sla.status === 'danger' ? 'exception' : 'normal'}
                />
              </div>
              <Descriptions size="small" column={2}>
                <Descriptions.Item label="创建时间">
                  {dayjs(ticket.createdAt).format('YYYY-MM-DD HH:mm')}
                </Descriptions.Item>
                <Descriptions.Item label="SLA 截止">
                  {dayjs(ticket.dueDate).format('YYYY-MM-DD HH:mm')}
                </Descriptions.Item>
                <Descriptions.Item label="SLA 状态">
                  <Tag color={slaStatusColors[sla.status]}>
                    {sla.overdue ? '已超时' : sla.status === 'danger' ? '高风险' : sla.status === 'warning' ? '警告' : '正常'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="升级级别">
                  {ticket.escalationLevel > 0 ? `L${ticket.escalationLevel}` : '无'}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}

          {/* Comments and Notes */}
          <TicketComments ticketId={ticket.id} />

          {/* Relations */}
          {relations.length > 0 && (
            <Card
              title={
                <Space>
                  <LinkOutlined />
                  关联工单
                </Space>
              }
              size="small"
              style={{ marginBottom: 16 }}
            >
              {relations.map((rel) => (
                <div
                  key={rel.relationId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 0',
                    borderBottom: `1px solid ${colors.light.border.light}`,
                  }}
                >
                  <Tag color={relationTypeColors[rel.relationType]}>
                    {relationTypeLabels[rel.relationType]}
                  </Tag>
                  <Text
                    strong
                    style={{ cursor: 'pointer', color: colors.primary[500] }}
                    onClick={() => navigate(`/tickets/${rel.relatedTicketId}`)}
                  >
                    {rel.relatedTicketId}
                  </Text>
                  <Text type="secondary" ellipsis style={{ maxWidth: 300 }}>
                    {rel.relatedTicketTitle}
                  </Text>
                </div>
              ))}
            </Card>
          )}

          {/* Transfer history */}
          {transfers.length > 0 && (
            <Card
              title={
                <Space>
                  <SwapOutlined />
                  转交历史
                </Space>
              }
              size="small"
              style={{ marginBottom: 16 }}
            >
              {transfers.map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 0',
                    borderBottom: `1px solid ${colors.light.border.light}`,
                  }}
                >
                  <Avatar size="small">{t.fromEngineer[0]}</Avatar>
                  <Text>{t.fromEngineer}</Text>
                  <SwapOutlined />
                  <Avatar size="small" style={{ background: colors.primary[500] }}>
                    {t.toEngineer[0]}
                  </Avatar>
                  <Text>{t.toEngineer}</Text>
                  <Text type="secondary" style={{ marginLeft: 'auto' }}>
                    {t.reason}
                  </Text>
                  <Text type="secondary" style={{ fontSize: spacing[3] }}>
                    {dayjs(t.timestamp).format('MM-DD HH:mm')}
                  </Text>
                </div>
              ))}
            </Card>
          )}
        </Col>

        {/* Right column (sidebar) */}
        <Col span={8}>
          {/* Info card */}
          <Card title="基本信息" size="small" style={{ marginBottom: 16 }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="分类">
                {categoryLabels[ticket.category] || ticket.category}
              </Descriptions.Item>
              <Descriptions.Item label="优先级">
                <Tag color={pConfig.color}>{pConfig.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="来源">
                {sourceLabels[ticket.source] || ticket.source}
              </Descriptions.Item>
              <Descriptions.Item label="报告人">{ticket.reporter}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(ticket.createdAt).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {dayjs(ticket.updatedAt).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="截止时间">
                {dayjs(ticket.dueDate).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Assignment card */}
          <Card title="负责人" size="small" style={{ marginBottom: 16 }}>
            {ticket.assignee ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  <Avatar style={{ background: colors.primary[500] }}>
                    {ticket.assignee[0]}
                  </Avatar>
                  <Text strong>{ticket.assignee}</Text>
                </Space>
              </Space>
            ) : (
              <Text type="secondary">
                <UserOutlined /> 未分配
              </Text>
            )}
          </Card>

          {/* Escalation info */}
          {ticket.escalationLevel > 0 && (
            <Card title="升级信息" size="small" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ExclamationCircleOutlined style={{ color: colors.error[400] }} />
                  <Text strong>当前级别: L{ticket.escalationLevel}</Text>
                </div>
                {Array.from({ length: ticket.escalationLevel }).map((_, i) => (
                  <Tag key={i} color={i === ticket.escalationLevel - 1 ? 'red' : 'orange'}>
                    升级 {i + 1}
                  </Tag>
                ))}
              </Space>
            </Card>
          )}

          {/* Workflow history */}
          <Card
            title={
              <Space>
                <HistoryOutlined />
                工作流历史
              </Space>
            }
            size="small"
          >
            <Timeline
              items={history.map((entry) => ({
                color:
                  entry.action === 'created'
                    ? 'green'
                    : entry.action === 'resolved'
                    ? 'blue'
                    : entry.action === 'escalated'
                    ? 'red'
                    : 'gray',
                children: (
                  <div>
                    <Text strong>{historyActionLabels[entry.action] || entry.action}</Text>
                    {entry.fromStatus && entry.toStatus && (
                      <Text type="secondary">
                        {' '}
                        {statusConfig[entry.fromStatus]?.label || entry.fromStatus} →{' '}
                        {statusConfig[entry.toStatus]?.label || entry.toStatus}
                      </Text>
                    )}
                    {entry.reason && (
                      <div>
                        <Text type="secondary" style={{ fontSize: spacing[3] }}>
                          {entry.reason}
                        </Text>
                      </div>
                    )}
                    <div>
                      <Text type="secondary" style={{ fontSize: spacing[3] }}>
                        {entry.performedBy} · {dayjs(entry.timestamp).format('MM-DD HH:mm')}
                      </Text>
                    </div>
                  </div>
                ),
              }))}
            />
            {history.length === 0 && (
              <Text type="secondary">暂无历史记录</Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* ---- Modals ---- */}

      {/* Assign Modal */}
      <Modal
        title="分配工单"
        open={assignModalOpen}
        onCancel={() => { setAssignModalOpen(false); assignForm.resetFields(); }}
        onOk={handleAssign}
        okText="确认分配"
        cancelText="取消"
      >
        <Form form={assignForm} layout="vertical">
          <Form.Item
            label="选择工程师"
            name="assignee"
            rules={[{ required: true, message: '请选择工程师' }]}
          >
            <Select placeholder="选择工程师">
              {mockEngineers.map((e) => (
                <Select.Option key={e.id} value={e.name}>
                  {e.name} ({e.availability === 'available' ? '可用' : e.availability === 'busy' ? '忙碌' : '离开'})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="分配理由" name="reason">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Escalate Modal */}
      <Modal
        title="升级工单"
        open={escalateModalOpen}
        onCancel={() => { setEscalateModalOpen(false); escalateForm.resetFields(); }}
        onOk={handleEscalate}
        okText="确认升级"
        cancelText="取消"
      >
        <Form form={escalateForm} layout="vertical">
          <Form.Item
            label="升级理由"
            name="reason"
            rules={[{ required: true, message: '请输入升级理由' }]}
          >
            <Input.TextArea rows={3} placeholder="请说明升级原因" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Resolve Modal */}
      <Modal
        title="解决工单"
        open={resolveModalOpen}
        onCancel={() => { setResolveModalOpen(false); resolveForm.resetFields(); }}
        onOk={handleResolve}
        okText="确认解决"
        cancelText="取消"
      >
        <Form form={resolveForm} layout="vertical">
          <Form.Item label="解决方案" name="resolutionNote">
            <Input.TextArea rows={4} placeholder="请描述解决方案" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Transfer Modal */}
      <Modal
        title="转交工单"
        open={transferModalOpen}
        onCancel={() => { setTransferModalOpen(false); transferForm.resetFields(); }}
        onOk={handleTransfer}
        okText="确认转交"
        cancelText="取消"
      >
        <Form form={transferForm} layout="vertical">
          <Form.Item
            label="转交给"
            name="toEngineer"
            rules={[{ required: true, message: '请选择接收人' }]}
          >
            <Select placeholder="选择工程师">
              {mockEngineers.map((e) => (
                <Select.Option key={e.id} value={e.name}>
                  {e.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="转交理由"
            name="reason"
            rules={[{ required: true, message: '请输入转交理由' }]}
          >
            <Input.TextArea rows={2} placeholder="请说明转交原因" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TicketDetail;
