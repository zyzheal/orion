/**
 * Audit Log Viewer - Filterable log table, export, statistics
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Typography, Button, Space, Tag, Card, Row, Col, Statistic, message } from 'antd';
import { spacing } from '@/tokens';
import { ReloadOutlined, DownloadOutlined, BarChartOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { getAuditLogs, getAuditStats, exportAuditLogs, type AuditLog, type AuditStats } from '@/api/chatops';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const AuditLogViewer: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logRes, statsRes] = await Promise.all([
        getAuditLogs(),
        getAuditStats(),
      ]);
      setLogs(Array.isArray(logRes.data.data) ? logRes.data.data : []);
      setStats(statsRes.data.data as AuditStats | null);
    } catch {
      message.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!log.command.toLowerCase().includes(q) && !log.userId.toLowerCase().includes(q)) return false;
      }
      if (filters.platform && filters.platform !== 'all' && log.platform !== filters.platform) return false;
      return true;
    });
  }, [searchQuery, filters, logs]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportAuditLogs({
        startDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
        endDate: dayjs().format('YYYY-MM-DD'),
        format: 'csv',
      });
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    } finally {
      setExporting(false);
    }
  };

  const columns: TableColumn<AuditLog>[] = [
    {
      key: 'id',
      title: '日志 ID',
      dataIndex: 'id',
      width: 180,
      render: (v: unknown) => <Text code style={{ fontSize: spacing[3] }}>{String(v).slice(0, 12)}...</Text>,
    },
    {
      key: 'command',
      title: '命令',
      dataIndex: 'command',
      width: 140,
      render: (v: unknown) => <Text code>/{String(v)}</Text>,
    },
    {
      key: 'userId',
      title: '用户',
      dataIndex: 'userId',
      width: 120,
      render: (v: unknown) => <Text>{String(v)}</Text>,
    },
    {
      key: 'platform',
      title: '平台',
      dataIndex: 'platform',
      width: 100,
      render: (v: unknown) => <Tag>{String(v)}</Tag>,
    },
    {
      key: 'action',
      title: '操作',
      dataIndex: 'action',
      width: 140,
      render: (v: unknown) => <Tag color="blue">{String(v)}</Tag>,
    },
    {
      key: 'details',
      title: '详情',
      dataIndex: 'details',
      width: 200,
      render: (v: unknown) => <Text style={{ fontSize: spacing[3] }}>{String(v || '-')}</Text>,
    },
    {
      key: 'timestamp',
      title: '时间',
      dataIndex: 'timestamp',
      width: 160,
      sortable: true,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>{dayjs(String(v)).fromNow()}</Text>
      ),
    },
  ];

  const filterDefs: FilterDefinition[] = [
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
          <Title level={3} style={{ margin: 0 }}>审计日志</Title>
          <Text type="secondary">ChatOps 命令执行审计与统计</Text>
        </div>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleExport} loading={exporting}>导出</Button>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card><Statistic title="总执行数" value={stats?.totalExecutions || logs.length} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="成功率" value={stats?.successRate || 0} precision={1} suffix="%" /></Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="最常用命令" value={stats?.topCommands?.[0]?.command || '-'} valueStyle={{ fontSize: spacing[4] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="最活跃用户" value={stats?.topUsers?.[0]?.userId || '-'} valueStyle={{ fontSize: spacing[4] }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={16}>
          <Card>
            <div style={{ marginBottom: 16 }}>
              <SearchFilterBar onSearch={setSearchQuery} onFilter={setFilters} filters={filterDefs} searchPlaceholder="搜索审计日志..." />
            </div>
            <Table columns={columns} dataSource={filteredLogs} loading={loading} rowKey="id" size="middle" striped />
          </Card>
        </Col>
        <Col span={8}>
          {stats && (
            <>
              <Card title={<Space><BarChartOutlined />平台分布</Space>} style={{ marginBottom: 16 }}>
                {stats.platformBreakdown?.map((item, index) => (
                  <div key={index} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Tag>{item.platform}</Tag>
                    <Text>{item.count} 次</Text>
                  </div>
                ))}
              </Card>
              <Card title={<Space><BarChartOutlined />Top 命令</Space>}>
                {stats.topCommands?.map((item, index) => (
                  <div key={index} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text code>/{item.command}</Text>
                    <Text>{item.count} 次</Text>
                  </div>
                ))}
              </Card>
            </>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default AuditLogViewer;
