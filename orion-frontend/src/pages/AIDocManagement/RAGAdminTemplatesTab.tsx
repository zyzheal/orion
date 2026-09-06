/**
 * RAGAdminTemplatesTab.tsx - RAG 管理页 Prompt 模板 Tab
 * 抽取自 AIDocManagement/RAGAdmin.tsx (P2-9 Phase 98)
 */
import React, { useMemo } from 'react';
import {
  Button,
  Space,
  Table,
  Modal,
  Form,
  Input,
  Empty,
  Spin,
} from 'antd';
import { PlusOutlined, FileTextOutlined } from '@ant-design/icons';
import { colors, spacing, componentRadius, shadows } from '@/tokens';
import type { PromptTemplate } from './RAGAdminConstants';
import { buildRAGTemplateColumns } from './RAGAdminColumns';

const { TextArea } = Input;

interface RAGAdminTemplatesTabProps {
  templates: PromptTemplate[];
  templatesLoading: boolean;
  templateModalVisible: boolean;
  setTemplateModalVisible: (v: boolean) => void;
  editingTemplate: PromptTemplate | null;
  templateForm: ReturnType<typeof Form.useForm>[0];
  templateSaving: boolean;
  openNewTemplate: () => void;
  openEditTemplate: (record: PromptTemplate) => void;
  handleSaveTemplate: () => Promise<void>;
  handleDeleteTemplate: (record: PromptTemplate) => Promise<void>;
}

export const RAGAdminTemplatesTab: React.FC<RAGAdminTemplatesTabProps> = ({
  templates,
  templatesLoading,
  templateModalVisible,
  setTemplateModalVisible,
  editingTemplate,
  templateForm,
  templateSaving,
  openNewTemplate,
  openEditTemplate,
  handleSaveTemplate,
  handleDeleteTemplate,
}) => {
  const columns = useMemo(
    () => buildRAGTemplateColumns({ onEdit: openEditTemplate, onDelete: handleDeleteTemplate }),
    [openEditTemplate, handleDeleteTemplate],
  );

  return (
    <div>
      <div style={{ marginBottom: spacing.md, textAlign: 'right' }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openNewTemplate}
          style={{ height: 36, borderRadius: componentRadius.button.md }}
        >
          新建模板
        </Button>
      </div>
      <Spin spinning={templatesLoading}>
        {templates.length === 0 && !templatesLoading ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 Prompt 模板">
            <Button type="primary" onClick={openNewTemplate}>
              新建模板
            </Button>
          </Empty>
        ) : (
          <Table
            columns={columns}
            dataSource={templates}
            rowKey={(record: PromptTemplate) => record.id ?? record.name + record.version}
            pagination={false}
            style={{ boxShadow: shadows.card, borderRadius: componentRadius.card }}
          />
        )}
      </Spin>

      {/* Template Create/Edit Modal */}
      <Modal
        title={
          <Space>
            <FileTextOutlined style={{ color: colors.primary[500] }} />
            {editingTemplate ? '编辑 Prompt 模板' : '新建 Prompt 模板'}
          </Space>
        }
        open={templateModalVisible}
        onCancel={() => {
          setTemplateModalVisible(false);
          templateForm.resetFields();
        }}
        onOk={handleSaveTemplate}
        confirmLoading={templateSaving}
        okText={editingTemplate ? '保存' : '创建'}
        cancelText="取消"
        width={640}
        destroyOnClose
        style={{ borderRadius: componentRadius.modal }}
      >
        <Form form={templateForm} layout="vertical" style={{ marginTop: spacing.md }}>
          <Form.Item
            name="name"
            label="模板名称"
            rules={[
              { required: true, message: '请输入模板名称' },
              { max: 100, message: '模板名称不超过 100 个字符' },
            ]}
          >
            <Input placeholder="例如：rag_default_prompt" />
          </Form.Item>
          <Form.Item
            name="version"
            label="版本号"
            rules={[
              { required: true, message: '请输入版本号' },
              { pattern: /^\d+\.\d+\.\d+$/, message: '版本号格式为 x.y.z' },
            ]}
          >
            <Input placeholder="例如：1.0.0" />
          </Form.Item>
          <Form.Item
            name="content"
            label="模板内容"
            rules={[
              { required: true, message: '请输入模板内容' },
              { min: 10, message: '模板内容至少 10 个字符' },
            ]}
            extra="使用 {{variable}} 语法定义变量占位符"
          >
            <TextArea
              rows={8}
              placeholder="请输入 Prompt 模板内容，例如：基于以下上下文回答用户问题：\n\n上下文：{{context}}\n\n问题：{{question}}"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
