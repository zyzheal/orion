/**
 * KnowledgeBase Create/Edit Modal (combined)
 * 抽取自 index.tsx (P2-9 Phase 169)
 */
import type { FormInstance } from 'antd';
import { Form, Input, Modal, Select } from 'antd';

const { TextArea } = Input;

interface KnowledgeModalProps {
  open: boolean;
  isEdit: boolean;
  form: FormInstance;
  categories: string[];
  onOk: () => void;
  onCancel: () => void;
}

export const KnowledgeModal = ({
  open,
  isEdit,
  form,
  categories,
  onOk,
  onCancel,
}: KnowledgeModalProps) => (
  <Modal
    title={isEdit ? '编辑知识条目' : '新建知识条目'}
    open={open}
    onOk={onOk}
    onCancel={onCancel}
    width={600}
    destroyOnClose
  >
    <Form form={form} layout="vertical">
      <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
        <Input placeholder={isEdit ? undefined : '知识条目标题'} />
      </Form.Item>
      <Form.Item
        name="category"
        label="分类"
        rules={[{ required: true, message: isEdit ? '请选择分类' : '请选择或输入分类' }]}
      >
        <Select
          showSearch={false}
          placeholder={isEdit ? undefined : '选择或输入新分类'}
          options={categories.map((c) => ({ label: c, value: c }))}
        />
      </Form.Item>
      <Form.Item
        name="content"
        label="内容"
        rules={[{ required: true, message: '请输入内容' }]}
      >
        <TextArea rows={6} placeholder="知识内容..." />
      </Form.Item>
      <Form.Item name="tags" label="标签">
        <Select mode="tags" placeholder="输入标签后回车" />
      </Form.Item>
    </Form>
  </Modal>
);
