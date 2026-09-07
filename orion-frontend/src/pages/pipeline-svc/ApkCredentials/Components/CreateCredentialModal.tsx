/**
 * ApkCredentials create modal
 * 抽取自 index.tsx (P2-9 Phase 137)
 */
import React from 'react';
import { Modal, Alert, Form } from 'antd';
import { spacing } from '@/tokens';
import { getMarketName } from '../constants';
import { CredentialFormFields } from './CredentialFormFields';

interface CreateCredentialModalProps {
  open: boolean;
  submitting: boolean;
  selectedMarket: string;
  onMarketChange: (value: string) => void;
  marketDisabled: boolean;
  form: import('antd').FormInstance;
  onOk: () => void;
  onCancel: () => void;
}

export const CreateCredentialModal: React.FC<CreateCredentialModalProps> = ({
  open,
  submitting,
  selectedMarket,
  onMarketChange,
  marketDisabled,
  form,
  onOk,
  onCancel,
}) => (
  <Modal
    title={`配置 ${getMarketName(selectedMarket)} 凭证`}
    open={open}
    onOk={onOk}
    onCancel={onCancel}
    confirmLoading={submitting}
    width={600}
    okText="保存"
    cancelText="取消"
  >
    <Alert
      message="使用说明"
      description={`请填写 ${getMarketName(selectedMarket)} 的开发者凭证信息。这些信息将加密存储。`}
      type="info"
      showIcon
      style={{ marginBottom: spacing.md }}
    />

    <Form form={form} layout="vertical" requiredMark>
      <CredentialFormFields
        selectedMarket={selectedMarket}
        onMarketChange={onMarketChange}
        disabledMarket={marketDisabled}
      />
    </Form>
  </Modal>
);
