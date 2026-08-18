/**
 * RAG Admin - RAG 系统管理配置页
 * - Tab 1: 管道配置 (default_top_k, reranker_threshold, max_context_chars, max_retries, mmr_lambda, 各级别预算)
 * - Tab 2: Prompt 模板管理 (name, version, content)
 * - 触发索引重建按钮
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Tabs,
  Form,
  Input,
  InputNumber,
  Table,
  Modal,
  message,
  Empty,
  Spin,
  Popconfirm,
  Row,
  Col,
  Descriptions,
} from 'antd';
import { colors, spacing, componentRadius, shadows } from '@/tokens';
import {
  SettingOutlined,
  FileTextOutlined,
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  getRAGAdminConfig,
  updateRAGAdminConfig,
  getRAGPromptTemplates,
  saveRAGPromptTemplate,
  triggerRAGIndex,
} from '@/api/ai-docs';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ============================================================================
// Types
// ============================================================================

interface RAGConfig {
  default_top_k: number;
  reranker_threshold: number;
  max_context_chars: number;
  max_retries: number;
  mmr_lambda: number;
  daily_budget?: number;
  weekly_budget?: number;
  monthly_budget?: number;
  [key: string]: unknown;
}

interface PromptTemplate {
  id?: string;
  name: string;
  version: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// Constants
// ============================================================================

const CONFIG_FIELDS: Array<{
  key: keyof RAGConfig;
  label: string;
  description: string;
  min?: number;
  max?: number;
  step?: number;
}> = [
  {
    key: 'default_top_k',
    label: '默认 Top-K',
    description: '检索时默认返回的文档数量',
    min: 1,
    max: 100,
    step: 1,
  },
  {
    key: 'reranker_threshold',
    label: '重排序阈值',
    description: '重排序阶段的相关性分数阈值 (0-1)',
    min: 0,
    max: 1,
    step: 0.05,
  },
  {
    key: 'max_context_chars',
    label: '最大上下文字符数',
    description: '提供给 LLM 的上下文最大字符数',
    min: 1000,
    max: 100000,
    step: 500,
  },
  {
    key: 'max_retries',
    label: '最大重试次数',
    description: 'API 调用失败时的最大重试次数',
    min: 0,
    max: 10,
    step: 1,
  },
  {
    key: 'mmr_lambda',
    label: 'MMR Lambda',
    description: '最大边际相关性参数，控制结果多样性 (0-1)',
    min: 0,
    max: 1,
    step: 0.1,
  },
  {
    key: 'daily_budget',
    label: '日预算 (元)',
    description: '每日 API 调用预算上限',
    min: 0,
    max: 10000,
    step: 10,
  },
  {
    key: 'weekly_budget',
    label: '周预算 (元)',
    description: '每周 API 调用预算上限',
    min: 0,
    max: 100000,
    step: 50,
  },
  {
    key: 'monthly_budget',
    label: '月预算 (元)',
    description: '每月 API 调用预算上限',
    min: 0,
    max: 500000,
    step: 100,
  },
];

const DEFAULT_CONFIG: RAGConfig = {
  default_top_k: 5,
  reranker_threshold: 0.3,
  max_context_chars: 15000,
  max_retries: 3,
  mmr_lambda: 0.5,
};

// ============================================================================
// Component
// ============================================================================

const RAGAdminPage: React.FC = () => {
  // ---- State ----
  const [activeTab, setActiveTab] = useState('config');
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [config, setConfig] = useState<RAGConfig | null>(null);
  const [configForm] = Form.useForm();

  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [templateForm] = Form.useForm();
  const [templateSaving, setTemplateSaving] = useState(false);

  const [indexRebuilding, setIndexRebuilding] = useState(false);

  // ---- Load Config ----
  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const res = await getRAGAdminConfig();
      const data = (res.data ?? {}) as RAGConfig;
      setConfig(data);
      configForm.setFieldsValue(data);
    } catch (error: unknown) {
      message.error(`加载配置失败: ${(error as Error).message}`);
      setConfig(DEFAULT_CONFIG);
      configForm.setFieldsValue(DEFAULT_CONFIG);
    } finally {
      setConfigLoading(false);
    }
  }, [configForm]);

  // ---- Load Templates ----
  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await getRAGPromptTemplates();
      const data = res.data;
      const list = Array.isArray(data) ? data : [];
      setTemplates(list);
    } catch (error: unknown) {
      message.error(`加载 Prompt 模板失败: ${(error as Error).message}`);
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
    loadTemplates();
  }, [loadConfig, loadTemplates]);

  // ---- Save Config ----
  const handleSaveConfig = async () => {
    try {
      const values = await configForm.validateFields();
      setConfigSaving(true);
      await updateRAGAdminConfig(values as Record<string, unknown>);
      message.success('配置保存成功');
      setConfig(values as RAGConfig);
    } catch (error: unknown) {
      if ((error as Record<string, unknown>).errorFields) {
        // Validation error, do nothing
        return;
      }
      message.error(`保存配置失败: ${(error as Error).message}`);
    } finally {
      setConfigSaving(false);
    }
  };

  // ---- Template CRUD ----
  const openNewTemplate = () => {
    setEditingTemplate(null);
    templateForm.resetFields();
    setTemplateModalVisible(true);
  };

  const openEditTemplate = (record: PromptTemplate) => {
    setEditingTemplate(record);
    templateForm.setFieldsValue({
      name: record.name,
      version: record.version,
      content: record.content,
    });
    setTemplateModalVisible(true);
  };

  const handleSaveTemplate = async () => {
    try {
      const values = await templateForm.validateFields();
      setTemplateSaving(true);
      await saveRAGPromptTemplate(values as { name: string; version: string; content: string });
      message.success(editingTemplate ? '模板更新成功' : '模板创建成功');
      setTemplateModalVisible(false);
      templateForm.resetFields();
      await loadTemplates();
    } catch (error: unknown) {
      if ((error as Record<string, unknown>).errorFields) {
        return;
      }
      message.error(`保存模板失败: ${(error as Error).message}`);
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleDeleteTemplate = async (_record: PromptTemplate) => {
    // TODO: 后端暂未提供删除模板 API，预留
    message.info('删除功能待实现');
  };

  // ---- Trigger Index Rebuild ----
  const handleTriggerIndex = async () => {
    setIndexRebuilding(true);
    try {
      await triggerRAGIndex();
      message.success('索引重建已触发，请稍后查看结果');
    } catch (error: unknown) {
      message.error(`触发索引重建失败: ${(error as Error).message}`);
    } finally {
      setIndexRebuilding(false);
    }
  };

  // ---- Template Columns ----
  const templateColumns = [
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 120,
      render: (version: string) => <Tag color="blue">{version}</Tag>,
    },
    {
      title: '内容预览',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (content: string) => (
        <Text type="secondary" ellipsis style={{ maxWidth: 400 }}>
          {content}
        </Text>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) =>
        date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: PromptTemplate) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditTemplate(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除此模板？"
            onConfirm={() => handleDeleteTemplate(record)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ---- Config Tab ----
  const renderConfigTab = () => (
    <Spin spinning={configLoading}>
      {config === null && !configLoading ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="加载配置失败"
        >
          <Button onClick={loadConfig}>重新加载</Button>
        </Empty>
      ) : (
        <Form
          form={configForm}
          layout="vertical"
          initialValues={DEFAULT_CONFIG}
          style={{ maxWidth: 700 }}
        >
          <Descriptions
            title="检索参数"
            column={1}
            style={{ marginBottom: spacing.md }}
          />
          <Row gutter={24}>
            {CONFIG_FIELDS.slice(0, 5).map((field) => (
              <Col span={12} key={field.key}>
                <Form.Item
                  name={field.key}
                  label={field.label}
                  tooltip={field.description}
                  rules={[
                    { required: true, message: `请输入${field.label}` },
                    {
                      type: 'number',
                      min: field.min,
                      max: field.max,
                      message: `${field.label} 取值范围为 ${field.min}-${field.max}`,
                    },
                  ]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    placeholder={field.description}
                  />
                </Form.Item>
              </Col>
            ))}
          </Row>

          <Descriptions
            title="预算控制"
            column={1}
            style={{ marginTop: spacing.md, marginBottom: spacing.md }}
          />
          <Row gutter={24}>
            {CONFIG_FIELDS.slice(5).map((field) => (
              <Col span={8} key={field.key}>
                <Form.Item
                  name={field.key}
                  label={field.label}
                  tooltip={field.description}
                  rules={[
                    { required: true, message: `请输入${field.label}` },
                    {
                      type: 'number',
                      min: field.min,
                      max: field.max,
                      message: `${field.label} 取值范围为 ${field.min}-${field.max}`,
                    },
                  ]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    placeholder={field.description}
                    addonAfter="元"
                  />
                </Form.Item>
              </Col>
            ))}
          </Row>

          <Form.Item style={{ marginTop: spacing.lg }}>
            <Space>
              <Button
                type="primary"
                onClick={handleSaveConfig}
                loading={configSaving}
                style={{ height: 36, borderRadius: componentRadius.button.md }}
              >
                保存配置
              </Button>
              <Button
                onClick={() => {
                  if (config) {
                    configForm.setFieldsValue(config);
                  } else {
                    configForm.resetFields();
                  }
                }}
                style={{ height: 36, borderRadius: componentRadius.button.md }}
              >
                重置
              </Button>
              <Popconfirm
                title="确认重建索引？"
                description="重建索引可能需要较长时间，期间检索服务可能受影响。"
                onConfirm={handleTriggerIndex}
                okText="确认重建"
                cancelText="取消"
              >
                <Button
                  icon={<ThunderboltOutlined />}
                  loading={indexRebuilding}
                  style={{
                    height: 36,
                    borderRadius: componentRadius.button.md,
                    borderColor: colors.warning[500],
                    color: colors.warning[500],
                  }}
                >
                  触发索引重建
                </Button>
              </Popconfirm>
            </Space>
          </Form.Item>
        </Form>
      )}
    </Spin>
  );

  // ---- Templates Tab ----
  const renderTemplatesTab = () => (
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
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无 Prompt 模板"
          >
            <Button type="primary" onClick={openNewTemplate}>
              新建模板
            </Button>
          </Empty>
        ) : (
          <Table
            columns={templateColumns}
            dataSource={templates}
            rowKey={(record) => record.id ?? record.name + record.version}
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
        <Form
          form={templateForm}
          layout="vertical"
          style={{ marginTop: spacing.md }}
        >
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

  // ---- Render ----
  return (
    <div style={{ padding: 0 }}>
      {/* Page Header */}
      <div style={{ marginBottom: spacing.lg }}>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <SettingOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          管理配置
        </Title>
        <Text type="secondary">RAG 系统管理配置</Text>
      </div>

      {/* Action Bar */}
      <Card
        style={{
          marginBottom: spacing.md,
          boxShadow: shadows.card,
          borderRadius: componentRadius.card,
        }}
      >
        <Space>
          <ReloadOutlined style={{ color: colors.neutral[500] }} />
          <Text type="secondary">
            配置修改后请点击「保存配置」生效，索引重建可更新知识库检索数据
          </Text>
        </Space>
      </Card>

      {/* Main Tabs */}
      <Card
        style={{
          boxShadow: shadows.card,
          borderRadius: componentRadius.card,
          minHeight: 400,
        }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'config',
              label: (
                <span>
                  <SettingOutlined style={{ marginRight: 6 }} />
                  管道配置
                </span>
              ),
              children: renderConfigTab(),
            },
            {
              key: 'templates',
              label: (
                <span>
                  <FileTextOutlined style={{ marginRight: 6 }} />
                  Prompt 模板管理
                </span>
              ),
              children: renderTemplatesTab(),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default RAGAdminPage;