/**
 * FormDesigner create/edit modal
 * 抽取自 index.tsx (P2-9 Phase 161)
 */
import { Modal } from 'antd';
import type { FormInstance } from 'antd';
import { FormFields } from './FormFields';

interface FormModalProps {
  open: boolean;
  editingItem: unknown;
  submitting: boolean;
  activeTab: 'forms' | 'conditions';
  form: FormInstance;
  onOk: () => Promise<void>;
  onCancel: () => void;
}

export const FormModal = ({
  open,
  editingItem,
  submitting,
  activeTab,
  form,
  onOk,
  onCancel,
}: FormModalProps) => (
  <Modal
    title={editingItem ? '编辑' : '新建'}
    open={open}
    onOk={onOk}
    confirmLoading={submitting}
    okText={editingItem ? '保存' : '创建'}
    cancelText="取消"
    onCancel={onCancel}
    width={640}
    destroyOnClose
  >
    <Form form={form} layout="vertical">
      <FormFields activeTab={activeTab} />
    </Form>
  </Modal>
);
