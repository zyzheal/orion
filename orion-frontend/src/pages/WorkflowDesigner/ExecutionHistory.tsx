/**
 * 工作流执行历史
 */
import React, { useEffect, useState } from 'react';
import { Table, Tag, Empty, Space, Typography, Drawer, Descriptions, Timeline, Divider, Button, message } from 'antd';
import { ClockCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import {
  getExecutionHistory,
  getExecutionDetail,
  type WorkflowExecution,
  type WorkflowHistory,
} from '@/api/workflow';
import { colors, spacing } from '@/tokens';

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

const actionColors: Record<string, string> = {
  enter: 'blue',
  execute: 'green',
  exit: 'cyan',
  error: 'red',
  skip: 'default',
};

const actionText: Record<string, string> = {
  enter: '进入',
  execute: '执行',
  exit: '退出',
  error: '错误',
  skip: '跳过',
};

interface ExecutionHistoryProps {
  workflowId: string | null;
}

const ExecutionHistory: React.FC<ExecutionHistoryProps> = ({ workflowId }) => {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!workflowId) {
      setExecutions([]);
      return;
    }
    setLoading(true);
    getExecutionHistory(workflowId)
      .then(setExecutions)
      .catch((err) => {
        message.error('获取执行历史失败');
        setExecutions([]);
      })
      .finally(() => setLoading(false));
  }, [workflowId]);

  const handleViewDetail = async (execution: WorkflowExecution) => {
    setSelectedExecution(execution);
    setDrawerOpen(true);
    setDetailLoading(true);
    try {
      const detail = await getExecutionDetail(execution.id);
      setSelectedExecution(detail);
    } catch {
      // Use existing data as fallback
    } finally {
      setDetailLoading(false);
    }
  };

  const columns = [
    {
      title: '执行 ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => <Text code>{id.slice(0, 8)}...</Text>,
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
      render: (v: string) => v || '-',
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
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: WorkflowExecution) => (
        <Button
          type="link"
          size="small"
          icon={<FileTextOutlined />}
          onClick={() => handleViewDetail(record)}
        >
          详情
        </Button>
      ),
    },
  ];

  if (!workflowId) {
    return <Empty description="请选择一个工作流查看执行历史" />;
  }

  return (
    <>
      <Table
        columns={columns}
        dataSource={executions}
        loading={loading}
        rowKey="id"
        locale={{ emptyText: '暂无执行记录' }}
        pagination={{ pageSize: 10 }}
      />

      <Drawer
        title="执行详情"
        placement="right"
        width={600}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        {selectedExecution && (
          <>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="执行 ID">
                <Text code>{selectedExecution.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="工作流 ID">
                <Text code>{selectedExecution.workflowId}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColors[selectedExecution.status]}>
                  {statusText[selectedExecution.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="触发人">{selectedExecution.triggeredBy}</Descriptions.Item>
              <Descriptions.Item label="开始时间">
                {new Date(selectedExecution.createdAt).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="完成时间">
                {selectedExecution.completedAt
                  ? new Date(selectedExecution.completedAt).toLocaleString()
                  : '-'}
              </Descriptions.Item>
            </Descriptions>

            {selectedExecution.input && Object.keys(selectedExecution.input).length > 0 && (
              <>
                <Divider>输入参数</Divider>
                <pre
                  style={{
                    fontSize: 12,
                    background: colors.light.bg.secondary,
                    padding: spacing[3],
                    borderRadius: 6,
                    maxHeight: 120,
                    overflow: 'auto',
                  }}
                >
                  {JSON.stringify(selectedExecution.input, null, 2)}
                </pre>
              </>
            )}

            {selectedExecution.output && Object.keys(selectedExecution.output).length > 0 && (
              <>
                <Divider>输出结果</Divider>
                <pre
                  style={{
                    fontSize: 12,
                    background: colors.light.bg.secondary,
                    padding: spacing[3],
                    borderRadius: 6,
                    maxHeight: 120,
                    overflow: 'auto',
                  }}
                >
                  {JSON.stringify(selectedExecution.output, null, 2)}
                </pre>
              </>
            )}

            {selectedExecution.error && (
              <>
                <Divider>错误信息</Divider>
                <Text type="danger">{selectedExecution.error}</Text>
              </>
            )}

            {selectedExecution.history && selectedExecution.history.length > 0 && (
              <>
                <Divider>执行历史</Divider>
                <Timeline
                  items={selectedExecution.history.map((h: WorkflowHistory) => ({
                    color: actionColors[h.action] || 'blue',
                    children: (
                      <div>
                        <Text strong>{h.nodeName}</Text>
                        <Tag color={actionColors[h.action]} style={{ marginLeft: 8 }}>
                          {actionText[h.action] || h.action}
                        </Tag>
                        {h.duration && (
                          <Text type="secondary" style={{ marginLeft: 8 }}>
                            {h.duration}ms
                          </Text>
                        )}
                        {h.error && (
                          <div>
                            <Text type="danger" style={{ fontSize: 12 }}>
                              {h.error}
                            </Text>
                          </div>
                        )}
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {new Date(h.timestamp).toLocaleString()}
                        </Text>
                      </div>
                    ),
                  }))}
                />
              </>
            )}
          </>
        )}
      </Drawer>
    </>
  );
};

export default ExecutionHistory;
