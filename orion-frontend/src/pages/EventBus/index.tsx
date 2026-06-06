/**
 * EventBus Monitoring Page
 * Event bus status monitoring and event stream visualization
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Select,
  Input,
  Tooltip,
  Drawer,
  Descriptions,
  message,
} from 'antd';
import {
  ReloadOutlined,
  FilterOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  SwapOutlined,
  InfoCircleOutlined,
  EyeOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import MetricCard from '@/components/MetricCard';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';
import { getEvents, getStats } from '@/api/eventbus';
import type { EventBusEvent as ApiEventBusEvent } from '@/api/eventbus';
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

  // Type mapping: API event type -> UI event type
  const mapApiEvent = (apiEvent: ApiEventBusEvent): EventBusEvent => ({
    id: apiEvent.id,
    eventType: apiEvent.subject,
    source: apiEvent.source || apiEvent.publishedBy || 'unknown',
    timestamp: apiEvent.publishedAt || apiEvent.createdAt,
    status: (apiEvent.status as EventBusEvent['status']) || 'pending',
    payloadSize: JSON.stringify(apiEvent.payload || {}).length,
    subscriberCount: 0,
    topic: apiEvent.subject,
    traceId: apiEvent.id.substring(0, 12),
  });

  const mapApiStats = (rawStats: Record<string, number>): EventBusStats => ({
    totalEvents: rawStats.total || 0,
    activeSubscribers: rawStats.activeSubscribers || 0,
    failedEvents: rawStats.failed || rawStats.failedEvents || 0,
    eventRate: rawStats.eventRate || 0,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [eventsRes, statsRes] = await Promise.all([getEvents({ limit: 100 }), getStats()]);
      const eventsData = (eventsRes.data as any)?.events || [];
      const statsData = (statsRes.data as any)?.stats || {};
      setEvents(eventsData.map(mapApiEvent));
      setStats(mapApiStats(statsData));
    } catch (error: unknown) {
      message.error(`加载 EventBus 数据失败: ${(error as Error).message}`);
      setEvents([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const eventTypes = useMemo(
    () => Array.from(new Set(events.map((e) => e.eventType))).sort(),
    [events]
  );

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
        )
          return false;
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
          <Text
            strong
            style={{ fontSize: 13, cursor: 'pointer' }}
            onClick={() => openDetail(record)}
          >
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
        <Tag color="blue" style={{ fontSize: 11 }}>
          {String(v)}
        </Tag>
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
      render: (v: unknown) => <Text type="secondary">{String(v)}</Text>,
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
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => openDetail(record)}
          >
            详情
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
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
            <ThunderboltOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            EventBus
          </Title>
          <Text type="secondary">事件总线监控</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: spacing.md,
            marginBottom: spacing.lg,
          }}
        >
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
          <Text>
            <FilterOutlined /> 状态:
          </Text>
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
              ...eventTypes.map((t) => ({ label: t, value: t })),
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
              <Tag
                color={statusColorMap[selectedEvent.status]}
                icon={statusIconMap[selectedEvent.status]}
              >
                {statusLabelMap[selectedEvent.status]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Trace ID">
              <Text code>{selectedEvent.traceId}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="订阅数">{selectedEvent.subscriberCount}</Descriptions.Item>
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
