/**
 * EventBus Monitoring Page
 * Event bus status monitoring and event stream visualization
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography, Button, Space, Tag, Card, Alert, Select, Input, Tooltip, Drawer,
  Descriptions, message,
} from 'antd';
import {
  ReloadOutlined, FilterOutlined, ClockCircleOutlined, CheckCircleOutlined,
  CloseCircleOutlined, WarningOutlined, SwapOutlined, InfoCircleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import MetricCard from '@/components/MetricCard';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// ---- Types ----

interface EventBusEvent {
  id: string;
  eventType: string;
  source: string;
  timestamp: string;
  status: 'delivered' | 'failed' | 'pending' | 'retried';
  payloadSize: number;
  subscriberCount: number;
  topic: string;
  traceId: string;
}

interface EventBusStats {
  totalEvents: number;
  activeSubscribers: number;
  failedEvents: number;
  eventRate: number;
}

type EventStatus = EventBusEvent['status'];

// ---- Color maps ----

const statusColorMap: Record<EventStatus, string> = {
  delivered: 'success',
  failed: 'error',
  pending: 'processing',
  retried: 'warning',
};

const statusLabelMap: Record<EventStatus, string> = {
  delivered: '已投递',
  failed: '失败',
  pending: '待处理',
  retried: '重试中',
};

const statusIconMap: Record<EventStatus, React.ReactNode> = {
  delivered: <CheckCircleOutlined />,
  failed: <CloseCircleOutlined />,
  pending: <ClockCircleOutlined />,
  retried: <SwapOutlined />,
};

// ---- Mock data ----

const MOCK_STATS: EventBusStats = {
  totalEvents: 15842,
  activeSubscribers: 23,
  failedEvents: 47,
  eventRate: 128,
};

const MOCK_EVENTS: EventBusEvent[] = [
  {
    id: 'evt-001', eventType: 'pipeline.run.completed', source: 'pipeline-engine',
    timestamp: '2024-03-20T10:30:00Z', status: 'delivered', payloadSize: 2048,
    subscriberCount: 3, topic: 'pipeline.run.completed', traceId: 'trace-a1b2c3',
  },
  {
    id: 'evt-002', eventType: 'deployment.started', source: 'deployment-service',
    timestamp: '2024-03-20T10:28:00Z', status: 'delivered', payloadSize: 1024,
    subscriberCount: 2, topic: 'deployment.started', traceId: 'trace-d4e5f6',
  },
  {
    id: 'evt-003', eventType: 'code.pr.opened', source: 'code-repo-adapter',
    timestamp: '2024-03-20T10:25:00Z', status: 'failed', payloadSize: 4096,
    subscriberCount: 1, topic: 'code.pr.opened', traceId: 'trace-g7h8i9',
  },
  {
    id: 'evt-004', eventType: 'alert.triggered', source: 'monitoring-service',
    timestamp: '2024-03-20T10:22:00Z', status: 'delivered', payloadSize: 512,
    subscriberCount: 4, topic: 'alert.triggered', traceId: 'trace-j0k1l2',
  },
  {
    id: 'evt-005', eventType: 'pipeline.run.failed', source: 'pipeline-engine',
    timestamp: '2024-03-20T10:20:00Z', status: 'retried', payloadSize: 1536,
    subscriberCount: 3, topic: 'pipeline.run.failed', traceId: 'trace-m3n4o5',
  },
  {
    id: 'evt-006', eventType: 'cost.collected', source: 'finops-service',
    timestamp: '2024-03-20T10:18:00Z', status: 'delivered', payloadSize: 768,
    subscriberCount: 2, topic: 'cost.collected', traceId: 'trace-p6q7r8',
  },
  {
    id: 'evt-007', eventType: 'config.changed', source: 'config-service',
    timestamp: '2024-03-20T10:15:00Z', status: 'pending', payloadSize: 256,
    subscriberCount: 5, topic: 'config.changed', traceId: 'trace-s9t0u1',
  },
  {
    id: 'evt-008', eventType: 'deployment.completed', source: 'deployment-service',
    timestamp: '2024-03-20T10:12:00Z', status: 'delivered', payloadSize: 1280,
    subscriberCount: 3, topic: 'deployment.completed', traceId: 'trace-v2w3x4',
  },
  {
    id: 'evt-009', eventType: 'selfhealing.action.triggered', source: 'self-healing-engine',
    timestamp: '2024-03-20T10:10:00Z', status: 'delivered', payloadSize: 896,
    subscriberCount: 2, topic: 'selfhealing.action.triggered', traceId: 'trace-y5z6a7',
  },
  {
    id: 'evt-010', eventType: 'pipeline.run.completed', source: 'pipeline-engine',
    timestamp: '2024-03-20T10:08:00Z', status: 'failed', payloadSize: 2048,
    subscriberCount: 3, topic: 'pipeline.run.completed', traceId: 'trace-b8c9d0',
  },
];

// Unique event types for filter dropdown
const EVENT_TYPES = Array.from(new Set(MOCK_EVENTS.map((e) => e.eventType))).sort();

// ---- Main Component ----

const EventBusMonitoring: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<EventBusEvent[]>([]);
  const [stats, setStats] = useState<EventBusStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventBusEvent | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      // Attempt to fetch from API — no eventbus API client exists yet
      setUsingMockData(true);
      setEvents(MOCK_EVENTS);
      setStats(MOCK_STATS);
    } catch (error: unknown) {
      setUsingMockData(true);
      if (error instanceof Error) {
        message.error(`加载 EventBus 数据失败：${error.message}`);
      } else {
        message.error('加载 EventBus 数据失败，使用模拟数据');
      }
      setEvents(MOCK_EVENTS);
      setStats(MOCK_STATS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (typeFilter !== 'all' && e.eventType !== typeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !e.eventType.toLowerCase().includes(q) &&
          !e.source.toLowerCase().includes(q) &&
          !e.traceId.toLowerCase().includes(q) &&
          !e.topic.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [events, statusFilter, typeFilter, searchQuery]);

  const openDetail = (event: EventBusEvent) => {
    setSelectedEvent(event);
    setDetailDrawerVisible(true);
  };

  const formatPayloadSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ---- Table columns ----

  const columns: TableColumn<EventBusEvent>[] = [
    {
      key: 'eventType',
      title: '事件类型',
      dataIndex: 'eventType',
      width: 220,
      render: (_v: unknown, record: EventBusEvent) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13, cursor: 'pointer' }} onClick={() => openDetail(record)}>
            {record.eventType}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            Topic: {record.topic}
          </Text>
        </Space>
      ),
    },
    {
      key: 'source',
      title: '来源',
      dataIndex: 'source',
      width: 140,
      render: (v: unknown) => (
        <Tag color="blue" style={{ fontSize: 11 }}>{String(v)}</Tag>
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_v: unknown, record: EventBusEvent) => (
        <Tag color={statusColorMap[record.status]} icon={statusIconMap[record.status]}>
          {statusLabelMap[record.status]}
        </Tag>
      ),
    },
    {
      key: 'subscribers',
      title: '订阅数',
      dataIndex: 'subscriberCount',
      width: 80,
      render: (v: unknown) => (
        <Text type="secondary">{String(v)}</Text>
      ),
    },
    {
      key: 'payloadSize',
      title: 'Payload',
      dataIndex: 'payloadSize',
      width: 100,
      render: (v: unknown) => (
        <Text code style={{ fontSize: 11, color: colors.neutral[600] }}>
          {formatPayloadSize(typeof v === 'number' ? v : 0)}
        </Text>
      ),
    },
    {
      key: 'timestamp',
      title: '时间',
      dataIndex: 'timestamp',
      width: 140,
      sortable: true,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(String(v)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 80,
      render: (_: unknown, record: EventBusEvent) => (
        <Tooltip title="详情">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
            详情
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>EventBus</Title>
          <Text type="secondary">事件总线监控</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Mock data warning banner */}
      {usingMockData && (
        <Alert
          message="使用模拟数据"
          description="EventBus API 尚未集成，当前显示的是模拟数据。"
          type="warning"
          showIcon
          closable
          style={{ marginBottom: spacing.md }}
          onClose={() => setUsingMockData(false)}
        />
      )}

      {/* Stats Cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing.md, marginBottom: spacing.lg }}>
          <MetricCard
            title="总事件数"
            value={stats.totalEvents}
            icon={<InfoCircleOutlined />}
            color={colors.primary[500]}
            size="medium"
          />
          <MetricCard
            title="活跃订阅者"
            value={stats.activeSubscribers}
            icon={<SwapOutlined />}
            color={colors.purple[500]}
            size="medium"
          />
          <MetricCard
            title="失败事件"
            value={stats.failedEvents}
            icon={<WarningOutlined />}
            color={colors.error[400]}
            size="medium"
          />
          <MetricCard
            title="事件速率"
            value={stats.eventRate}
            unit="evt/min"
            icon={<ClockCircleOutlined />}
            color={colors.success[500]}
            size="medium"
          />
        </div>
      )}

      {/* Filters */}
      <Card size="small" style={{ marginBottom: spacing.md }}>
        <Space wrap>
          <Input.Search
            placeholder="搜索事件类型、来源、Trace ID..."
            allowClear
            style={{ width: 280 }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onSearch={setSearchQuery}
          />
          <Text><FilterOutlined /> 状态:</Text>
          <Select
            style={{ width: 120 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { label: '全部', value: 'all' },
              { label: '已投递', value: 'delivered' },
              { label: '失败', value: 'failed' },
              { label: '待处理', value: 'pending' },
              { label: '重试中', value: 'retried' },
            ]}
          />
          <Text>事件类型:</Text>
          <Select
            style={{ width: 200 }}
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { label: '全部', value: 'all' },
              ...EVENT_TYPES.map((t) => ({ label: t, value: t })),
            ]}
          />
        </Space>
      </Card>

      {/* Event Stream Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredEvents}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
        />
      </Card>

      {/* Event Detail Drawer */}
      <Drawer
        title="事件详情"
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={640}
        destroyOnClose
      >
        {selectedEvent && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="事件 ID" span={2}>
              <Text code>{selectedEvent.id}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="事件类型" span={2}>
              <Text strong>{selectedEvent.eventType}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Topic" span={2}>
              <Text code>{selectedEvent.topic}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="来源">
              <Tag color="blue">{selectedEvent.source}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColorMap[selectedEvent.status]} icon={statusIconMap[selectedEvent.status]}>
                {statusLabelMap[selectedEvent.status]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Trace ID">
              <Text code>{selectedEvent.traceId}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="订阅数">
              {selectedEvent.subscriberCount}
            </Descriptions.Item>
            <Descriptions.Item label="Payload 大小">
              <Text code>{formatPayloadSize(selectedEvent.payloadSize)}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="时间" span={2}>
              {dayjs(selectedEvent.timestamp).format('YYYY-MM-DD HH:mm:ss')}
              <Text type="secondary" style={{ marginLeft: spacing.sm }}>
                ({dayjs(selectedEvent.timestamp).fromNow()})
              </Text>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};

export default EventBusMonitoring;
