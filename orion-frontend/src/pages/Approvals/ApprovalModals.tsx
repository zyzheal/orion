/**
 * ApprovalModals.tsx - Approval Management 2 个 Modal
 * 抽取自 Approvals/index.tsx (P2-9 Phase 56)
 * Create Modal (Form) + Comment Modal (TextArea)
 */
import React from 'react';
import { Modal, Form, Input, Select } from 'antd';
import type { FormInstance } from 'antd';
import { Typography } from 'antd';
const { Text } = Typography;
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

// ============================================================================
// Props
// ============================================================================

export interface ApprovalModalsProps {
  // Create Modal
  createModalVisible: boolean;
  setCreateModalVisible: (v: boolean) => void;
  createForm: FormInstance;
  submitting: boolean;
  handleCreate: () => void | Promise<void>;
  // Comment Modal
  commentModalVisible: boolean;
  setCommentModalVisible: (v: boolean) => void;
  commentAction: 'approve' | 'reject';
  commentText: string;
  setCommentText: (v: string) => void;
  commentSubmitting: boolean;
  handleCommentSubmit: () => void | Promise<void>;
}

// ============================================================================
// Component
// ============================================================================

export const ApprovalModals: React.FC<ApprovalModalsProps> = (props) => {
  const {
    createModalVisible,
    setCreateModalVisible,
    createForm,
    submitting,
    handleCreate,
    commentModalVisible,
    setCommentModalVisible,
    commentAction,
    commentText,
    setCommentText,
    commentSubmitting,
    handleCommentSubmit,
  } = props;

  return (
    <>
      <Modal
        title="创建审批请求"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        onOk={handleCreate}
        confirmLoading={submitting}
        width={600}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="title"
            label="审批标题"
            rules={[{ required: true, message: '请输入审批标题' }]}
          >
            <Input placeholder="如: 生产环境部署审批" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="详细说明审批原因和背景..." />
          </Form.Item>
          <Form.Item name="requesterId" label="申请人">
            <Input placeholder="申请人 ID (默认当前用户)" />
          </Form.Item>
          <Form.Item
            name="approverIds"
            label="审批人列表 (逗号分隔)"
            rules={[{ required: true, message: '请输入审批人列表' }]}
          >
            <Input placeholder="如: tech-lead, ops-manager, security-lead" />
          </Form.Item>
          <Form.Item name="requiredApprovals" label="所需通过数">
            <Input type="number" placeholder="默认 1" min={1} />
          </Form.Item>
          <Form.Item name="metadata" label="资源类型">
            <Select
              placeholder="选择关联资源类型"
              options={[
                { label: '部署 (deployment)', value: 'deployment' },
                { label: '数据库 (database)', value: 'database' },
                { label: '服务 (service)', value: 'service' },
                { label: '安全 (security)', value: 'security' },
                { label: '基础设施 (infrastructure)', value: 'infrastructure' },
                { label: '通用 (generic)', value: 'generic' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={commentAction === 'approve' ? '通过审批' : '拒绝审批'}
        open={commentModalVisible}
        onCancel={() => setCommentModalVisible(false)}
        onOk={handleCommentSubmit}
        confirmLoading={commentSubmitting}
        okText={commentAction === 'approve' ? '通过' : '拒绝'}
        okButtonProps={{
          danger: commentAction === 'reject',
          style:
            commentAction === 'approve'
              ? { backgroundColor: colors.success[500], borderColor: colors.success[500] }
              : undefined,
        }}
      >
        <div style={{ marginBottom: spacing.sm }}>
          <Text type="secondary">
            {commentAction === 'approve'
              ? '确认通过该审批？可填写评论理由（可选）。'
              : '确认拒绝该审批？请填写拒绝理由（可选）。'}
          </Text>
        </div>
        <Input.TextArea
          rows={4}
          placeholder={
            commentAction === 'reject' ? '请输入拒绝理由...' : '请输入评论/理由（可选）...'
          }
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          maxLength={500}
          showCount
        />
      </Modal>
    </>
  );
};
