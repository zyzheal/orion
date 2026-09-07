/**
 * DigitalTwinModals - 数字孪生 3 个创建弹窗
 * 抽取自 index.tsx (P2-9 Phase 116)
 */
import React from 'react';
import { Form, Input, Modal, Select } from 'antd';
import type { DigitalTwinState } from '../useDigitalTwinState';

interface DigitalTwinModalsProps {
  state: DigitalTwinState;
}

export const DigitalTwinModals: React.FC<DigitalTwinModalsProps> = ({ state }) => {
  const {
    twinModalOpen, setTwinModalOpen,
    snapshotModalOpen, setSnapshotModalOpen,
    sandboxModalOpen, setSandboxModalOpen,
    submitting,
    twinForm, snapshotForm, sandboxForm,
    handleSubmitTwin, handleCreateSnapshot, handleSubmitSandbox,
  } = state;

  return (
    <>
      {/* 创建孪生 Modal */}
      <Modal
        title="创建数字孪生"
        open={twinModalOpen}
        onOk={handleSubmitTwin}
        onCancel={() => setTwinModalOpen(false)}
        confirmLoading={submitting}
        destroyOnClose
        okText="创建"
        cancelText="取消"
        width={480}
      >
        <Form form={twinForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：production-mirror" />
          </Form.Item>
          <Form.Item name="environment" label="环境" rules={[{ required: true, message: '请选择环境' }]}>
            <Select
              options={[
                { label: '生产', value: 'production' },
                { label: '预发布', value: 'staging' },
                { label: '测试', value: 'testing' },
                { label: '开发', value: 'development' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 创建快照 Modal */}
      <Modal
        title="创建快照"
        open={snapshotModalOpen}
        onOk={handleCreateSnapshot}
        onCancel={() => setSnapshotModalOpen(false)}
        destroyOnClose
        okText="创建"
        cancelText="取消"
        width={480}
      >
        <Form form={snapshotForm} layout="vertical">
          <Form.Item name="environment" label="环境" rules={[{ required: true, message: '请选择环境' }]}>
            <Select
              options={[
                { label: '生产', value: 'production' },
                { label: '预发布', value: 'staging' },
                { label: '测试', value: 'testing' },
              ]}
            />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} placeholder="快照备注（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 创建沙箱 Modal */}
      <Modal
        title="创建沙箱"
        open={sandboxModalOpen}
        onOk={handleSubmitSandbox}
        onCancel={() => setSandboxModalOpen(false)}
        destroyOnClose
        okText="创建"
        cancelText="取消"
        width={480}
      >
        <Form form={sandboxForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：sandbox-001" />
          </Form.Item>
          <Form.Item name="snapshot_id" label="快照 ID">
            <Input placeholder="基于快照创建（可选）" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="沙箱描述（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
