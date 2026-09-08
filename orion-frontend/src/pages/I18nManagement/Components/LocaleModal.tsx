/**
 * I18nManagement LocaleModal
 * 抽取自 index.tsx (P2-9 Phase 197)
 */
import { Form, Input, Modal } from 'antd';

interface LocaleModalProps {
  open: boolean;
  form: import('antd').FormInstance;
  onOk: () => void;
  onCancel: () => void;
}

export const LocaleModal = ({ open, form, onOk, onCancel }: LocaleModalProps) => (
  <Modal title="添加语言" open={open} onOk={onOk} onCancel={onCancel}>
    <Form form={form} layout="vertical">
      <Form.Item
        name="code"
        label="语言代码"
        rules={[{ required: true, message: '请输入语言代码' }]}
      >
        <Input placeholder="如 zh-CN, en-US, ja-JP" />
      </Form.Item>
      <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
        <Input placeholder="如 简体中文, English" />
      </Form.Item>
    </Form>
  </Modal>
);
