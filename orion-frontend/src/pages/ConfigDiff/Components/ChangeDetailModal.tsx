/**
 * ChangeDetailModal - 单个变更详情弹窗
 * 抽取自 index.tsx (P2-9 Phase 122)
 */
import React from 'react';
import { Modal, Descriptions, Typography, Tag, Input } from 'antd';
import type { ConfigChange } from '@/api/config';
import { operationColor, operationIcon } from '../constants';

const { Text } = Typography;
const { TextArea } = Input;

interface ChangeDetailModalProps {
  changeDetail: ConfigChange | null;
  onChangeDetail: (detail: ConfigChange | null) => void;
}

export const ChangeDetailModal: React.FC<ChangeDetailModalProps> = ({
  changeDetail,
  onChangeDetail,
}) => (
  <Modal
    title="Change Detail"
    open={!!changeDetail}
    onCancel={() => onChangeDetail(null)}
    footer={null}
  >
    {changeDetail && (
      <Descriptions bordered column={1}>
        <Descriptions.Item label="Path">
          <Text code>{changeDetail.path}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Operation">
          <Tag color={operationColor[changeDetail.operation]}>
            {operationIcon[changeDetail.operation]} {changeDetail.operation.toUpperCase()}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Old Value">
          {changeDetail.oldValue !== undefined && changeDetail.oldValue !== null ? (
            <TextArea
              autoSize={{ minRows: 2, maxRows: 6 }}
              value={
                typeof changeDetail.oldValue === 'string'
                  ? changeDetail.oldValue
                  : JSON.stringify(changeDetail.oldValue, null, 2)
              }
            />
          ) : (
            <Text type="secondary">—</Text>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="New Value">
          {changeDetail.newValue !== undefined && changeDetail.newValue !== null ? (
            <TextArea
              autoSize={{ minRows: 2, maxRows: 6 }}
              value={
                typeof changeDetail.newValue === 'string'
                  ? changeDetail.newValue
                  : JSON.stringify(changeDetail.newValue, null, 2)
              }
            />
          ) : (
            <Text type="secondary">—</Text>
          )}
        </Descriptions.Item>
      </Descriptions>
    )}
  </Modal>
);
