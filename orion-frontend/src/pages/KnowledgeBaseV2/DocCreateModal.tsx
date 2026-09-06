/**
 * DocCreateModal - 新建文档 Modal (含 MarkdownEditor + 模板选择 + 标签)
 * 抽取自 KnowledgeBasePage.tsx (P2-9 Phase 39)
 */
import React, { useState } from 'react';
import { Modal, Form, Input, Select, Button, Space, message } from 'antd';
import { BookOutlined } from '@ant-design/icons';
import MarkdownEditor from '@/components/MarkdownEditor';
import DocumentTagSelector from './components/DocumentTagSelector';
import { TemplatePicker, type DocumentTemplate } from './components/DocumentTemplates';
import type { WikiDocument } from '@/api/pandawiki';

export interface DocCreateModalProps {
  visible: boolean;
  form: ReturnType<typeof Form.useForm>[0];
  submitting: boolean;
  spaceId: string;
  documents: WikiDocument[];
  newDocParentId: string;
  setNewDocParentId: (v: string) => void;
  newDocTags: string[];
  setNewDocTags: (v: string[]) => void;
  editorContent: string;
  setEditorContent: (v: string) => void;
  onOk: () => void;
  onCancel: () => void;
}

export const DocCreateModal: React.FC<DocCreateModalProps> = (props) => {
  const {
    visible, form, submitting,
    spaceId, documents,
    setNewDocParentId,
    newDocTags, setNewDocTags,
    editorContent, setEditorContent,
    onOk, onCancel,
  } = props;

  const [templatePickerVisible, setTemplatePickerVisible] = useState(false);

  return (
    <>
      <Modal
        title="新建文档"
        open={visible}
        onCancel={() => {
          onCancel();
          setNewDocParentId('');
          setNewDocTags([]);
          setEditorContent('');
        }}
        onOk={onOk}
        confirmLoading={submitting}
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="文档标题" rules={[{ required: true, message: '请输入文档标题' }]}>
            <Input placeholder="如: 项目架构说明" />
          </Form.Item>
          <Form.Item name="parentId" label="上级文档">
            <Select
              placeholder="选择上级文档（留空则创建为根文档）"
              allowClear
              onChange={(v) => setNewDocParentId(v || '')}
              options={documents.map((d) => ({ label: d.title, value: d.id }))}
            />
          </Form.Item>
          <Form.Item name="content" label="文档内容">
            <Space style={{ width: '100%', marginBottom: 8 }}>
              <Button
                size="small"
                icon={<BookOutlined />}
                onClick={() => setTemplatePickerVisible(true)}
                disabled={!spaceId}
              >
                选择模板
              </Button>
            </Space>
            <MarkdownEditor
              placeholder="输入文档内容..."
              height="250px"
              content={editorContent}
              onChange={setEditorContent}
            />
          </Form.Item>
          <Form.Item label="标签">
            <DocumentTagSelector
              spaceId={spaceId}
              value={newDocTags}
              onChange={setNewDocTags}
            />
          </Form.Item>
        </Form>
      </Modal>

      <TemplatePicker
        open={templatePickerVisible}
        onClose={() => setTemplatePickerVisible(false)}
        onSelect={(template: DocumentTemplate) => {
          setEditorContent(template.content);
          form.setFieldsValue({ content: template.content });
          setTemplatePickerVisible(false);
          message.success(`已选择模板: ${template.name}`);
        }}
      />
    </>
  );
};
