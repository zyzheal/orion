/**
 * Audit Log Viewer - Filterable log table, export, statistics
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  message,
  DatePicker,
} from 'antd';
import { spacing } from '@/tokens';
import { colors } from '@/tokens';
import { AuditOutlined, ReloadOutlined, DownloadOutlined, BarChartOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import {
  getAuditLogs,
  getAuditStats,
  exportAuditLogs,
  type AuditLog,
  type AuditStats,
} from '@/api/chatops';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const AuditLogViewer: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 构建 API 查询参数
      const params: Record<string, string> = {};
      if (searchQuery) {
        params.command = searchQuery;
      }
      if (filters.platform && filters.platform !== 'all') {
        params.platform = Array.isArray(filters.platform) ? filters.platform[0] : filters.platform;
      }
      if (filters.status && filters.status !== 'all') {
        params.result = Array.isArray(filters.status) ? filters.status[0] : filters.status;
      }
      if (dateRange) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      }

      const [logRes, statsRes] = await Promise.all([getAuditLogs(params), getAuditStats(params)]);
      setLogs(Array.isArray(logRes.data) ? logRes.data : []);
      setStats(statsRes.data as AuditStats | null);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`Failed to load audit logs：${error.message}`);
      } else {
        message.error('Failed to load audit logs');
      }
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filters, dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const startDate = dateRange
        ? dateRange[0].format('YYYY-MM-DD')
        : dayjs().subtract(30, 'day').format('YYYY-MM-DD');
      const endDate = dateRange ? dateRange[1].format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
      await exportAuditLogs({ startDate, endDate, format: 'csv' });
      message.success('导出成功');
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`导出失败：${error.message}`);
      } else {
        message.error('导出失败');
      }
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
      render: (v: unknown) => (
        <Text code style={{ fontSize: spacing[3] }}>
          {String(v).slice(0, 12)}...
        </Text>
      ),
    },
    {
      key: 'command',
      title: '命令',
      dataIndex: 'action',
      width: 140,
      render: (v: unknown) => {
        // action 可能是对象 { command, params } 或字符串
        const cmd =
          typeof v === 'object' && v !== null
            ? (v as { command?: string }).command || '-'
            : String(v || '-');
        return <Text code>/{cmd}</Text>;
      },
    },
    {
      key: 'userId',
      title: '用户',
      dataIndex: 'actor',
      width: 120,
      render: (v: unknown) => {
        // actor 可能是对象 { userId, platform } 或字符串
        const uid =
          typeof v === 'object' && v !== null
            ? (v as { userId?: string }).userId || '-'
            : String(v || '-');
        return <Text>{uid}</Text>;
      },
    },
    {
      key: 'platform',
      title: '平台',
      dataIndex: 'actor',
      width: 100,
      render: (v: unknown) => {
        // actor 可能是对象 { userId, platform } 或字符串
        const p =
          typeof v === 'object' && v !== null
            ? (v as { platform?: string }).platform || '-'
            : String(v || '-');
        return <Tag>{p}</Tag>;
      },
    },
    {
      key: 'result',
      title: '状态',
      dataIndex: 'result',
      width: 100,
      render: (v: unknown) => {
        const status = String(v || '');
        if (status === 'success') return <Tag color="green">成功</Tag>;
        if (status === 'failed') return <Tag color="red">失败</Tag>;
        return <Tag>{status || '-'}</Tag>;
      },
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
      render: (v: unknown) => {
        const ts = String(v || '');
        const formatted = dayjs(ts).isValid() ? dayjs(ts).fromNow() : ts;
        return (
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            {formatted}
          </Text>
        );
      },
    },
  ];

  const filterDefs: FilterDefinition[] = [
    {
      key: 'platform',
      label: '平台',
      options: [
        { label: '全部', value: 'all' },
        { label: '钉钉', value: 'dingtalk' },
        { label: '企业微信', value: 'wecom' },
        { label: '飞书', value: 'feishu' },
        { label: 'CLI', value: 'cli' },
      ],
    },
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '全部', value: 'all' },
        { label: '成功', value: 'success' },
        { label: '失败', value: 'failed' },
      ],
    },
  ];

  return (
    <div style={{ padding: 0 }}>
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
            <AuditOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            审计日志
          </Title>
          <Text type="secondary">ChatOps 命令执行审计与统计</Text>
        </div>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleExport} loading={exporting}>
            导出
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总执行数" value={stats?.totalExecutions || logs.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="成功率" value={stats?.successRate || 0} precision={1} suffix="%" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="最常用命令"
              value={stats?.topCommands?.[0]?.command || '-'}
              valueStyle={{ fontSize: spacing[4] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="最活跃用户"
              value={stats?.topUsers?.[0]?.userId || '-'}
              valueStyle={{ fontSize: spacing[4] }}
            />
          </Card>
        </Col>
      </Row>

      {/* 高级过滤 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <span style={{ fontSize: spacing[3] }}>日期范围：</span>
          <RangePicker
            value={dateRange}
            onChange={(dates) =>
              setDateRange(dates && dates[0] && dates[1] ? [dates[0], dates[1]] : null)
            }
            format="YYYY-MM-DD"
          />
        </Space>
      </Card>

      <Row gutter={16}>
        <Col span={16}>
          <Card>
            <div style={{ marginBottom: 16 }}>
              <SearchFilterBar
                onSearch={setSearchQuery}
                onFilter={setFilters}
                filters={filterDefs}
                searchPlaceholder="搜索命令、用户..."
              />
            </div>
            <Table
              columns={columns}
              dataSource={logs}
              loading={loading}
              rowKey="id"
              size="middle"
              striped
            />
          </Card>
        </Col>
        <Col span={8}>
          {stats && (
            <>
              <Card
                title={
                  <Space>
                    <BarChartOutlined />
                    平台分布
                  </Space>
                }
                style={{ marginBottom: 16 }}
              >
                {stats.platformBreakdown?.map((item, index) => (
                  <div
                    key={index}
                    style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}
                  >
                    <Tag>{item.platform}</Tag>
                    <Text>{item.count} 次</Text>
                  </div>
                ))}
              </Card>
              <Card
                title={
                  <Space>
                    <BarChartOutlined />
                    Top 命令
                  </Space>
                }
              >
                {stats.topCommands?.map((item, index) => (
                  <div
                    key={index}
                    style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}
                  >
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
