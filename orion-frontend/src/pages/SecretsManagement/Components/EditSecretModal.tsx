/**
 * EditSecretModal - 编辑 Secret 弹窗
 * 抽取自 index.tsx (P2-9 Phase 124)
 */
import React from 'react';
import { Modal, Form, Input } from 'antd';
import type { SecretsManagementState } from '../useSecretsManagementState';

const { Password } = Input;

interface EditSecretModalProps {
  state: SecretsManagementState;
}

export const EditSecretModal: React.FC<EditSecretModalProps> = ({ state }) => {
  const {
    editModalVisible,
    editingSecret,
    editForm,
    submitting,
    handleEdit,
    setEditModalVisible,
    setEditingSecret,
  } = state;

  return (
    <Modal
      title={`编辑 Secret: ${editingSecret?.name || ''}`}
      open={editModalVisible}
      onCancel={() => {
        setEditModalVisible(false);
        setEditingSecret(null);
        editForm.resetFields();
      }}
      onOk={handleEdit}
      confirmLoading={submitting}
      width={560}
      destroyOnClose
    >
      <Form form={editForm} layout="vertical" autoComplete="off">
        <Form.Item name="value" label="新 Secret 值" extra="留空则不更新 Secret 值">
          <Password
            placeholder="输入新的密钥值（将加密存储）"
            autoComplete="new-password"
            visibilityToggle={false}
          />
        </Form.Item>

        <Form.Item name="description" label="描述">
          <Input.TextArea rows={2} placeholder="描述此 Secret 的用途..." />
        </Form.Item>
      </Form>
    </Modal>
  );
};
