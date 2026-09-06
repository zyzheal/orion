/**
 * CommentModal - 通过/拒绝审批评论弹窗
 * 抽取自 ApprovalPage.tsx (P2-9 Phase 40)
 */
import React from 'react';
import { Modal, Input, Typography } from 'antd';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Text } = Typography;

export interface CommentModalProps {
  visible: boolean;
  action: 'approve' | 'reject';
  text: string;
  submitting: boolean;
  onTextChange: (text: string) => void;
  onOk: () => void;
  onCancel: () => void;
}

export const CommentModal: React.FC<CommentModalProps> = ({
  visible,
  action,
  text,
  submitting,
  onTextChange,
  onOk,
  onCancel,
}) => (
  <Modal
    title={action === 'approve' ? '通过审批' : '拒绝审批'}
    open={visible}
    onCancel={onCancel}
    onOk={onOk}
    confirmLoading={submitting}
    okText={action === 'approve' ? '通过' : '拒绝'}
    okButtonProps={{
      danger: action === 'reject',
      style:
        action === 'approve'
          ? { backgroundColor: colors.success[500], borderColor: colors.success[500] }
          : undefined,
    }}
  >
    <div style={{ marginBottom: spacing.sm }}>
      <Text type="secondary">
        {action === 'approve'
          ? '确认通过该审批？可填写评论理由（可选）。'
          : '确认拒绝该审批？请填写拒绝理由（可选）。'}
      </Text>
    </div>
    <Input.TextArea
      rows={4}
      placeholder={action === 'reject' ? '请输入拒绝理由...' : '请输入评论/理由（可选）...'}
      value={text}
      onChange={(e) => onTextChange(e.target.value)}
      maxLength={500}
      showCount
    />
  </Modal>
);
