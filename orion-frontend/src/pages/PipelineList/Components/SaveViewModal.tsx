/**
 * SaveViewModal - 保存视图 Modal
 * 抽取自 index.tsx (P2-9 Phase 108)
 */
import React from 'react';
import { Modal, Input, Typography } from 'antd';
import type { PipelineListState } from '../usePipelineListState';

const { Text } = Typography;

interface SaveViewModalProps {
  state: PipelineListState;
}

export const SaveViewModal: React.FC<SaveViewModalProps> = ({ state }) => (
  <Modal
    title="保存视图"
    open={state.viewModalVisible}
    onOk={state.handleSaveView}
    onCancel={() => state.setViewModalVisible(false)}
    okText="保存"
    cancelText="取消"
  >
    <div style={{ padding: '16px 0' }}>
      <Text>视图名称</Text>
      <Input
        value={state.viewName}
        onChange={(e) => state.setViewName(e.target.value)}
        placeholder="例如：生产环境活跃 Pipeline"
        style={{ marginTop: 8 }}
        onPressEnter={state.handleSaveView}
      />
    </div>
  </Modal>
);
