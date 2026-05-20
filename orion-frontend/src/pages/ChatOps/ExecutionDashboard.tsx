/**
 * Execution Dashboard - Recent executions, status tracking, execution timeline
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Typography, Button, Space, Tag, Card, Row, Col, Statistic, Timeline, Empty } from 'antd';
import { colors, spacing } from '@/tokens';
import { ReloadOutlined, PlayCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { getExecutions, type ChatOpsExecution } from '@/api/chatops';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text } = Typography;

const platformColorMap: Record<string, string> = {
  dingtalk: colors.primary[500],
  wecom: colors.primary[400],
  feishu: colors.primary[600],
  slack: colors.purple[800],
  cli: 'default',
  web: colors.primary[300],
};

const statusColorMap: Record<string, string> = {
  pending: 'default',
  running: 'blue',
  completed: 'green',
  failed: 'red',
  cancelled: 'orange',
};

const ExecutionDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [executions, setExecutions] = useState<ChatOpsExecution[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await getExecutions({
        commandId: searchQuery || undefined,
        status: filters.status && filters.status !== 'all' ? String(filters.status) : undefined,
        platform:
          filters.platform && filters.platform !== 'all' ? String(filters.platform) : undefined,
        page: 1,
        perPage: 50,
      });
      const data = Array.isArray(res.data.data) ? res.data.data : [];
      setExecutions(data);
    } catch {
      setApiError('后端服务暂不可用');
      setExecutions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters.status, filters.platform, searchQuery]);

  const filteredExecutions = useMemo(() => {
    return executions;
  }, [executions]);

  const successCount = executions.filter((e) => e.status === 'completed').length;
  const failedCount = executions.filter((e) => e.status === 'failed').length;
  const runningCount = executions.filter(
    (e) => e.status === 'running' || e.status === 'pending'
  ).length;

  const columns: TableColumn<ChatOpsExecution>[] = [
    {
      key: 'commandId',
      title: '命令',
      dataIndex: 'commandId',
      width: 160,
      sortable: true,
      render: (v: unknown) => <Text code>/{String(v)}</Text>,
    },
    {
      key: 'platform',
      title: '平台',
      dataIndex: 'platform',
      width: 100,
      render: (v: unknown) => (
        <Tag color={platformColorMap[String(v)] || 'default'}>{String(v)}</Tag>
      ),
    },
    {
      key: 'userId',
      title: '用户',
      dataIndex: 'userId',
      width: 100,
      render: (v: unknown) => <Text>{String(v)}</Text>,
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: unknown) => <Tag color={statusColorMap[String(v)] || 'default'}>{String(v)}</Tag>,
    },
    {
      key: 'startTime',
      title: '开始时间',
      dataIndex: 'startTime',
      width: 160,
      sortable: true,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(String(v)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 100,
      render: (_: unknown) => (
        <Button type="link" size="small" icon={<PlayCircleOutlined />}>
          查看
        </Button>
      ),
    },
  ];

  const filterDefs: FilterDefinition[] = [
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '全部', value: 'all' },
        { label: '待执行', value: 'pending' },
        { label: '运行中', value: 'running' },
        { label: '已完成', value: 'completed' },
        { label: '失败', value: 'failed' },
        { label: '已取消', value: 'cancelled' },
      ],
    },
    {
      key: 'platform',
      label: '平台',
      options: [
        { label: '全部', value: 'all' },
        { label: '钉钉', value: 'dingtalk' },
        { label: '企业微信', value: 'wecom' },
        { label: '飞书', value: 'feishu' },
        { label: 'Slack', value: 'slack' },
        { label: 'CLI', value: 'cli' },
        { label: 'Web', value: 'web' },
      ],
    },
  ];

  if (apiError && executions.length === 0) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 16 }}>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
        </div>
        <Card>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={apiError} />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总执行" value={executions.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成功"
              value={successCount}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="失败" value={failedCount} valueStyle={{ color: colors.error[400] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="运行中"
              value={runningCount}
              valueStyle={{ color: colors.primary[500] }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={16}>
          <Card>
            <div style={{ marginBottom: 16 }}>
              <SearchFilterBar
                onSearch={setSearchQuery}
                onFilter={setFilters}
                filters={filterDefs}
                searchPlaceholder="搜索执行记录..."
              />
            </div>
            <Table
              columns={columns}
              dataSource={filteredExecutions}
              loading={loading}
              rowKey="id"
              size="middle"
              striped
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card
            title={
              <Space>
                <ClockCircleOutlined />
                执行时间线
              </Space>
            }
          >
            {executions.length === 0 ? (
              <Empty description="暂无执行记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Timeline>
                {executions.slice(0, 8).map((exec) => (
                  <Timeline.Item
                    key={exec.id}
                    color={
                      exec.status === 'completed'
                        ? 'green'
                        : exec.status === 'failed'
                          ? 'red'
                          : exec.status === 'running'
                            ? 'blue'
                            : 'gray'
                    }
                  >
                    <Text strong>/{exec.commandId}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: spacing[3] }}>
                      {exec.platform} - {dayjs(exec.startTime).fromNow()}
                    </Text>
                  </Timeline.Item>
                ))}
              </Timeline>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ExecutionDashboard;
