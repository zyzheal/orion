/**
 * PolicyModals - 策略创建/编辑 Modal + 评估 Modal
 * 抽取自 index.tsx (P2-9 Phase 114)
 */
import React from 'react';
import { Modal, Form, Input, Select } from 'antd';
import type { PolicyManagementState } from '../usePolicyManagementState';

interface PolicyModalsProps {
  state: PolicyManagementState;
}

export const PolicyModals: React.FC<PolicyModalsProps> = ({ state }) => {
  const {
    policyModalVisible,
    setPolicyModalVisible,
    editingPolicy,
    setEditingPolicy,
    form,
    handleSavePolicy,
    policySubmitting,
    evaluateModalVisible,
    setEvaluateModalVisible,
    evalForm,
    handleEvaluate,
    evalSubmitting,
    policies,
  } = state;

  return (
    <>
      <Modal
        title={editingPolicy ? '编辑策略' : '创建策略'}
        open={policyModalVisible}
        onCancel={() => {
          setPolicyModalVisible(false);
          setEditingPolicy(null);
        }}
        onOk={() => form.submit()}
        confirmLoading={policySubmitting}
        okText={editingPolicy ? '保存' : '创建'}
        cancelText="取消"
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSavePolicy}>
          <Form.Item name="name" label="策略名称" rules={[{ required: true }]}>
            <Input placeholder="策略名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="策略描述" />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'Security', value: 'security' },
                { label: 'Cost', value: 'cost' },
                { label: 'Quality', value: 'quality' },
                { label: 'Governance', value: 'governance' },
              ]}
            />
          </Form.Item>
          <Form.Item name="severity" label="严重级别" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'Block', value: 'block' },
                { label: 'Warning', value: 'warning' },
                { label: 'Info', value: 'info' },
              ]}
            />
          </Form.Item>
          <Form.Item name="regoPath" label="Rego 路径" rules={[{ required: true }]}>
            <Input placeholder="policies/security/require-mfa.rego" />
          </Form.Item>
          <Form.Item name="gateId" label="关联门禁">
            <Input placeholder="例如: deploy-gate" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="评估策略"
        open={evaluateModalVisible}
        onCancel={() => setEvaluateModalVisible(false)}
        onOk={() => evalForm.submit()}
        confirmLoading={evalSubmitting}
        okText="评估"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={evalForm} layout="vertical" onFinish={handleEvaluate}>
          <Form.Item name="policyId" label="策略" rules={[{ required: true }]}>
            <Select options={policies.map((p) => ({ label: p.name, value: p.id }))} />
          </Form.Item>
          <Form.Item name="input" label="输入上下文 (JSON)">
            <Input.TextArea rows={6} placeholder='{"resource": "deployment", "action": "create"}' />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
