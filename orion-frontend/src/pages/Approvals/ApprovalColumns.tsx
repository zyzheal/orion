/**
 * ApprovalColumns.tsx - Approval Management 表格列定义
 * 抽取自 Approvals/index.tsx (P2-9 Phase 56)
 * 6 columns + approvalProgress helper + status maps
 */
import { useMemo } from 'react';
import { Space, Tag, Progress, Avatar, Tooltip, Button } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Typography } from 'antd';
const { Text } = Typography;
import type { TableColumn } from '@/components/Table';
import { colors } from '@/tokens/colors';
import type { ApprovalRequest, ApprovalStatus } from '@/api/approvals';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

// ---- Color maps ----

export const statusColorMap: Record<ApprovalStatus, string> = {
  pending: 'processing',
  approved: 'success',
  rejected: 'error',
  cancelled: 'default',
};

export const statusLabelMap: Record<ApprovalStatus, string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已拒绝',
  cancelled: '已取消',
};

// ---- Helper ----

export const approvalProgress = (record: ApprovalRequest): number => {
  if (record.status === 'approved') return 100;
  if (record.status === 'rejected') return 100;
  return Math.round((record.approvals.length / record.requiredApprovals) * 100);
};

// ---- Column hook ----

export interface ApprovalColumnHandlers {
  openCommentModal: (id: string, action: 'approve' | 'reject') => void;
  openDetail: (record: ApprovalRequest) => void;
}

export const useApprovalColumns = (
  handlers: ApprovalColumnHandlers,
): TableColumn<ApprovalRequest>[] => {
  const { openCommentModal, openDetail } = handlers;

  return useMemo<TableColumn<ApprovalRequest>[]>(
    () => [
      {
        key: 'title',
        title: '审批标题',
        dataIndex: 'title',
        width: 260,
        render: (v: unknown, record: ApprovalRequest) => (
          <Space direction="vertical" size={0}>
            <Text strong style={{ cursor: 'pointer' }} onClick={() => openDetail(record)}>
              {String(v)}
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
          <Tag color={statusColorMap[record.status] || 'default'}>
            {statusLabelMap[record.status] || record.status}
          </Tag>
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
                      fontSize: 10,
                    }}
                  >
                    {uid.substring(0, 2)}
                  </Avatar>
                </Tooltip>
              );
            })}
            {record.approverIds.length > 3 && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                +{record.approverIds.length - 3}
              </Text>
            )}
          </Space>
        ),
      },
      {
        key: 'createdAt',
        title: '创建时间',
        dataIndex: 'createdAt',
        width: 140,
        sortable: true,
        render: (v: unknown) => (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(String(v)).fromNow()}
          </Text>
        ),
      },
      {
        key: 'actions',
        title: '操作',
        width: 160,
        render: (_: unknown, record: ApprovalRequest) => (
          <Space size="small" wrap>
            <Tooltip title="详情">
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => openDetail(record)}
              >
                详情
              </Button>
            </Tooltip>
            {record.status === 'pending' && (
              <>
                <Tooltip title="通过">
                  <Button
                    type="link"
                    size="small"
                    style={{ color: colors.success[500] }}
                    icon={<CheckOutlined />}
                    onClick={() => openCommentModal(record.id, 'approve')}
                  >
                    通过
                  </Button>
                </Tooltip>
                <Tooltip title="拒绝">
                  <Button
                    type="link"
                    size="small"
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => openCommentModal(record.id, 'reject')}
                  >
                    拒绝
                  </Button>
                </Tooltip>
              </>
            )}
          </Space>
        ),
      },
    ],
    [openCommentModal, openDetail],
  );
};
