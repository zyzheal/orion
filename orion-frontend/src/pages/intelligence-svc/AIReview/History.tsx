/**
 * AI Review - History
 * Review history list with filtering and search
 */
import React, { useState, useEffect } from 'react';
import { Typography, Card, Table, Tag, Space, Button, Input, Select, message } from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined, ScanOutlined } from '@ant-design/icons';
import { getReviewHistory } from '@/api/ai-review';
import { colors } from '@/tokens';
import type { AIReviewResult } from '@/api/ai-review';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const AIReviewHistory: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AIReviewResult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState<{ status?: string; repoId?: string }>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getReviewHistory({ ...filters, page, pageSize });
      setData(res.data?.items || []);
      setTotal(res.data?.total || 0);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载评审历史失败：${error.message}`);
      } else {
        message.error('加载评审历史失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, pageSize, filters]);

  const handleSearch = () => {
    setPage(1);
    loadData();
  };

  const handleReset = () => {
    setFilters({});
    setPage(1);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'green';
      case 'running':
        return 'blue';
      case 'failed':
        return 'red';
      default:
        return 'default';
    }
  };

  const statusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'running':
        return '运行中';
      case 'failed':
        return '失败';
      case 'pending':
        return '等待中';
      default:
        return status;
    }
  };

  const columns = [
    { title: '评审 ID', dataIndex: 'id', key: 'id', ellipsis: true },
    {
      title: 'PR ID',
      dataIndex: 'prId',
      key: 'prId',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    { title: '仓库 ID', dataIndex: 'repoId', key: 'repoId', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color={statusColor(status)}>{statusText(status)}</Tag>,
    },
    { title: '总问题', dataIndex: 'totalIssues', key: 'totalIssues' },
    {
      title: '严重',
      dataIndex: 'criticalCount',
      key: 'criticalCount',
      render: (count: number) => (count > 0 ? <Tag color="red">{count}</Tag> : count),
    },
    {
      title: '警告',
      dataIndex: 'warningCount',
      key: 'warningCount',
      render: (count: number) => (count > 0 ? <Tag color="orange">{count}</Tag> : count),
    },
    {
      title: '通过率',
      dataIndex: 'passRate',
      key: 'passRate',
      render: (rate: number) => `${(rate * 100).toFixed(1)}%`,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (ts: string) => dayjs(ts).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: AIReviewResult) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/ai-review/detail?id=${record.id}`)}
        >
          查看
        </Button>
      ),
    },
  ];

  const tableData = data.map((r) => ({ ...r, key: r.id }));

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ marginBottom: 8 }}>
        <ScanOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        评审历史
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        查看所有 AI 评审记录
      </Text>

      {/* Filter Bar */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索仓库 ID"
            prefix={<SearchOutlined />}
            value={filters.repoId}
            onChange={(e) => setFilters({ ...filters, repoId: e.target.value })}
            style={{ width: 200 }}
            onPressEnter={handleSearch}
          />
          <Select
            placeholder="状态"
            allowClear
            value={filters.status}
            onChange={(value) => setFilters({ ...filters, status: value })}
            style={{ width: 150 }}
          >
            <Select.Option value="pending">等待中</Select.Option>
            <Select.Option value="running">运行中</Select.Option>
            <Select.Option value="completed">已完成</Select.Option>
            <Select.Option value="failed">失败</Select.Option>
          </Select>
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
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

export default AIReviewHistory;
