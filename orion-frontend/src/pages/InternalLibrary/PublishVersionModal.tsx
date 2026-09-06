/**
 * PublishVersionModal.tsx - 发布新版本 Modal
 * 抽取自 InternalLibrary/index.tsx (P2-9 Phase 74)
 */
import React from 'react';
import { Modal, Form, Input, Select } from 'antd';
import type { FormInstance } from 'antd';

interface PublishVersionModalProps {
  visible: boolean;
  form: FormInstance;
  submitting: boolean;
  onCancel: () => void;
  onOk: () => void;
}

export const PublishVersionModal: React.FC<PublishVersionModalProps> = ({
  visible,
  form,
  submitting,
  onCancel,
  onOk,
}) => {
  return (
    <Modal
      title="发布新版本"
      open={visible}
      onCancel={onCancel}
      onOk={onOk}
      confirmLoading={submitting}
      width={520}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="version"
          label="版本号"
          rules={[{ required: true, message: '请输入版本号' }]}
        >
          <Input placeholder="如: 2.4.0" />
        </Form.Item>
        <Form.Item name="status" label="版本状态">
          <Select
            options={[
              { label: 'Snapshot', value: 'snapshot' },
              { label: 'Alpha', value: 'alpha' },
              { label: 'Beta', value: 'beta' },
              { label: 'RC', value: 'rc' },
              { label: 'Stable', value: 'stable' },
            ]}
            defaultValue="stable"
          />
        </Form.Item>
        <Form.Item name="changelog" label="变更说明">
          <Input.TextArea rows={3} placeholder="版本变更说明..." />
        </Form.Item>
        <Form.Item name="artifactId" label="制品 ID">
          <Input placeholder="关联的制品 ID" />
        </Form.Item>
        <Form.Item name="securityScore" label="安全评分">
          <Input type="number" min={0} max={100} placeholder="0-100" />
        </Form.Item>
        <Form.Item name="testCoverage" label="测试覆盖率">
          <Input type="number" min={0} max={100} placeholder="0-100" />
        </Form.Item>
        <Form.Item name="publishedTo" label="发布仓库 (逗号分隔)">
          <Input placeholder="如: npm, maven-central" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
