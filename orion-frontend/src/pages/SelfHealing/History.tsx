/**
 * Self-Healing - History
 * Healing history with filtering and search
 */
import React, { useState, useEffect } from 'react';
import { Typography, Card, Table, Tag, Space, Button, Input, Select, message } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { getHealingHistory } from '@/api/self-healing';
import type { SelfHealingIncident } from '@/api/self-healing';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const HealingHistory: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SelfHealingIncident[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState<{ severity?: string; status?: string; appName?: string }>(
    {}
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getHealingHistory({ ...filters, page, pageSize });
      setData((res.data as any).items || []);
      setTotal((res.data as any).total || 0);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载愈合历史失败：${error.message}`);
      } else {
        message.error('加载愈合历史失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, pageSize, filters]);

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'red';
      case 'warning':
        return 'orange';
      case 'info':
        return 'blue';
      default:
        return 'default';
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'green';
      case 'healing':
        return 'blue';
      case 'pending':
        return 'orange';
      case 'failed':
        return 'red';
      default:
        return 'default';
    }
  };

  const columns = [
    { title: '事件 ID', dataIndex: 'id', key: 'id', width: 120, ellipsis: true },
    { title: '类型', dataIndex: 'type', key: 'type' },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity: string) => <Tag color={severityColor(severity)}>{severity}</Tag>,
    },
    { title: '应用', dataIndex: 'appName', key: 'appName', width: 150 },
    { title: '环境', dataIndex: 'environment', key: 'environment', width: 120 },
    {
      title: '策略',
      dataIndex: 'strategy',
      key: 'strategy',
      width: 120,
      render: (text?: string) => text || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <Tag color={statusColor(status)}>{status}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (ts: string) => dayjs(ts).format('YYYY-MM-DD HH:mm'),
    },
  ];

  const tableData = data.map((r) => ({ ...r, key: r.id }));

  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ marginBottom: 16 }}>
        愈合历史
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        查看自愈合历史记录和结果
      </Text>

      {/* Filter Bar */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索应用名称"
            prefix={<SearchOutlined />}
            value={filters.appName}
            onChange={(e) => {
              setFilters({ ...filters, appName: e.target.value });
              setPage(1);
            }}
            style={{ width: 200 }}
          />
          <Select
            placeholder="严重程度"
            allowClear
            value={filters.severity}
            onChange={(value) => {
              setFilters({ ...filters, severity: value });
              setPage(1);
            }}
            style={{ width: 140 }}
          >
            <Select.Option value="critical">Critical</Select.Option>
            <Select.Option value="warning">Warning</Select.Option>
            <Select.Option value="info">Info</Select.Option>
          </Select>
          <Select
            placeholder="状态"
            allowClear
            value={filters.status}
            onChange={(value) => {
              setFilters({ ...filters, status: value });
              setPage(1);
            }}
            style={{ width: 140 }}
          >
            <Select.Option value="pending">待处理</Select.Option>
            <Select.Option value="healing">修复中</Select.Option>
            <Select.Option value="resolved">已解决</Select.Option>
            <Select.Option value="failed">修复失败</Select.Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            刷新
          </Button>
        </Space>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={tableData}
          loading={loading}
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
          size="small"
        />
      </Card>
    </div>
  );
};

export default HealingHistory;
