/**
 * Components/Modals.tsx - WorkflowTasks Claim/Complete Modal
 * 抽取自 WorkflowTasks/index.tsx (P2-9 Phase 99)
 */
import React from 'react';
import { Modal, Form, Input, Typography } from 'antd';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Text } = Typography;

interface WorkflowTasksModalsProps {
  claimModalVisible: boolean;
  setClaimModalVisible: (v: boolean) => void;
  claimForm: ReturnType<typeof Form.useForm>[0];
  claimSubmitting: boolean;
  handleClaim: () => Promise<void>;

  completeModalVisible: boolean;
  setCompleteModalVisible: (v: boolean) => void;
  completeForm: ReturnType<typeof Form.useForm>[0];
  completeSubmitting: boolean;
  handleComplete: () => Promise<void>;
  validateFormDataJson: () => void;
}

export const WorkflowTasksModals: React.FC<WorkflowTasksModalsProps> = (props) => {
  const {
    claimModalVisible,
    setClaimModalVisible,
    claimForm,
    claimSubmitting,
    handleClaim,
    completeModalVisible,
    setCompleteModalVisible,
    completeForm,
    completeSubmitting,
    handleComplete,
    validateFormDataJson,
  } = props;

  return (
    <>
      {/* Claim Modal */}
      <Modal
        title="认领任务"
        open={claimModalVisible}
        onCancel={() => setClaimModalVisible(false)}
        onOk={handleClaim}
        confirmLoading={claimSubmitting}
        okText="确认认领"
        width={480}
        destroyOnClose
      >
        <div style={{ marginBottom: spacing.md }}>
          <Text type="secondary">确认要认领此任务吗？认领后您将成为该任务的处理人。</Text>
        </div>
        <Form form={claimForm} layout="vertical">
          <Form.Item name="comment" label="备注 (可选)">
            <Input.TextArea rows={3} placeholder="输入认领备注..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Complete Modal */}
      <Modal
        title="完成任务"
        open={completeModalVisible}
        onCancel={() => setCompleteModalVisible(false)}
        onOk={handleComplete}
        confirmLoading={completeSubmitting}
        okText="确认完成"
        okButtonProps={{
          style: { backgroundColor: colors.success[500], borderColor: colors.success[500] },
        }}
        width={520}
        destroyOnClose
      >
        <div style={{ marginBottom: spacing.md }}>
          <Text type="secondary">完成任务后将唤醒挂起的工作流实例，请填写必要的表单数据。</Text>
        </div>
        <Form form={completeForm} layout="vertical">
          <Form.Item name="formData" label="表单数据 (JSON, 可选)">
            <Input.TextArea
              rows={4}
              placeholder='{"key": "value"}'
              onBlur={validateFormDataJson}
            />
          </Form.Item>
          <Form.Item name="comment" label="完成备注 (可选)">
            <Input.TextArea rows={3} placeholder="输入完成备注..." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
