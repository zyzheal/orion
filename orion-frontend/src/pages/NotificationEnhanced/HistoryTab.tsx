/**
 * HistoryTab — 通知历史
 * 只读列表：通知发送记录，支持分页、筛选、标记已读
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Typography,
  Button,
  Space,
  Table,
  Card,
  Select,
  Tag,
  Tooltip,
  message,
  Empty,
  DatePicker,
} from 'antd';
import { ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { useQuery } from '@/providers/QueryProvider';
import {
  getNotificationHistory,
  markNotificationHistoryAsRead,
  markAllNotificationHistoryAsRead,
  type NotificationHistoryItem,
  type NotificationHistoryPage,
  CHANNEL_LABELS,
  CHANNEL_TYPES,
} from '@/api/notification-enhanced';

const { Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending: { color: colors.warning[500], label: '待发送' },
  sent: { color: colors.info[500], label: '已发送' },
  failed: { color: colors.error[500], label: '发送失败' },
  delivered: { color: colors.success[500], label: '已送达' },
  read: { color: colors.neutral[500], label: '已读' },
};

const STATUS_FILTERS = Object.entries(STATUS_MAP).map(([key, val]) => ({
  label: val.label,
  value: key,
}));

const HistoryTab: React.FC = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [channelFilter, setChannelFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  // 分页/筛选参数变化时自动触发查询；dateRange 为 dayjs 对象，序列化后放入 queryKey
  const params = useMemo(() => {
    const p: Record<string, any> = { page, pageSize };
    if (statusFilter) p.status = statusFilter;
    if (channelFilter) p.channelType = channelFilter;
    if (dateRange && dateRange[0] && dateRange[1]) {
      p.startDate = dateRange[0].format('YYYY-MM-DD');
      p.endDate = dateRange[1].format('YYYY-MM-DD');
    }
    return p;
  }, [page, pageSize, statusFilter, channelFilter, dateRange]);

  const {
    data: pageData = null,
    isLoading,
    isFetching,
    isError,
    error: queryError,
    refetch,
  } = useQuery<NotificationHistoryPage | null>({
    queryKey: ['notification-enhanced-history', params],
    queryFn: () =>
      getNotificationHistory(params).then((res) => (res as NotificationHistoryPage) ?? null),
    staleTime: 30_000,
  });

  // 首次加载与后续刷新（筛选/分页变化、手动 refetch）都呈现加载态
  const loading = isLoading || isFetching;
  const items = pageData?.items ?? [];
  const total = pageData?.total ?? 0;

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  // （QueryObserver 未实现 observer 级回调），统一用 isError + useEffect 呈现。
  useEffect(() => {
    if (isError)
      message.error(
        queryError instanceof Error ? `加载通知历史失败: ${queryError.message}` : '加载通知历史失败'
      );
  }, [isError, queryError]);

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationHistoryAsRead(id);
      message.success('已标记为已读');
      refetch();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      const result = await markAllNotificationHistoryAsRead();
      message.success(`已标记 ${result.marked} 条为已读`);
      refetch();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '批量操作失败');
    } finally {
      setMarkingAll(false);
    }
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (v: string) => (
        <Text style={{ fontWeight: 500 }} title={v}>
          {v}
        </Text>
      ),
    },
    {
      title: '渠道',
      dataIndex: 'channel_type',
      key: 'channel_type',
      width: 110,
      render: (v: string) => <Tag>{CHANNEL_LABELS[v] || v}</Tag>,
    },
    {
      title: '用户 ID',
      dataIndex: 'user_id',
      key: 'user_id',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center' as const,
      render: (v: string) => {
        const s = STATUS_MAP[v] || STATUS_MAP.pending;
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '发送时间',
      dataIndex: 'sent_at',
      key: 'sent_at',
      width: 160,
      render: (v: string) => (v ? new Date(v).toLocaleString('zh-CN') : '-'),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, record: NotificationHistoryItem) => {
        if (record.status === 'read') return <Text type="secondary">已读</Text>;
        return (
          <Tooltip title="标记已读">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleMarkRead(record.id)}
            />
          </Tooltip>
        );
      },
    },
  ];

  // Expandable row for failed items to show error message
  const expandedRowRender = (record: NotificationHistoryItem) => {
    if (record.error_message) {
      return (
        <div style={{ padding: spacing.md, background: colors.error[50], borderRadius: 4 }}>
          <Text type="danger" style={{ fontWeight: 500 }}>
            发送错误:
          </Text>{' '}
          <Text>{record.error_message}</Text>
        </div>
      );
    }
    return null;
  };

  return (
    <Card
      style={{
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      }}
      bodyStyle={{ padding: spacing.md }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.md,
        }}
      >
        <Space>
          <Text type="secondary">共 {total} 条记录</Text>
        </Space>
        <Space>
          <Select
            placeholder="状态筛选"
            allowClear
            style={{ width: 120 }}
            value={statusFilter}
            onChange={setStatusFilter}
          >
            {STATUS_FILTERS.map((o) => (
              <Option key={o.value} value={o.value}>
                {o.label}
              </Option>
            ))}
          </Select>
          <Select
            placeholder="渠道筛选"
            allowClear
            style={{ width: 140 }}
            value={channelFilter}
            onChange={setChannelFilter}
          >
            {CHANNEL_TYPES.map((c) => (
              <Option key={c.value} value={c.value}>
                {c.label}
              </Option>
            ))}
          </Select>
          <RangePicker
            placeholder={['开始日期', '结束日期']}
            value={dateRange}
            onChange={(val) => setDateRange(val)}
          />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => refetch()}>
            刷新
          </Button>
          <Button loading={markingAll} onClick={handleMarkAllRead}>
            全部标记已读
          </Button>
        </Space>
      </div>

      {/* Table */}
      {items.length === 0 && !loading ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<Text type="secondary">暂无通知历史</Text>}
        />
      ) : (
        <Table
          dataSource={items}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          expandable={{ expandedRowRender, rowExpandable: (r) => !!r.error_message }}
          scroll={{ x: 900 }}
        />
      )}
    </Card>
  );
};

export default HistoryTab;
