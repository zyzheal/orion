/**
 * columns.tsx - WorkflowTasks 任务表格列
 * 抽取自 WorkflowTasks/index.tsx (P2-9 Phase 99)
 */
import { Space, Tag, Button, Tooltip, Typography } from 'antd';
import { EyeOutlined, CheckOutlined, SendOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { TableColumn } from '@/components/Table';
import type { WorkflowTask } from '@/api/workflow-task';
import { colors } from '@/tokens/colors';
import { statusColorMap, statusLabelMap, priorityColorMap, priorityLabelMap } from './constants';

const { Text } = Typography;

interface WorkflowTasksColumnDeps {
  currentUserId: string;
  openDetail: (task: WorkflowTask) => void;
  openClaimModal: (taskId: string) => void;
  openCompleteModal: (taskId: string) => void;
}

export const buildWorkflowTasksColumns = (
  deps: WorkflowTasksColumnDeps,
): TableColumn<WorkflowTask>[] => {
  const { currentUserId, openDetail, openClaimModal, openCompleteModal } = deps;
  return [
    {
      key: 'title',
      title: '任务标题',
      dataIndex: 'title',
      width: 280,
      render: (v: unknown, record: WorkflowTask) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => openDetail(record)}>
            {String(v)}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            实例: {record.instance_id.substring(0, 8)}... | 节点: {record.node_id}
          </Text>
        </Space>
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: 100,
      render: (_: unknown, record: WorkflowTask) => (
        <Tag color={statusColorMap[record.status] || 'default'}>
          {statusLabelMap[record.status] || record.status}
        </Tag>
      ),
    },
    {
      key: 'priority',
      title: '优先级',
      width: 90,
      render: (_: unknown, record: WorkflowTask) => (
        <Tag color={priorityColorMap[record.priority] || 'default'}>
          {priorityLabelMap[record.priority] || record.priority}
        </Tag>
      ),
    },
    {
      key: 'assignee',
      title: '处理人',
      width: 120,
      render: (_: unknown, record: WorkflowTask) => (
        <Space>
          <UserOutlined style={{ color: colors.neutral[400] }} />
          <Text type="secondary">
            {record.assignee_id || record.candidate_users?.join(', ') || '-'}
          </Text>
        </Space>
      ),
    },
    {
      key: 'dueDate',
      title: '截止时间',
      width: 140,
      render: (v: unknown) => {
        if (!v) return <Text type="secondary">-</Text>;
        const dueDate = dayjs(String(v));
        const isOverdue = dueDate.isBefore(dayjs());
        return (
          <Text type="secondary" style={{ color: isOverdue ? colors.error[500] : undefined }}>
            {dueDate.format('MM-DD HH:mm')}
            {isOverdue && ' (已逾期)'}
          </Text>
        );
      },
    },
    {
      key: 'createdAt',
      title: '创建时间',
      width: 140,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(String(v)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 180,
      render: (_: unknown, record: WorkflowTask) => (
        <Space size="small" wrap>
          <Tooltip title="详情">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
              详情
            </Button>
          </Tooltip>
          {record.status === 'pending' && (
            <Tooltip title="认领任务">
              <Button
                type="link"
                size="small"
                style={{ color: colors.primary[500] }}
                icon={<CheckOutlined />}
                onClick={() => openClaimModal(record.id)}
              >
                认领
              </Button>
            </Tooltip>
          )}
          {record.status === 'assigned' && record.assignee_id === currentUserId && (
            <Tooltip title="完成任务">
              <Button
                type="link"
                size="small"
                style={{ color: colors.success[500] }}
                icon={<SendOutlined />}
                onClick={() => openCompleteModal(record.id)}
              >
                完成
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];
};
