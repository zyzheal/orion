/**
 * ComplianceScan CreateBaselineModal
 * 抽取自 index.tsx (P2-9 Phase 188)
 */
import { Modal, Form, Input, Select } from 'antd';
import type { FormInstance } from 'antd';
import type { CreateBaselineFormValues } from '../useComplianceScanState';

const { Option } = Select;

interface CreateBaselineModalProps {
  form: FormInstance<CreateBaselineFormValues>;
  open: boolean;
  confirmLoading: boolean;
  onOk: () => void;
  onCancel: () => void;
}

export const CreateBaselineModal = ({
  form,
  open,
  confirmLoading,
  onOk,
  onCancel,
}: CreateBaselineModalProps) => (
  <Modal
    title="新建合规基线"
    open={open}
    confirmLoading={confirmLoading}
    onCancel={onCancel}
    onOk={onOk}
    okText="创建"
    cancelText="取消"
    destroyOnClose
  >
    <Form form={form} layout="vertical">
      <Form.Item label="基线名称" name="name" rules={[{ required: true, message: '请输入基线名称' }]}>
        <Input placeholder="例: OWASP Top 10 2023 基线" />
      </Form.Item>
      <Form.Item label="合规框架" name="framework" rules={[{ required: true, message: '请选择合规框架' }]}>
        <Select placeholder="选择合规框架">
          <Option value="owasp">OWASP Top 10</Option>
          <Option value="cis">CIS Benchmark</Option>
          <Option value="pci">PCI DSS</Option>
          <Option value="hipaa">HIPAA</Option>
          <Option value="soc2">SOC 2</Option>
          <Option value="internal">内部基线</Option>
        </Select>
      </Form.Item>
      <Form.Item label="描述" name="description">
        <Input.TextArea rows={3} placeholder="基线描述说明" />
      </Form.Item>
    </Form>
  </Modal>
);
