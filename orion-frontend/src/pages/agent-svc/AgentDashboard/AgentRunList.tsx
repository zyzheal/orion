/**
 * AgentRunList - Pending approvals and recent runs tables
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Button, Space, Tag } from 'antd';
import { spacing, colors } from '@/tokens';
import { CheckCircleOutlined, CloseCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import type { AgentRun, AgentApproval } from '@/api/agents';
import dayjs from 'dayjs';
import { statusToBadge } from './constants';

const { Text, Title } = Typography;

interface AgentRunListProps {
  runs: AgentRun[];
  approvals: AgentApproval[];
  onApprove: (approval: AgentApproval) => void;
  onReject: (approval: AgentApproval) => void;
}

const AgentRunList: React.FC<AgentRunListProps> = ({ runs, approvals, onApprove, onReject }) => {
  const navigate = useNavigate();

  const runColumns: TableColumn<AgentRun>[] = [
    {
      key: 'id',
      title: '运行 ID',
      dataIndex: 'id',
      width: 120,
      render: (value: unknown) => (
        <Button type="link" size="small" onClick={() => navigate(`/agent-runs/${String(value)}`)}>
          {String(value).slice(0, 8)}...
        </Button>
      ),
    },
    {
      key: 'triggerEvent',
      title: '触发事件',
      dataIndex: 'triggerEvent',
      width: 160,
      render: (value: unknown) => <Tag>{String(value)}</Tag>,
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 160,
      render: (value: unknown) => {
        const status = String(value);
        return <StatusBadge status={statusToBadge[status] || 'unknown'} />;
      },
    },
    {
      key: 'progress',
      title: '进度',
      width: 180,
      render: (_: unknown, record: AgentRun) => (
        <span style={{ fontSize: spacing[3] }}>
          步骤 {record.currentStep}/{record.totalSteps}
        </span>
      ),
    },
    {
      key: 'startedAt',
      title: '开始时间',
      dataIndex: 'startedAt',
      width: 160,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {value ? dayjs(String(value)).format('YYYY-MM-DD HH:mm') : '-'}
        </Text>
      ),
    },
  ];

  const approvalColumns: TableColumn<AgentApproval>[] = [
    {
      key: 'id',
      title: '审批 ID',
      dataIndex: 'id',
      width: 120,
      render: (v: unknown) => (
        <Text code style={{ fontSize: spacing[2] }}>
          {String(v).slice(0, 8)}
        </Text>
      ),
    },
    {
      key: 'agentId',
      title: 'Agent',
      dataIndex: 'agentId',
      width: 120,
      render: (v: unknown) => <Tag color="purple">{String(v).slice(0, 8)}</Tag>,
    },
    {
      key: 'action',
      title: '操作',
      dataIndex: 'action',
      width: 180,
      render: (v: unknown) => <Text strong>{String(v)}</Text>,
    },
    {
      key: 'reason',
      title: '原因',
      dataIndex: 'reason',
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {String(v || '-')}
        </Text>
      ),
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {v ? dayjs(String(v)).format('YYYY-MM-DD HH:mm') : '-'}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 140,
      render: (_v: unknown, record: AgentApproval) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={() => onApprove(record)}
          >
            通过
          </Button>
          <Button
            danger
            size="small"
            icon={<CloseCircleOutlined />}
            onClick={() => onReject(record)}
          >
            拒绝
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      {/* Pending approvals section */}
      {approvals.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <Title level={5} style={{ marginBottom: 12 }}>
            <Space>
              <PauseCircleOutlined style={{ color: colors.warning[500] }} />
              待审批队列 ({approvals.length})
            </Space>
          </Title>
          <Table
            columns={approvalColumns}
            dataSource={approvals}
            rowKey="id"
            size="small"
            striped
          />
        </div>
      )}

      {/* Recent runs table */}
      <Title level={5} style={{ marginBottom: 12, marginTop: 24 }}>
        最近运行
      </Title>
      <Table
        columns={runColumns}
        dataSource={runs}
        rowKey="id"
        size="small"
        striped
        data-testid="recent-runs-table"
      />
    </>
  );
};

export default AgentRunList;
