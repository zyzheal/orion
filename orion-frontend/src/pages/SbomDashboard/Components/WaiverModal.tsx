/**
 * SBOM Dashboard waiver modal
 * 抽取自 index.tsx (P2-9 Phase 148)
 */
import React from 'react';
import { Form, Input, Modal, Select } from 'antd';
import type { FormInstance } from 'antd';
import type { SbomWaiverInput } from '../types';
import { WAIVER_SCOPE_OPTIONS } from '../constants';

interface WaiverModalProps {
  open: boolean;
  submitting: boolean;
  form: FormInstance;
  onCancel: () => void;
  onSubmit: (values: SbomWaiverInput) => void;
}

export const WaiverModal: React.FC<WaiverModalProps> = ({
  open,
  submitting,
  form,
  onCancel,
  onSubmit,
}) => (
  <Modal
    title="创建漏洞豁免"
    open={open}
    onCancel={onCancel}
    onOk={() => form.submit()}
    confirmLoading={submitting}
    okText="创建豁免"
    cancelText="取消"
    destroyOnClose
  >
    <Form form={form} layout="vertical" onFinish={onSubmit}>
      <Form.Item name="cveId" label="CVE ID" rules={[{ required: true }]}>
        <Input placeholder="CVE-2024-XXXX" />
      </Form.Item>
      <Form.Item name="packageName" label="包名" rules={[{ required: true }]}>
        <Input placeholder="package-name" />
      </Form.Item>
      <Form.Item name="packageVersion" label="包版本" rules={[{ required: true }]}>
        <Input placeholder="1.0.0" />
      </Form.Item>
      <Form.Item name="reason" label="豁免原因" rules={[{ required: true }]}>
        <Input.TextArea rows={3} placeholder="说明豁免理由..." />
      </Form.Item>
      <Form.Item name="scope" label="范围" rules={[{ required: true }]} initialValue="global">
        <Select options={WAIVER_SCOPE_OPTIONS} />
      </Form.Item>
      <Form.Item name="expiresAt" label="有效期至" rules={[{ required: true }]}>
        <Input type="date" />
      </Form.Item>
    </Form>
  </Modal>
);
