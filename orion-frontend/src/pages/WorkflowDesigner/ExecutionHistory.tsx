/**
 * 工作流执行历史
 */
import React, { useEffect, useState } from 'react';
import { Table, Tag, Empty, Space, Typography } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { getExecutionHistory, WorkflowExecution } from '@/api/workflow';
import { colors } from '@/tokens';

const { Text } = Typography;

const statusColors: Record<string, string> = {
  pending: colors.neutral[500],
  running: colors.primary[500],
  suspended: colors.warning[500],
  completed: colors.success[500],
  failed: colors.error[500],
  terminated: colors.neutral[600],
};

const statusText: Record<string, string> = {
  pending: '待执行',
  running: '运行中',
  suspended: '已暂停',
  completed: '已完成',
  failed: '失败',
  terminated: '已终止',
};

interface ExecutionHistoryProps {
  workflowId: string | null;
}

const ExecutionHistory: React.FC<ExecutionHistoryProps> = ({ workflowId }) => {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workflowId) {
      setExecutions([]);
      return;
    }
    setLoading(true);
    getExecutionHistory(workflowId)
      .then(setExecutions)
      .catch(() => setExecutions([]))
      .finally(() => setLoading(false));
  }, [workflowId]);

  const columns = [
    {
      title: '执行 ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => <Text code>{id.slice(0, 8)}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={statusColors[status]}>{statusText[status]}</Tag>
      ),
    },
    {
      title: '触发人',
      dataIndex: 'triggeredBy',
      key: 'triggeredBy',
      width: 120,
    },
    {
      title: '开始时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (t: string) => (
        <Space>
          <ClockCircleOutlined style={{ color: colors.neutral[400] }} />
          {new Date(t).toLocaleString()}
        </Space>
      ),
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      width: 180,
      render: (t?: string) => (t ? new Date(t).toLocaleString() : '-'),
    },
    {
      title: '错误',
      dataIndex: 'error',
      key: 'error',
      ellipsis: true,
      render: (e?: string) => (e ? <Text type="danger">{e}</Text> : '-'),
    },
  ];

  if (!workflowId) {
    return <Empty description="请选择一个工作流查看执行历史" />;
  }

  return (
    <Table
      columns={columns}
      dataSource={executions}
      loading={loading}
      rowKey="id"
      locale={{ emptyText: '暂无执行记录' }}
      pagination={{ pageSize: 10 }}
    />
  );
};

export default ExecutionHistory;
