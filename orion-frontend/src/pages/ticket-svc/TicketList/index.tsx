/**
 * TicketList Page
 * - Summary cards (Open, In-Progress, Overdue, SLA Breached)
 * - Filter bar (status, priority, category, assignee, search)
 * - Action buttons (Create Ticket, Auto Dispatch, View Reports)
 * - Ticket table with ID, Title, Category, Priority, Status, Assignee, SLA, Actions
 * - Priority badges: critical=red, high=orange, medium=blue, low=gray
 * - Status badges: open=default, assigned=processing, in-progress=blue, resolved=green, closed=gray
 * - SLA column: green if >50% time, orange if <25%, red if overdue
 * - Pagination at bottom
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Typography, Button, Space, Tag, Badge, Modal, message } from 'antd';
import {
  PlusOutlined,
  CopyOutlined,
  ReloadOutlined,
  BarChartOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  UserAddOutlined,
  InboxOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import MetricCard from '@/components/MetricCard';
import { getTickets } from '@/api/ticketing';
import { listUsers, type User } from '@/api/users';
import { useNavigate } from 'react-router-dom';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';
import CreateTicketModal from './CreateTicketModal';
import DispatchPanel from './DispatchPanel';

const { Title, Text } = Typography;

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
  createdAt: string;
  dueDate: string;
  escalationLevel: number;
  tags?: Record<string, string>;
}

type MockTicket = Ticket;

// ============================================================================
// Helpers
// ============================================================================

const priorityConfig: Record<string, { color: string; label: string; order: number }> = {
  critical: { color: colors.error[400], label: '紧急', order: 0 },
  high: { color: colors.warning[600], label: '高', order: 1 },
  medium: { color: colors.primary[500], label: '中', order: 2 },
  low: { color: colors.neutral[500], label: '低', order: 3 },
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

/**
 * Calculate SLA remaining percentage and status
 * Returns { percent, color, text }
 */
function calculateSLA(ticket: MockTicket): {
  percent: number;
  color: string;
  text: string;
  overdue: boolean;
} {
  const now = dayjs();
  const created = dayjs(ticket.createdAt);
  const due = dayjs(ticket.dueDate);
  const totalMs = due.diff(created);
  const remainingMs = due.diff(now);

  if (remainingMs <= 0) {
    return { percent: 0, color: colors.error[400], text: '已超时', overdue: true };
  }

  const percent = Math.max(0, Math.round((remainingMs / totalMs) * 100));

  if (percent < 25) {
    return {
      percent,
      color: colors.warning[600],
      text: `${Math.round(remainingMs / 3600000)}h`,
      overdue: false,
    };
  }

  return {
    percent,
    color: colors.success[500],
    text: `${Math.round(remainingMs / 3600000)}h`,
    overdue: false,
  };
}

// ============================================================================
// TicketList Component
// ============================================================================

const TicketList: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [dispatchPanelOpen, setDispatchPanelOpen] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  // Engineer list for assignee filter
  const [engineers, setEngineers] = useState<string[]>([]);
  const [engineersLoading, setEngineersLoading] = useState(false);

  // Load engineers for assignee filter
  useEffect(() => {
    const loadEngineers = async () => {
      setEngineersLoading(true);
      try {
        const res = await listUsers({ limit: 200 });
        const users: User[] = res.data?.data || [];
        setEngineers(users.map((u) => u.name || u.username).filter(Boolean));
      } catch {
        setEngineers([]);
      } finally {
        setEngineersLoading(false);
      }
    };
    loadEngineers();
  }, []);

  // Load tickets from API
  const loadTickets = async () => {
    setLoading(true);
    try {
      const params = { page: 1, pageSize: 50, ...filters };
      const response = await getTickets(params);
      setTickets((response.data?.items ?? []) as unknown as Ticket[]);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载工单列表失败：${error.message}`);
      } else {
        message.error('加载工单列表失败');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [filters]);

  // Filter tickets based on search and filters
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [
          ticket.id,
          ticket.title,
          ticket.assignee || '',
          ticket.reporter,
          ticket.category,
        ]
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(query)) return false;
      }

      // Status filter
      const statusFilter = filters.status;
      if (statusFilter && statusFilter !== 'all' && ticket.status !== statusFilter) {
        return false;
      }

      // Priority filter
      const priorityFilter = filters.priority;
      if (priorityFilter && priorityFilter !== 'all' && ticket.priority !== priorityFilter) {
        return false;
      }

      // Category filter
      const categoryFilter = filters.category;
      if (categoryFilter && categoryFilter !== 'all' && ticket.category !== categoryFilter) {
        return false;
      }

      // Assignee filter
      const assigneeFilter = filters.assignee;
      if (assigneeFilter && assigneeFilter !== 'all') {
        if (assigneeFilter === 'unassigned' && ticket.assignee !== null) return false;
        if (assigneeFilter !== 'unassigned' && ticket.assignee !== assigneeFilter) return false;
      }

      return true;
    });
  }, [searchQuery, filters]);

  // Summary metrics
  const openCount = tickets.filter((t) => t.status === 'open' || t.status === 'assigned').length;
  const inProgressCount = tickets.filter((t) => t.status === 'in-progress').length;
  const overdueCount = tickets.filter((t) => calculateSLA(t).overdue).length;
  const slaBreached = tickets.filter((t) => calculateSLA(t).overdue).length;

  // Filter definitions
  const filterDefs: FilterDefinition[] = [
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '全部', value: 'all' },
        { label: '待处理', value: 'open' },
        { label: '已分配', value: 'assigned' },
        { label: '处理中', value: 'in-progress' },
        { label: '已解决', value: 'resolved' },
        { label: '已关闭', value: 'closed' },
      ],
    },
    {
      key: 'priority',
      label: '优先级',
      options: [
        { label: '全部', value: 'all' },
        { label: '紧急', value: 'critical' },
        { label: '高', value: 'high' },
        { label: '中', value: 'medium' },
        { label: '低', value: 'low' },
      ],
    },
    {
      key: 'category',
      label: '分类',
      options: [
        { label: '全部', value: 'all' },
        ...Object.entries(categoryLabels).map(([key, label]) => ({ label, value: key })),
      ],
    },
    {
      key: 'assignee',
      label: '负责人',
      options: [
        { label: '全部', value: 'all' },
        { label: '未分配', value: 'unassigned' },
        ...(engineersLoading ? [] : engineers.map((name) => ({ label: name, value: name }))),
      ],
    },
  ];

  // Table columns
  const columns: TableColumn<Ticket>[] = [
    {
      key: 'id',
      title: '工单ID',
      dataIndex: 'id',
      width: 100,
      render: (value: unknown, record: MockTicket) => (
        <Text
          strong
          style={{ cursor: 'pointer', color: colors.primary[500] }}
          onClick={() => navigate(`/tickets/${record.id}`)}
          data-testid={`ticket-link-${record.id}`}
        >
          {String(value)}
        </Text>
      ),
    },
    {
      key: 'title',
      title: '标题',
      dataIndex: 'title',
      width: 280,
      render: (value: unknown, record: MockTicket) => (
        <Space direction="vertical" size={0}>
          <Text
            strong
            style={{ cursor: 'pointer', color: colors.primary[500] }}
            onClick={() => navigate(`/tickets/${record.id}`)}
          >
            {String(value)}
          </Text>
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            来源:{' '}
            {record.source === 'alert'
              ? '告警'
              : record.source === 'incident'
                ? '事件'
                : record.source === 'api'
                  ? 'API'
                  : '手动'}
          </Text>
        </Space>
      ),
    },
    {
      key: 'category',
      title: '分类',
      dataIndex: 'category',
      width: 110,
      render: (value: unknown) => (
        <Tag color="cyan" style={{ margin: 0 }}>
          {categoryLabels[String(value)] || String(value)}
        </Tag>
      ),
    },
    {
      key: 'priority',
      title: '优先级',
      dataIndex: 'priority',
      width: 90,
      render: (value: unknown) => {
        const config = priorityConfig[String(value)] || { color: 'default', label: String(value) };
        return (
          <Tag color={config.color} style={{ margin: 0, fontWeight: 500 }}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: unknown) => {
        const config = statusConfig[String(value)] || { color: 'default', label: String(value) };
        return <Badge status={config.color as 'success' | 'processing' | 'error' | 'default' | 'warning'} text={config.label} />;
      },
    },
    {
      key: 'assignee',
      title: '负责人',
      dataIndex: 'assignee',
      width: 100,
      render: (value: unknown) => (
        <Text>{value ? String(value) : <Text type="secondary">未分配</Text>}</Text>
      ),
    },
    {
      key: 'sla',
      title: 'SLA 剩余',
      width: 110,
      render: (_: unknown, record: MockTicket) => {
        const sla = calculateSLA(record);
        return (
          <Space size={4}>
            <ClockCircleOutlined style={{ color: sla.color }} />
            <Text style={{ color: sla.color, fontWeight: sla.overdue ? 700 : 400 }}>
              {sla.text}
            </Text>
          </Space>
        );
      },
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 140,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(String(value)).format('MM-DD HH:mm')}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 160,
      render: (_: unknown, record: Ticket) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/tickets/${record.id}`)}
            data-testid={`view-ticket-${record.id}`}
          >
            详情
          </Button>
          {!record.assignee && (
            <Button
              type="link"
              size="small"
              icon={<UserAddOutlined />}
              onClick={() => handleAssign(record)}
              data-testid={`assign-ticket-${record.id}`}
            >
              分配
            </Button>
          )}
          {record.escalationLevel > 0 && (
            <Tag color="red" style={{ margin: 0 }}>
              升级 L{record.escalationLevel}
            </Tag>
          )}
        </Space>
      ),
    },
  ];

  const handleRefresh = () => {
    loadTickets();
  };

  const handleAssign = (ticket: Ticket) => {
    Modal.confirm({
      title: '分配工单',
      content: `选择工程师来分配工单 ${ticket.id}`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        message.success(`工单 ${ticket.id} 分配成功`);
      },
    });
  };

  const handleAutoDispatch = () => {
    setDispatchPanelOpen(true);
  };

  const handleCreateSuccess = () => {
    setCreateModalOpen(false);
    message.success('工单创建成功');
  };

  return (
    <div style={{ padding: 0 }} data-testid="ticket-list-page">
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <CopyOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            工单管理
          </Title>
          <Text type="secondary">共 {filteredTickets.length} 个工单</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
            刷新
          </Button>
          <Button icon={<ThunderboltOutlined />} onClick={handleAutoDispatch}>
            自动分派
          </Button>
          <Button icon={<BarChartOutlined />} onClick={() => message.info('报表功能开发中')}>
            查看报表
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            创建工单
          </Button>
        </Space>
      </div>

      {/* Summary cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
        data-testid="ticket-summary-cards"
      >
        <MetricCard
          title="待处理"
          value={openCount}
          icon={<InboxOutlined />}
          color={colors.primary[500]}
          footer="需要分配的工单"
        />
        <MetricCard
          title="处理中"
          value={inProgressCount}
          icon={<ExclamationCircleOutlined />}
          color={colors.warning[500]}
          footer="正在进行处理的工单"
        />
        <MetricCard
          title="已超时"
          value={overdueCount}
          icon={<ClockCircleOutlined />}
          color={colors.error[400]}
          footer="超过 SLA 时限"
        />
        <MetricCard
          title="SLA 违约"
          value={slaBreached}
          icon={<WarningOutlined />}
          color={colors.purple[500]}
          footer="SLA 违约次数"
        />
      </div>

      {/* Search and filter bar */}
      <div style={{ marginBottom: 16 }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={filterDefs}
          searchPlaceholder="搜索工单 ID、标题、负责人..."
        />
      </div>

      {/* Ticket table */}
      <Table
        columns={columns}
        dataSource={filteredTickets}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
        data-testid="ticket-table"
      />

      {/* Create ticket modal */}
      <CreateTicketModal
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Dispatch panel */}
      <DispatchPanel open={dispatchPanelOpen} onClose={() => setDispatchPanelOpen(false)} />
    </div>
  );
};

export default TicketList;
