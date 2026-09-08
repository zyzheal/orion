/**
 * I18nManagement TranslationModal
 * 抽取自 index.tsx (P2-9 Phase 197)
 */
import { Form, Input, Modal } from 'antd';

const { TextArea } = Input;

interface TranslationModalProps {
  open: boolean;
  form: import('antd').FormInstance;
  onOk: () => void;
  onCancel: () => void;
}

export const TranslationModal = ({ open, form, onOk, onCancel }: TranslationModalProps) => (
  <Modal title="添加翻译" open={open} onOk={onOk} onCancel={onCancel}>
    <Form form={form} layout="vertical">
      <Form.Item name="namespace" label="命名空间" initialValue="default">
        <Input placeholder="默认为 default" />
      </Form.Item>
      <Form.Item name="key" label="Key" rules={[{ required: true, message: '请输入 Key' }]}>
        <Input placeholder="如 common.button.submit" />
      </Form.Item>
      <Form.Item
        name="value"
        label="Value"
        rules={[{ required: true, message: '请输入翻译值' }]}
      >
        <TextArea rows={3} placeholder="翻译内容" />
      </Form.Item>
    </Form>
  </Modal>
);
