/**
 * EditConfirmModal - 编辑确认弹窗
 * 抽取自 index.tsx (P2-9 Phase 124)
 */
import React from 'react';
import { Modal, Typography } from 'antd';
import { spacing } from '@/tokens';
import type { SecretsManagementState } from '../useSecretsManagementState';

const { Text } = Typography;

interface EditConfirmModalProps {
  state: SecretsManagementState;
}

export const EditConfirmModal: React.FC<EditConfirmModalProps> = ({ state }) => {
  const {
    confirmEditVisible,
    editingSecret,
    handleEditConfirm,
    setConfirmEditVisible,
    setEditingSecret,
  } = state;

  return (
    <Modal
      title="确认编辑"
      open={confirmEditVisible}
      onCancel={() => {
        setConfirmEditVisible(false);
        setEditingSecret(null);
      }}
      onOk={handleEditConfirm}
      okText="继续编辑"
      cancelText="取消"
    >
      {editingSecret && (
        <div>
          <Text>
            即将编辑 Secret: <Text strong>{editingSecret.name}</Text>
          </Text>
          <br />
          <Text
            type="secondary"
            style={{ fontSize: 12, marginTop: spacing.sm, display: 'block' }}
          >
            注意：更新 Secret 值后，所有引用该 Secret 的 Pipeline 在下一次运行时将使用新的值。
            旧值将被永久删除。
          </Text>
        </div>
      )}
    </Modal>
  );
};
