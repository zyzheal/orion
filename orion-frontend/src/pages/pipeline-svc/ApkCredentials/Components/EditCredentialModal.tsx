/**
 * ApkCredentials edit modal
 * 抽取自 index.tsx (P2-9 Phase 137)
 */
import React from 'react';
import { Modal, Alert, Form } from 'antd';
import { spacing } from '@/tokens';
import { getMarketName } from '../constants';
import { CredentialFormFields } from './CredentialFormFields';

interface EditCredentialModalProps {
  open: boolean;
  submitting: boolean;
  selectedMarket: string;
  onMarketChange: (value: string) => void;
  editingMarket: string;
  form: import('antd').FormInstance;
  onOk: () => void;
  onCancel: () => void;
}

export const EditCredentialModal: React.FC<EditCredentialModalProps> = ({
  open,
  submitting,
  selectedMarket,
  onMarketChange,
  editingMarket,
  form,
  onOk,
  onCancel,
}) => (
  <Modal
    title={`编辑 ${getMarketName(editingMarket)} 凭证`}
    open={open}
    onOk={onOk}
    onCancel={onCancel}
    confirmLoading={submitting}
    width={600}
    okText="更新"
    cancelText="取消"
  >
    <Alert
      message="更新凭证"
      description="请重新填写凭证信息。原有凭证内容无法显示，需要重新输入。更新后原有凭证将失效。"
      type="warning"
      showIcon
      style={{ marginBottom: spacing.md }}
    />

    <Form form={form} layout="vertical" requiredMark>
      <CredentialFormFields
        selectedMarket={selectedMarket}
        onMarketChange={onMarketChange}
        disabledMarket
      />
    </Form>
  </Modal>
);
