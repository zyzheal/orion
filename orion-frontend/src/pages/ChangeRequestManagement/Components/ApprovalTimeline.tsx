/**
 * ApprovalTimeline - 审批链时间线
 * 抽取自 index.tsx (P2-9 Phase 110)
 */
import React from 'react';
import { Timeline, Space, Tag, Button, Typography, Empty } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { colors, spacing } from '@/tokens';
import { approvalStatusLabel, approvalStatusColor } from '../config';
import type { ChangeRequestManagementState } from '../useChangeRequestManagementState';

const { Text } = Typography;

interface ApprovalTimelineProps {
  state: ChangeRequestManagementState;
}

export const ApprovalTimeline: React.FC<ApprovalTimelineProps> = ({ state }) => {
  if (state.approvalLoading)
    return <div style={{ textAlign: 'center', padding: spacing.lg }}>加载中...</div>;
  if (state.approvalChain.length === 0) return <Empty description="暂无审批链" />;

  return (
    <Timeline
      items={state.approvalChain.map((approval) => {
        const dotColor =
          approval.status === 'approved'
            ? colors.success[500]
            : approval.status === 'rejected'
              ? colors.error[500]
              : colors.primary[500];
        const roleLabel =
          approval.approverRole === 'supervisor'
            ? '主管'
            : approval.approverRole === 'manager'
              ? '经理'
              : 'CTO';

        return {
          color: dotColor,
          children: (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing.xs,
                }}
              >
                <Space>
                  <Text strong>{roleLabel}</Text>
                  <Tag color={approvalStatusColor[approval.status]}>
                    {approvalStatusLabel[approval.status]}
                  </Tag>
                </Space>
                {approval.status === 'pending' &&
                  state.selectedRequest?.status === 'pending_approval' && (
                    <Space size={4}>
                      <Button
                        type="primary"
                        size="small"
                        icon={<CheckOutlined />}
                        onClick={() => state.handleOpenAction('approve', approval.id)}
                      >
                        通过
                      </Button>
                      <Button
                        danger
                        size="small"
                        icon={<CloseOutlined />}
                        onClick={() => state.handleOpenAction('reject', approval.id)}
                      >
                        拒绝
                      </Button>
                    </Space>
                  )}
              </div>
              {approval.approverId && (
                <Text type="secondary" style={{ display: 'block', fontSize: 13 }}>
                  审批人: {approval.approverId}
                </Text>
              )}
              {approval.comment && (
                <Text
                  type="secondary"
                  style={{ display: 'block', fontSize: 13, marginTop: 4 }}
                >
                  备注: {approval.comment}
                </Text>
              )}
              {approval.decidedAt && (
                <Text
                  type="secondary"
                  style={{ display: 'block', fontSize: 12, marginTop: 4 }}
                >
                  {dayjs(approval.decidedAt).format('YYYY-MM-DD HH:mm')}
                </Text>
              )}
            </div>
          ),
        };
      })}
    />
  );
};
