/**
 * ApprovalDetailDrawer.tsx - Approval Detail 抽屉内容
 * 抽取自 Approvals/index.tsx (P2-9 Phase 56)
 * Descriptions + Progress + Approver List + Comments + Metadata + Action Buttons
 */
import React from 'react';
import {
  Space,
  Tag,
  Card,
  Descriptions,
  Progress,
  Avatar,
  Button,
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
  UserOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { Typography } from 'antd';
const { Text, Paragraph } = Typography;
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import type { ApprovalRequest, ApprovalComment } from '@/api/approvals';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { statusColorMap, statusLabelMap, approvalProgress } from './ApprovalColumns';

dayjs.extend(relativeTime);

export interface ApprovalDetailDrawerProps {
  approval: ApprovalRequest | null;
  openCommentModal: (id: string, action: 'approve' | 'reject') => void;
}

export const ApprovalDetailDrawer: React.FC<ApprovalDetailDrawerProps> = ({
  approval: a,
  openCommentModal,
}) => {
  if (!a) return null;

  return (
    <div>
      {/* Basic Info */}
      <Descriptions column={2} bordered size="small">
        <Descriptions.Item label="标题" span={2}>
          {a.title}
        </Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={statusColorMap[a.status]}>{statusLabelMap[a.status]}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="申请人">{a.requesterId}</Descriptions.Item>
        <Descriptions.Item label="所需审批数">{a.requiredApprovals}</Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {dayjs(a.createdAt).format('YYYY-MM-DD HH:mm:ss')}
        </Descriptions.Item>
        <Descriptions.Item label="更新时间" span={2}>
          {dayjs(a.updatedAt).format('YYYY-MM-DD HH:mm:ss')} ({dayjs(a.updatedAt).fromNow()})
        </Descriptions.Item>
        {a.description && (
          <Descriptions.Item label="描述" span={2}>
            <Paragraph style={{ marginBottom: 0 }}>{a.description}</Paragraph>
          </Descriptions.Item>
        )}
      </Descriptions>

      {/* Approval Progress */}
      <Card size="small" title="审批进度" style={{ marginTop: spacing.md }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Progress
            percent={approvalProgress(a)}
            status={
              a.status === 'rejected'
                ? 'exception'
                : a.status === 'approved'
                  ? 'success'
                  : 'active'
            }
            format={() => `${a.approvals.length} / ${a.requiredApprovals}`}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            已获得 {a.approvals.length} 个通过, {a.rejections.length} 个拒绝 (需要{' '}
            {a.requiredApprovals} 个通过)
          </Text>
        </Space>
      </Card>

      {/* Approver List */}
      <Card size="small" title="审批人列表" style={{ marginTop: spacing.md }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {a.approverIds.map((uid: string) => {
            const hasApproved = a.approvals.includes(uid);
            const hasRejected = a.rejections.includes(uid);
            let statusIcon = <ClockCircleOutlined style={{ color: colors.neutral[400] }} />;
            let statusText = '待审批';
            if (hasApproved) {
              statusIcon = <CheckCircleOutlined style={{ color: colors.success[500] }} />;
              statusText = '已通过';
            } else if (hasRejected) {
              statusIcon = <StopOutlined style={{ color: colors.error[400] }} />;
              statusText = '已拒绝';
            }
            return (
              <Space key={uid} style={{ padding: '4px 0' }}>
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
                <Text>{uid}</Text>
                {statusIcon}
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {statusText}
                </Text>
              </Space>
            );
          })}
        </Space>
      </Card>

      {/* Comment History */}
      {a.comments && a.comments.length > 0 && (
        <Card size="small" title="审批评论" style={{ marginTop: spacing.md }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            {a.comments.map((c: ApprovalComment, idx: number) => (
              <div
                key={String(idx)}
                style={{
                  padding: '8px 0',
                  borderBottom:
                    idx < a.comments!.length - 1 ? `1px solid ${colors.neutral[200]}` : 'none',
                }}
              >
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    <Avatar
                      size="small"
                      icon={<UserOutlined />}
                      style={{
                        backgroundColor:
                          c.action === 'approved' ? colors.success[500] : colors.error[400],
                      }}
                    >
                      {c.userId.substring(0, 2)}
                    </Avatar>
                    <Text strong>{c.userId}</Text>
                    <Tag color={c.action === 'approved' ? 'success' : 'error'}>
                      {c.action === 'approved' ? '通过' : '拒绝'}
                    </Tag>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(c.createdAt).fromNow()}
                  </Text>
                </Space>
                {c.comment && (
                  <Text style={{ display: 'block', marginTop: 4, fontSize: 13 }}>
                    {c.comment}
                  </Text>
                )}
              </div>
            ))}
          </Space>
        </Card>
      )}

      {/* Metadata */}
      {a.metadata && Object.keys(a.metadata).length > 0 && (
        <Card size="small" title="元数据" style={{ marginTop: spacing.md }}>
          <Descriptions column={2} size="small">
            {Object.entries(a.metadata).map(([key, value]) => (
              <Descriptions.Item key={key} label={key}>
                {String(value)}
              </Descriptions.Item>
            ))}
          </Descriptions>
        </Card>
      )}

      {/* Action buttons for pending items */}
      {a.status === 'pending' && (
        <Space style={{ marginTop: spacing.md }}>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            style={{ backgroundColor: colors.success[500], borderColor: colors.success[500] }}
            onClick={() => openCommentModal(a.id, 'approve')}
          >
            通过
          </Button>
          <Button
            danger
            icon={<CloseOutlined />}
            onClick={() => openCommentModal(a.id, 'reject')}
          >
            拒绝
          </Button>
        </Space>
      )}
    </div>
  );
};
