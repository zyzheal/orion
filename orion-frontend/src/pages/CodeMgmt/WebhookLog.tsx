/**
 * Code Management - Webhook Log Page
 * Table display of webhook events with filtering
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Button, Space, Tag, Drawer, Input, message } from 'antd';
import { ReloadOutlined, EyeOutlined, WebhookOutlined,} from '@ant-design/icons';
import { spacing } from '@/tokens';
import { colors } from '@/tokens';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { getWebhookLogs, type WebhookEvent } from '@/api/code-mgmt';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const WebhookLog: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [detailDrawer, setDetailDrawer] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const loadWebhookLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getWebhookLogs();
      const data = response.data as WebhookEvent[];
      setEvents(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载 Webhook 日志失败：${error.message}`);
      } else {
        message.error('加载 Webhook 日志失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWebhookLogs();
  }, [loadWebhookLogs]);

  const filteredEvents = useCallback(() => {
    return events.filter((event) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [event.eventType, event.repoType, event.repoName, event.id]
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(query)) return false;
      }

      // Status filter
      const statusFilter = filters.status;
      if (statusFilter && statusFilter !== 'all' && event.status !== statusFilter) {
        return false;
      }

      // Event type filter
      const eventTypeFilter = filters.eventType;
      if (eventTypeFilter && eventTypeFilter !== 'all' && event.eventType !== eventTypeFilter) {
        return false;
      }

      return true;
    });
  }, [events, searchQuery, filters]);

  const filterDefs: FilterDefinition[] = [
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '全部', value: 'all' },
        { label: '已处理', value: 'processed' },
        { label: '失败', value: 'failed' },
      ],
    },
    {
      key: 'eventType',
      label: '事件类型',
      options: [
        { label: '全部', value: 'all' },
        { label: 'push', value: 'push' },
        { label: 'pull_request', value: 'pull_request' },
        { label: 'pull_request_review', value: 'pull_request_review' },
        { label: 'create', value: 'create' },
        { label: 'delete', value: 'delete' },
      ],
    },
  ];

  const columns: TableColumn<WebhookEvent>[] = [
    {
      key: 'id',
      title: '事件 ID',
      dataIndex: 'id',
      width: 120,
      render: (value: unknown) => (
        <Text code style={{ fontSize: spacing[3] }}>
          {String(value).substring(0, 8)}
        </Text>
      ),
    },
    {
      key: 'eventType',
      title: '事件类型',
      dataIndex: 'eventType',
      width: 180,
      sortable: true,
      filterable: true,
      render: (value: unknown) => {
        const typeColorMap: Record<string, string> = {
          push: 'blue',
          pull_request: 'green',
          pull_request_review: 'purple',
          create: 'orange',
          delete: 'red',
        };
        return <Tag color={typeColorMap[String(value)] || 'default'}>{String(value)}</Tag>;
      },
    },
    {
      key: 'repoType',
      title: '仓库类型',
      dataIndex: 'repoType',
      width: 120,
      render: (value: unknown) => <Tag>{String(value)}</Tag>,
    },
    {
      key: 'repoName',
      title: '仓库名称',
      dataIndex: 'repoName',
      width: 200,
      sortable: true,
      filterable: true,
      render: (value: unknown) => <Text strong>{String(value)}</Text>,
    },
    {
      key: 'status',
      title: '处理状态',
      dataIndex: 'status',
      width: 120,
      render: (value: unknown) => {
        const statusVal = String(value);
        return (
          <Tag color={statusVal === 'processed' ? 'green' : 'red'}>
            {statusVal === 'processed' ? '已处理' : '失败'}
          </Tag>
        );
      },
    },
    {
      key: 'receivedAt',
      title: '接收时间',
      dataIndex: 'receivedAt',
      width: 180,
      sortable: true,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(String(value)).format('YYYY-MM-DD HH:mm:ss')}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 80,
      render: (_: unknown, record: any) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedEvent(record);
            setDetailDrawer(true);
          }}
        >
          详情
        </Button>
      ),
    },
  ];

  const handleRefresh = () => {
    loadWebhookLogs();
  };

  const displayEvents = filteredEvents();

  return (
    <div style={{ padding: 0 }}>
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
            <WebhookOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            Webhook 日志
          </Title>
          <Text type="secondary">共 {displayEvents.length} 条 Webhook 事件记录</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
          刷新
        </Button>
      </div>

      {/* Search and filter bar */}
      <div style={{ marginBottom: 16 }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={filterDefs}
          searchPlaceholder="搜索事件类型、仓库名称..."
        />
      </div>

      {/* Webhook table */}
      <Table
        columns={columns}
        dataSource={displayEvents}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
      />

      {/* Detail Drawer */}
      <Drawer
        title="Webhook 事件详情"
        placement="right"
        width={600}
        open={detailDrawer}
        onClose={() => {
          setDetailDrawer(false);
          setSelectedEvent(null);
        }}
      >
        {selectedEvent && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            {/* Basic info */}
            <div>
              <Text strong>事件 ID:</Text>
              <br />
              <Text code>{selectedEvent.id}</Text>
            </div>
            <div>
              <Text strong>事件类型:</Text>
              <br />
              <Tag color="blue">{selectedEvent.eventType}</Tag>
            </div>
            <div>
              <Text strong>仓库类型:</Text>
              <br />
              <Tag>{selectedEvent.repoType}</Tag>
            </div>
            <div>
              <Text strong>仓库名称:</Text>
              <br />
              <Text strong>{selectedEvent.repoName}</Text>
            </div>
            <div>
              <Text strong>处理状态:</Text>
              <br />
              <Tag color={selectedEvent.status === 'processed' ? 'green' : 'red'}>
                {selectedEvent.status === 'processed' ? '已处理' : '失败'}
              </Tag>
            </div>
            <div>
              <Text strong>接收时间:</Text>
              <br />
              <Text type="secondary">
                {dayjs(selectedEvent.receivedAt).format('YYYY-MM-DD HH:mm:ss')}
              </Text>
            </div>

            {/* Payload */}
            <div>
              <Text strong>Payload:</Text>
              <Input.TextArea
                value={JSON.stringify(selectedEvent.payload, null, 2)}
                readOnly
                rows={15}
                style={{ fontFamily: 'monospace', fontSize: spacing[3], marginTop: 8 }}
              />
            </div>
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default WebhookLog;
