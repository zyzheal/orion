/**
 * AgentRunDetailApprovals - 审批记录 Card (per-approval Cards with Badge)
 * 抽取自 index.tsx (P2-9 Phase 120)
 */
import React from 'react';
import { Card, Descriptions, Space, Badge, Typography } from 'antd';
import dayjs from 'dayjs';
import { WarningOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { AgentRunDetailState } from '../useAgentRunDetailState';

const { Text } = Typography;

interface AgentRunDetailApprovalsProps {
  state: AgentRunDetailState;
}

export const AgentRunDetailApprovals: React.FC<AgentRunDetailApprovalsProps> = ({ state }) => {
  const { approvals } = state;

  if (approvals.length === 0) return null;

  return (
    <Card
      title={
        <Space>
          <WarningOutlined style={{ color: colors.warning[500] }} />
          审批记录
        </Space>
      }
      size="small"
      style={{ marginBottom: spacing.lg }}
    >
      {approvals.map((approval) => (
        <Card key={approval.id} size="small" style={{ marginBottom: spacing.sm }}>
          <Descriptions column={2} size="small">
            <Descriptions.Item label="操作">{approval.action}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Badge
                status={
                  approval.status === 'approved'
                    ? 'success'
                    : approval.status === 'rejected'
                      ? 'error'
                      : 'warning'
                }
                text={
                  approval.status === 'approved'
                    ? '已通过'
                    : approval.status === 'rejected'
                      ? '已拒绝'
                      : '待审批'
                }
              />
            </Descriptions.Item>
            <Descriptions.Item label="原因">{approval.reason || '-'}</Descriptions.Item>
            <Descriptions.Item label="审批人">{approval.approvedBy || '-'}</Descriptions.Item>
            {approval.rejectionReason && (
              <Descriptions.Item label="拒绝原因">
                <Text type="danger">{approval.rejectionReason}</Text>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="创建时间">
              {dayjs(approval.createdAt).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      ))}
    </Card>
  );
};
