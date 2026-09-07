/**
 * ScriptTemplateTab - 脚本模板 Tab
 * 抽取自 BatchExecPage.tsx (P2-9 Phase 112)
 */
import React, { useState, useEffect } from 'react';
import {
  Table,
  type TableProps,
  Button,
  Form,
  Input,
  Select,
  Modal,
  message,
  Empty,
  Typography,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
  type ScriptTemplate as ScriptTemplateType,
  listTemplates,
  createTemplate,
  deleteTemplate,
} from '@/api/visor-exec';
import { spacing } from '@/tokens';
import { buildTemplateColumns } from '../BatchExecColumns';
import { TEMPLATE_CATEGORY_OPTIONS } from '../BatchExecConfig';

const { Text } = Typography;
const { TextArea } = Input;

type ScriptTemplate = ScriptTemplateType;

export const ScriptTemplateTab: React.FC<{ onUseTemplate?: (tpl: ScriptTemplate) => void }> = ({
  onUseTemplate,
}) => {
  const [templates, setTemplates] = useState<ScriptTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const loadTemplates = () => {
    setLoading(true);
    listTemplates()
      .then((res) => {
        const data = res.data as Record<string, unknown> | undefined;
        setTemplates((data?.items ?? []) as ScriptTemplate[]);
      })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : '未知错误';
        message.error(`加载模板列表失败：${msg}`);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const res = await createTemplate({
        name: values.name,
        description: values.description || '',
        content: values.content,
        category: values.category || '自定义',
      });
      const newTpl = res.data as ScriptTemplate;
      setTemplates((prev) => [newTpl, ...prev]);
      message.success('模板创建成功');
      setCreateVisible(false);
      form.resetFields();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      message.success('模板已删除');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '未知错误';
      message.error(`删除失败：${msg}`);
    }
  };

  const handleCopy = (tpl: ScriptTemplate) => {
    navigator.clipboard?.writeText(tpl.content);
    message.success('脚本内容已复制到剪贴板');
  };

  const handleUse = (tpl: ScriptTemplate) => {
    if (onUseTemplate) {
      onUseTemplate(tpl);
    } else {
      message.info(`已选择模板: ${tpl.name}`);
    }
  };

  const templateColumns: TableProps<ScriptTemplate>['columns'] = buildTemplateColumns({
    onUse: handleUse,
    onCopy: handleCopy,
    onDelete: handleDelete,
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Text type="secondary">预定义脚本模板，快速选择常用命令</Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>
          新建模板
        </Button>
      </div>

      <Table
        columns={templateColumns}
        dataSource={templates}
        rowKey="id"
        size="middle"
        loading={loading}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: <Empty description="暂无脚本模板，请创建第一个模板" /> }}
      />

      <Modal
        title="新建脚本模板"
        open={createVisible}
        onCancel={() => setCreateVisible(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="例如：检查磁盘空间" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input placeholder="模板用途描述" />
          </Form.Item>
          <Form.Item label="类别" name="category" initialValue="自定义">
            <Select options={[TEMPLATE_CATEGORY_OPTIONS].slice()} />
          </Form.Item>
          <Form.Item
            label="脚本内容"
            name="content"
            rules={[{ required: true, message: '请输入脚本内容' }]}
          >
            <TextArea
              rows={8}
              placeholder="# 输入命令或脚本内容"
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export type { ScriptTemplate };
