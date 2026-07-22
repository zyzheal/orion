/**
 * AI Agent 审计日志查看器
 *
 * 展示 Agent 的执行历史记录
 */
import React from 'react';
import { Table, Tag, Typography, Empty, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { AuditLogEntry } from '@/api/ai-agents';
import { spacing } from '@/tokens';
import { RobotOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

interface AuditLogViewerProps {
  logs: AuditLogEntry[];
  loading: boolean;
  onExecuteAgent?: () => void;
}

/**
 * 审计日志查看器
 */
const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ logs, loading, onExecuteAgent }) => {
  if (logs.length === 0 && !loading) {
    return (
      <Empty
        description="暂无审计日志，执行 Agent 后将在此显示操作记录"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      >
        {onExecuteAgent && (
          <Button type="primary" icon={<RobotOutlined />} onClick={onExecuteAgent}>
            执行 Agent
          </Button>
        )}
      </Empty>
    );
  }

  const columns: ColumnsType<AuditLogEntry> = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (ts: string) => (
        <Text style={{ fontSize: 12 }}>
          {ts ? new Date(ts).toLocaleString('zh-CN') : '-'}
        </Text>
      ),
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 150,
      render: (action: string) => <Tag color="blue">{action}</Tag>,
    },
    {
      title: '输入',
      dataIndex: 'input',
      key: 'input',
      ellipsis: true,
      render: (input: Record<string, unknown>) =>
        input ? (
          <Text code style={{ fontSize: 11 }}>
            {JSON.stringify(input).slice(0, 100)}
            {JSON.stringify(input).length > 100 ? '...' : ''}
          </Text>
        ) : (
          '-'
        ),
    },
    {
      title: '输出',
      dataIndex: 'output',
      key: 'output',
      ellipsis: true,
      render: (output: Record<string, unknown>) =>
        output ? (
          <Text code style={{ fontSize: 11 }}>
            {JSON.stringify(output).slice(0, 100)}
            {JSON.stringify(output).length > 100 ? '...' : ''}
          </Text>
        ) : (
          '-'
        ),
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 80,
      render: (duration: number) => (duration ? `${duration}ms` : '-'),
    },
    {
      title: '错误',
      dataIndex: 'error',
      key: 'error',
      ellipsis: true,
      render: (error: string) =>
        error ? (
          <Tag color="error">{error.slice(0, 50)}</Tag>
        ) : (
          <Tag color="success">成功</Tag>
        ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: spacing.md }}>
        <Paragraph type="secondary">
          共 {logs.length} 条审计日志
        </Paragraph>
      </div>
      <Table<AuditLogEntry>
        columns={columns}
        dataSource={logs}
        rowKey={(record, index) => `${record.timestamp}-${record.action}-${index}`}
        loading={loading}
        size="small"
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        scroll={{ y: 400 }}
      />
    </div>
  );
};

export default AuditLogViewer;
