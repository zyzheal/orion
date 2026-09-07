/**
 * RollbackModal - 回滚确认弹窗 (含原因输入)
 * 抽取自 index.tsx (P2-9 Phase 122)
 */
import React from 'react';
import { Modal, Typography, Input, Form } from 'antd';
import { ArrowDownOutlined } from '@ant-design/icons';
import type { ConfigDiffState } from '../useConfigDiffState';

const { Text } = Typography;
const { TextArea } = Input;

interface RollbackModalProps {
  state: ConfigDiffState;
}

export const RollbackModal: React.FC<RollbackModalProps> = ({ state }) => {
  const {
    rollbackOpen,
    rollbackReason,
    rollbackLoading,
    selectedConfig,
    toVersion,
    handleRollback,
    setRollbackOpen,
    setRollbackReason,
  } = state;

  return (
    <Modal
      title="Rollback"
      open={rollbackOpen}
      onCancel={() => setRollbackOpen(false)}
      onOk={handleRollback}
      confirmLoading={rollbackLoading}
      width={500}
    >
      <p>
        <Text>
          Rollback <Text code>{selectedConfig?.key}</Text> to <Text code>v{toVersion}</Text>.
        </Text>
      </p>
      <p>
        <Text type="danger" strong>
          <ArrowDownOutlined />
          This will replace the current configuration with version {toVersion}.
        </Text>
      </p>
      <Form.Item label="Reason" name="reason">
        <TextArea
          rows={3}
          placeholder="Reason for rollback"
          value={rollbackReason}
          onChange={(e) => setRollbackReason(e.target.value)}
        />
      </Form.Item>
    </Modal>
  );
};
