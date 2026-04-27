/**
 * Execution Dashboard - Recent executions, status tracking, execution timeline
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Typography, Button, Space, Tag, Card, Row, Col, Statistic, Timeline, message } from 'antd';
import { colors, spacing } from '@/tokens';
import { ReloadOutlined, PlayCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { getCommands, type ChatOpsExecution } from '@/api/chatops';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const platformColorMap: Record<string, string> = {
  dingtalk: colors.primary[500],
  wecom: colors.primary[400],
  feishu: colors.primary[600],
  slack: colors.purple[800],
  cli: 'default',
};

const ExecutionDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [executions, setExecutions] = useState<ChatOpsExecution[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getCommands();
      // Demo: create mock execution data from command data
      const cmdData = Array.isArray(res.data.data) ? res.data.data : [];
      const mockExecutions: ChatOpsExecution[] = cmdData.slice(0, 10).map((cmd: { id: string; name: string }, index: number) => ({
        id: `exec-${cmd.id}`,
        command: cmd.name,
        userId: `user-${index % 3 + 1}`,
        platform: ['dingtalk', 'wecom', 'feishu', 'cli'][index % 4] as ChatOpsExecution['platform'],
        status: ['running', 'success', 'failed', 'timeout', 'success'][index % 5] as ChatOpsExecution['status'],
        startTime: dayjs().subtract(index * 5, 'minute').toISOString(),
        endTime: index % 5 !== 0 ? dayjs().subtract(index * 5 - 2, 'minute').toISOString() : undefined,
        durationMs: index % 5 !== 0 ? (index * 1000 + 500) : undefined,
      }));
      setExecutions(mockExecutions);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`Failed to load executions：${error.message}`);
      } else {
        message.error('Failed to load executions');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredExecutions = useMemo(() => {
    return executions.filter((exec) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!exec.command.toLowerCase().includes(q) && !exec.userId.toLowerCase().includes(q)) return false;
      }
      if (filters.status && filters.status !== 'all' && exec.status !== filters.status) return false;
      if (filters.platform && filters.platform !== 'all' && exec.platform !== filters.platform) return false;
      return true;
    });
  }, [searchQuery, filters, executions]);

  const successCount = executions.filter((e) => e.status === 'success').length;
  const failedCount = executions.filter((e) => e.status === 'failed').length;
  const runningCount = executions.filter((e) => e.status === 'running').length;

  const columns: TableColumn<ChatOpsExecution>[] = [
    {
      key: 'command',
      title: '命令',
      dataIndex: 'command',
      width: 160,
      sortable: true,
      render: (v: unknown) => <Text code>/{String(v)}</Text>,
    },
    {
      key: 'platform',
      title: '平台',
      dataIndex: 'platform',
      width: 100,
      render: (v: unknown) => <Tag color={platformColorMap[String(v)] || 'default'}>{String(v)}</Tag>,
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
      render: (v: unknown) => <StatusBadge status={v as any} size="small" />,
    },
    {
      key: 'duration',
      title: '耗时',
      dataIndex: 'durationMs',
      width: 100,
      render: (v: unknown) => v ? <Text>{(Number(v) / 1000).toFixed(1)}s</Text> : <Text type="secondary">-</Text>,
    },
    {
      key: 'startTime',
      title: '开始时间',
      dataIndex: 'startTime',
      width: 160,
      sortable: true,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>{dayjs(String(v)).fromNow()}</Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 100,
      render: (_: unknown) => (
        <Button type="link" size="small" icon={<PlayCircleOutlined />}>查看</Button>
      ),
    },
  ];

  const filterDefs: FilterDefinition[] = [
    { key: 'status', label: '状态', options: [
      { label: '全部', value: 'all' },
      { label: 'Running', value: 'running' },
      { label: 'Success', value: 'success' },
      { label: 'Failed', value: 'failed' },
      { label: 'Timeout', value: 'timeout' },
    ]},
    { key: 'platform', label: '平台', options: [
      { label: '全部', value: 'all' },
      { label: '钉钉', value: 'dingtalk' },
      { label: '企业微信', value: 'wecom' },
      { label: '飞书', value: 'feishu' },
      { label: 'CLI', value: 'cli' },
    ]},
  ];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>执行监控</Title>
          <Text type="secondary">最近命令执行记录与状态跟踪</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}><Card><Statistic title="总执行" value={executions.length} /></Card></Col>
        <Col span={6}><Card><Statistic title="成功" value={successCount} valueStyle={{ color: colors.success[500] }} /></Card></Col>
        <Col span={6}><Card><Statistic title="失败" value={failedCount} valueStyle={{ color: colors.error[400] }} /></Card></Col>
        <Col span={6}><Card><Statistic title="运行中" value={runningCount} valueStyle={{ color: colors.primary[500] }} /></Card></Col>
      </Row>

      <Row gutter={16}>
        <Col span={16}>
          <Card>
            <div style={{ marginBottom: 16 }}>
              <SearchFilterBar onSearch={setSearchQuery} onFilter={setFilters} filters={filterDefs} searchPlaceholder="搜索执行记录..." />
            </div>
            <Table columns={columns} dataSource={filteredExecutions} loading={loading} rowKey="id" size="middle" striped />
          </Card>
        </Col>
        <Col span={8}>
          <Card title={<Space><ClockCircleOutlined />执行时间线</Space>}>
            <Timeline>
              {executions.slice(0, 8).map((exec) => (
                <Timeline.Item key={exec.id} color={exec.status === 'success' ? 'green' : exec.status === 'failed' ? 'red' : exec.status === 'running' ? 'blue' : 'gray'}>
                  <Text strong>/{exec.command}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: spacing[3] }}>
                    {exec.platform} - {dayjs(exec.startTime).fromNow()}
                  </Text>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ExecutionDashboard;
