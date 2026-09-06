/**
 * columns.tsx - 表格列定义 (buildApprovalColumns)
 * 抽取自 ApprovalPage.tsx (P2-9 Phase 40)
 */
import { Space, Typography, Tag, Progress, Tooltip, Avatar, Button } from 'antd';
import {
  EyeOutlined,
  CheckOutlined,
  CloseOutlined,
  UserOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { ApprovalRequest } from '@/api/approvals';
import { statusColorMap, statusLabelMap } from './constants';
import { approvalProgress, getSLAStatus } from './helpers';

dayjs.extend(relativeTime);

const { Text } = Typography;

export interface ApprovalColumnsDeps {
  onOpenDetail: (record: ApprovalRequest) => void;
  onOpenComment: (id: string, action: 'approve' | 'reject') => void;
}

export const buildApprovalColumns = ({
  onOpenDetail,
  onOpenComment,
}: ApprovalColumnsDeps) => [
  {
    key: 'title',
    title: '审批标题',
    dataIndex: 'title',
    width: 260,
    render: (_: unknown, record: ApprovalRequest) => (
      <Space direction="vertical" size={0}>
        <Text strong style={{ cursor: 'pointer' }} onClick={() => onOpenDetail(record)}>
          {record.title}
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          申请人: {record.requesterId}
          {record.metadata?.resourceType != null &&
            ` | 类型: ${record.metadata.resourceType as string}`}
        </Text>
      </Space>
    ),
  },
  {
    key: 'status',
    title: '状态',
    width: 100,
    render: (_: unknown, record: ApprovalRequest) => (
      <Tag color={statusColorMap[record.status]}>{statusLabelMap[record.status]}</Tag>
    ),
  },
  {
    key: 'progress',
    title: '审批进度',
    width: 180,
    render: (_: unknown, record: ApprovalRequest) => (
      <Space direction="vertical" size={0} style={{ width: '100%' }}>
        <Progress
          percent={approvalProgress(record)}
          size="small"
          status={
            record.status === 'rejected'
              ? 'exception'
              : record.status === 'approved'
                ? 'success'
                : 'active'
          }
          format={() => `${record.approvals.length}/${record.requiredApprovals}`}
        />
        <Text type="secondary" style={{ fontSize: 11 }}>
          需要 {record.requiredApprovals} 个审批
        </Text>
      </Space>
    ),
  },
  {
    key: 'sla',
    title: 'SLA',
    width: 100,
    render: (_: unknown, record: ApprovalRequest) => {
      const sla = getSLAStatus(record);
      return (
        <Tag color={sla.color}>
          {sla.expired && <StopOutlined />} {sla.label}
        </Tag>
      );
    },
  },
  {
    key: 'approvers',
    title: '审批人',
    width: 200,
    render: (_: unknown, record: ApprovalRequest) => (
      <Space size={4} wrap>
        {record.approverIds.slice(0, 3).map((uid: string) => {
          const hasApproved = record.approvals.includes(uid);
          const hasRejected = record.rejections.includes(uid);
          return (
            <Tooltip
              key={uid}
              title={`${uid}${hasApproved ? ' (已通过)' : hasRejected ? ' (已拒绝)' : ''}`}
            >
              <Avatar
                size="small"
                icon={<UserOutlined />}
                style={{
                  backgroundColor: hasApproved
                    ? colors.success[500]
                    : hasRejected
                      ? colors.error[400]
                      : colors.neutral[300],
                }}
              >
                {uid.substring(0, 2)}
              </Avatar>
            </Tooltip>
          );
        })}
        {record.approverIds.length > 3 && (
          <Text type="secondary">+{record.approverIds.length - 3}</Text>
        )}
      </Space>
    ),
  },
  {
    key: 'createdAt',
    title: '创建时间',
    dataIndex: 'createdAt',
    width: 140,
    render: (v: unknown) => <Text type="secondary">{dayjs(String(v)).fromNow()}</Text>,
  },
  {
    key: 'actions',
    title: '操作',
    width: 160,
    render: (_: unknown, record: ApprovalRequest) => (
      <Space size="small" wrap>
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => onOpenDetail(record)}>
          详情
        </Button>
        {record.status === 'pending' && (
          <>
            <Button
              type="link"
              size="small"
              style={{ color: colors.success[500] }}
              icon={<CheckOutlined />}
              onClick={() => onOpenComment(record.id, 'approve')}
            >
              通过
            </Button>
            <Button
              type="link"
              size="small"
              danger
              icon=<CloseOutlined />
              onClick={() => onOpenComment(record.id, 'reject')}
            >
              拒绝
            </Button>
          </>
        )}
      </Space>
    ),
  },
];
