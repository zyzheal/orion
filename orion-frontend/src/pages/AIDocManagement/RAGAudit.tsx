import React, { useState, useEffect, useCallback } from 'react';
import { Table, Tabs, Tag, Card, message, Typography, Space, Tooltip } from 'antd';
import { colors, spacing, componentRadius, shadows } from '@/tokens';
import { getRAGAuditLogs, getRAGFlaggedQueries, RAGAuditLog } from '@/api/ai-docs';
import dayjs from 'dayjs';

const { Text } = Typography;

const RAGAuditPage: React.FC = () => {
  const [tab, setTab] = useState('all');
  const [logs, setLogs] = useState<RAGAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: pageSize, offset: (page - 1) * pageSize };
      const res = tab === 'all'
        ? await getRAGAuditLogs(params)
        : await getRAGFlaggedQueries(params);
      setLogs(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      message.error('加载审计日志失败');
    } finally {
      setLoading(false);
    }
  }, [tab, page, pageSize]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const columns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '用户',
      dataIndex: 'user_id',
      width: 120,
      render: (v: string) => v || '-',
    },
    {
      title: '查询内容',
      dataIndex: 'query_text',
      ellipsis: true,
      render: (v: string, record: RAGAuditLog) => (
        <Tooltip title={v}>
          <Text style={{ color: record.safety_flagged ? colors.error[500] : 'inherit' }}>{v}</Text>
        </Tooltip>
      ),
    },
    {
      title: '类型',
      dataIndex: 'query_type',
      width: 100,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      width: 90,
      render: (v: number) => (v ? (v * 100).toFixed(0) + '%' : '-'),
    },
    {
      title: '延迟',
      dataIndex: 'latency_ms',
      width: 90,
      render: (v: number) => (v ? v + 'ms' : '-'),
    },
    {
      title: '来源数',
      dataIndex: 'source_count',
      width: 80,
    },
    {
      title: '安全',
      dataIndex: 'safety_flagged',
      width: 100,
      render: (v: boolean, record: RAGAuditLog) => v
        ? <Tag color="error" title={record.safety_reason}>已标记</Tag>
        : <Tag color="success">正常</Tag>,
    },
    {
      title: 'IP',
      dataIndex: 'ip_address',
      width: 130,
      render: (v: string) => v || '-',
    },
    {
      title: '反馈',
      dataIndex: 'has_feedback',
      width: 80,
      render: (v: boolean, record: RAGAuditLog) => v
        ? <Tag color={record.feedback_positive ? 'success' : 'warning'}>{record.feedback_positive ? '👍' : '👎'}</Tag>
        : <Text type="secondary">-</Text>,
    },
  ];

  return (
    <Card style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}>
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'all', label: `全部查询 (${tab === 'all' ? total : ''})` },
          { key: 'flagged', label: `安全标记 (${tab === 'flagged' ? total : ''})` },
        ]}
      />
      <Table
        columns={columns}
        dataSource={logs}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: setPage,
          onShowSizeChange: (_c, s) => { setPageSize(s); setPage(1); },
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
        }}
        expandable={{
          expandedRowRender: (record) => (
            <div style={{ paddingLeft: spacing.lg }}>
              <Space direction="vertical" size={4}>
                <Text type="secondary">Query Hash: <Text code>{record.query_hash}</Text></Text>
                <Text type="secondary">Answer Length: {record.answer_length} 字符</Text>
                {record.safety_flagged && <Text style={{ color: colors.error[500] }}>安全原因: {record.safety_reason}</Text>}
                {record.has_correction && <Text type="secondary">含用户纠正</Text>}
                {record.user_agent && <Text type="secondary" ellipsis>User-Agent: {record.user_agent}</Text>}
              </Space>
            </div>
          ),
        }}
      />
    </Card>
  );
};

export default RAGAuditPage;