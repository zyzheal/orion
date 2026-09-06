/**
 * DetailDrawer - 审批详情抽屉（描述/步骤/时间线/操作）
 * 抽取自 ApprovalPage.tsx (P2-9 Phase 40)
 */
import React from 'react';
import { Drawer, Descriptions, Tag, Card, Steps, Timeline, Space, Typography, Button } from 'antd';
import {
  CheckCircleOutlined,
  StopOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import dayjs from 'dayjs';
import type { ApprovalRequest, ApprovalComment } from '@/api/approvals';
import { statusColorMap, statusLabelMap } from './constants';
import { getSLAStatus } from './helpers';

const { Text } = Typography;

export interface DetailDrawerProps {
  visible: boolean;
  approval: ApprovalRequest | null;
  onClose: () => void;
  onOpenComment: (id: string, action: 'approve' | 'reject') => void;
}

export const DetailDrawer: React.FC<DetailDrawerProps> = ({
  visible,
  approval,
  onClose,
  onOpenComment,
}) => {
  const content = approval ? (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Descriptions bordered size="small" column={2}>
        <Descriptions.Item label="标题" span={2}>
          {approval.title}
        </Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={statusColorMap[approval.status]}>
            {statusLabelMap[approval.status]}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="SLA">
          {(() => {
            const sla = getSLAStatus(approval);
            return <Tag color={sla.color}>{sla.label}</Tag>;
          })()}
        </Descriptions.Item>
        <Descriptions.Item label="申请人">{approval.requesterId}</Descriptions.Item>
        <Descriptions.Item label="所需审批数">{approval.requiredApprovals}</Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {dayjs(approval.createdAt).format('YYYY-MM-DD HH:mm:ss')}
        </Descriptions.Item>
        <Descriptions.Item label="更新时间" span={2}>
          {dayjs(approval.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
        </Descriptions.Item>
        {approval.description && (
          <Descriptions.Item label="描述" span={2}>
            {approval.description}
          </Descriptions.Item>
        )}
      </Descriptions>

      <Card size="small" title="审批流程">
        <Steps
          current={
            approval.status === 'approved'
              ? approval.approverIds.length
              : approval.approvals.length
          }
          direction="vertical"
          size="small"
        >
          {approval.approverIds.map((uid: string) => {
            const hasApproved = approval.approvals.includes(uid);
            const hasRejected = approval.rejections.includes(uid);
            return (
              <Steps.Step
                key={uid}
                title={uid}
                status={hasRejected ? 'error' : hasApproved ? 'finish' : 'wait'}
                description={hasApproved ? '已通过' : hasRejected ? '已拒绝' : '待审批'}
              />
            );
          })}
        </Steps>
      </Card>

      {approval.comments && approval.comments.length > 0 && (
        <Card size="small" title="审批评论">
          <Timeline>
            {approval.comments.map((c: ApprovalComment, idx: number) => (
              <Timeline.Item
                key={String(idx)}
                color={c.action === 'approved' ? 'green' : 'red'}
                dot={c.action === 'approved' ? <CheckCircleOutlined /> : <StopOutlined />}
              >
                <Text strong>{c.userId}</Text>
                <Tag
                  color={c.action === 'approved' ? 'success' : 'error'}
                  style={{ marginLeft: spacing.sm }}
                >
                  {c.action === 'approved' ? '通过' : '拒绝'}
                </Tag>
                <Text type="secondary" style={{ marginLeft: spacing.sm, fontSize: 12 }}>
                  {dayjs(c.createdAt).fromNow()}
                </Text>
                {c.comment && <div style={{ marginTop: 4 }}>{c.comment}</div>}
              </Timeline.Item>
            ))}
          </Timeline>
        </Card>
      )}

      {approval.status === 'pending' && (
        <Space>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            style={{ backgroundColor: colors.success[500], borderColor: colors.success[500] }}
            onClick={() => onOpenComment(approval.id, 'approve')}
          >
            通过
          </Button>
          <Button
            danger
            icon={<CloseOutlined />}
            onClick={() => onOpenComment(approval.id, 'reject')}
          >
            拒绝
          </Button>
        </Space>
      )}
    </Space>
  ) : null;

  return (
    <Drawer
      title={approval?.title || '审批详情'}
      open={visible}
      onClose={onClose}
      width={720}
      destroyOnClose
    >
      {content}
    </Drawer>
  );
};
