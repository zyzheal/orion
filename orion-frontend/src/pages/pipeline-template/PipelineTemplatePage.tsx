/**
 * Pipeline Template Page (Workflow 9: Advanced CI/CD)
 *
 * Features:
 * - Template library with category filtering and search
 * - Template detail view with YAML preview
 * - Create/edit template
 * - Instantiate template to create a pipeline
 * - Delete template
 *
 * Backend API: orion-platform-service/src/api/pipeline-template-routes.ts
 * Frontend API: src/api/pipeline-templates.ts
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Space,
  Button,
  message,
  Modal,
  Form,
  Input,
  Select,
  Drawer,
  Tabs,
  Popconfirm,
  Row,
  Col,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  RocketOutlined,
  FolderOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import MetricCard from '@/components/MetricCard';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { colors, spacing } from '@/tokens';
import {
  pipelineTemplatesApi,
  type PipelineTemplate,
} from '@/api/pipeline-templates';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_OPTIONS = [
  { label: '全部', value: 'all' },
  { label: 'CI 构建', value: 'ci-build' },
  { label: 'CD 部署', value: 'cd-deploy' },
  { label: '测试', value: 'testing' },
  { label: '代码质量', value: 'code-quality' },
  { label: '安全扫描', value: 'security' },
  { label: '数据管道', value: 'data-pipeline' },
  { label: '自定义', value: 'custom' },
];

const categoryColor: Record<string, string> = {
  'ci-build': colors.blue[500],
  'cd-deploy': colors.green[500],
  testing: colors.purple[500],
  'code-quality': colors.orange[500],
  security: colors.red[500],
  'data-pipeline': colors.cyan[500],
  custom: colors.neutral[500],
};

const categoryLabel: Record<string, string> = {
  'ci-build': 'CI 构建',
  'cd-deploy': 'CD 部署',
  testing: '测试',
  'code-quality': '代码质量',
  security: '安全扫描',
  'data-pipeline': '数据管道',
  custom: '自定义',
};

// ============================================================================
// Types
// ============================================================================

interface InstantiateFormData {
  name: string;
  params?: Record<string, unknown>;
  projectId?: string;
}

// ============================================================================
// Main Component
// ============================================================================

const PipelineTemplatePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<PipelineTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PipelineTemplate | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [instantiateModalVisible, setInstantiateModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PipelineTemplate | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [instantiateForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // ---- Data Loading ----

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await pipelineTemplatesApi.list();
      setTemplates(Array.isArray(data.data) ? data.data : data.data?.templates || []);
    } catch (error: unknown) {
      message.error(`加载模板列表失败: ${(error as Error).message}`);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // ---- Filtering ----

  const filteredTemplates = templates.filter((t) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const searchable = [t.name, t.description, ...(t.tags || [])].join(' ').toLowerCase();
      if (!searchable.includes(q)) return false;
    }
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
    return true;
  });

  // ---- Stats ----

  const stats = {
    total: templates.length,
    public: templates.filter((t) => t.is_public).length,
    categories: new Set(templates.map((t) => t.category)).size,
  };

  // ---- Actions ----

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      await pipelineTemplatesApi.create({
        name: values.name,
        description: values.description || undefined,
        category: values.category || 'custom',
        yaml_definition: values.yaml_definition,
        tags: values.tags
          ? values.tags.split(',').map((s: string) => s.trim()).filter(Boolean)
          : [],
      });
      message.success('模板创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      await loadTemplates();
    } catch (error: unknown) {
      if (!(error instanceof Error && (error as any).errorFields)) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingTemplate) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      await pipelineTemplatesApi.update(editingTemplate.id, {
        name: values.name,
        description: values.description || null,
        category: values.category,
        yaml_definition: values.yaml_definition,
        tags: values.tags
          ? values.tags.split(',').map((s: string) => s.trim()).filter(Boolean)
          : editingTemplate.tags,
      });
      message.success('模板更新成功');
      setEditModalVisible(false);
      setEditingTemplate(null);
      editForm.resetFields();
      await loadTemplates();
    } catch (error: unknown) {
      if (!(error instanceof Error && (error as any).errorFields)) {
        message.error(`更新失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (template: PipelineTemplate) => {
    try {
      await pipelineTemplatesApi.delete(template.id);
      message.success('模板已删除');
      await loadTemplates();
    } catch (error: unknown) {
      message.error(`删除失败: ${(error as Error).message}`);
    }
  };

  const handleInstantiate = async () => {
    if (!selectedTemplate) return;
    try {
      const values = await instantiateForm.validateFields();
      setSubmitting(true);
      await pipelineTemplatesApi.instantiate(selectedTemplate.id, {
        name: values.name,
        params: values.params ? JSON.parse(values.params) : undefined,
        projectId: values.projectId || undefined,
      });
      message.success('模板实例化成功，流水线已创建');
      setInstantiateModalVisible(false);
      instantiateForm.resetFields();
    } catch (error: unknown) {
      message.error(`实例化失败: ${(error as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (template: PipelineTemplate) => {
    setEditingTemplate(template);
    editForm.setFieldsValue({
      name: template.name,
      description: template.description || '',
      category: template.category,
      yaml_definition: template.yaml_definition,
      tags: (template.tags || []).join(', '),
    });
    setEditModalVisible(true);
  };

  // ---- Table Columns ----

  const columns: ColumnsType<PipelineTemplate> = [
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (text: string, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => handleViewDetail(record)}>
            {text}
          </Text>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.description.substring(0, 50)}
              {record.description.length > 50 ? '...' : ''}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      filters: CATEGORY_OPTIONS.filter((o) => o.value !== 'all').map((o) => ({
        text: o.label,
        value: o.value,
      })),
      onFilter: (value, record) => record.category === value,
      render: (cat: string) => (
        <Tag color={categoryColor[cat] || 'default'}>{categoryLabel[cat] || cat}</Tag>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 200,
      render: (tags: string[]) =>
        (tags || []).slice(0, 3).map((tag) => (
          <Tag key={tag} style={{ marginBottom: 4 }}>
            {tag}
          </Tag>
        )),
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 70,
      sorter: (a, b) => a.version - b.version,
      render: (v: number) => <Tag>v{v}</Tag>,
    },
    {
      title: '可见性',
      key: 'visibility',
      width: 80,
      render: (_: unknown, record) =>
        record.is_public ? (
          <Tag color="green">公开</Tag>
        ) : (
          <Tag color="default">私有</Tag>
        ),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 140,
      sorter: (a, b) => dayjs(a.updated_at).valueOf() - dayjs(b.updated_at).valueOf(),
      render: (value: string) => (
        <Text type="secondary">{dayjs(value).fromNow()}</Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)} />
          </Tooltip>
          <Tooltip title="实例化">
            <Button type="link" size="small" icon={<RocketOutlined />} onClick={() => handleInstantiateTemplate(record)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Popconfirm title="确认删除该模板?" onConfirm={() => handleDelete(record)}>
            <Tooltip title="删除">
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ---- Handlers ----

  const handleViewDetail = (template: PipelineTemplate) => {
    setSelectedTemplate(template);
    setDetailDrawerVisible(true);
  };

  const handleInstantiateTemplate = (template: PipelineTemplate) => {
    setSelectedTemplate(template);
    instantiateForm.setFieldsValue({ name: `${template.name} - 实例` });
    setInstantiateModalVisible(true);
  };

  const filterDefinitions: FilterDefinition[] = [
    {
      key: 'category',
      label: '模板分类',
      options: CATEGORY_OPTIONS,
      placeholder: '按分类筛选',
    },
  ];

  // ---- Render ----

  return (
    <div style={{ padding: 0 }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing[6],
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <FolderOutlined style={{ marginRight: spacing[2], color: colors.blue[500] }} />
            流水线模板库
          </Title>
          <Text type="secondary">
            共 {stats.total} 个模板 · {stats.public} 个公开 · {stats.categories} 个分类
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadTemplates} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              createForm.resetFields();
              setCreateModalVisible(true);
            }}
          >
            创建模板
          </Button>
        </Space>
      </div>

      {/* Stats Cards */}
      <div style={{ marginBottom: spacing[6] }}>
        <Row gutter={spacing[4]}>
          <Col span={8}>
            <MetricCard
              title="模板总数"
              value={stats.total}
              icon={<FolderOutlined style={{ fontSize: 20 }} />}
            />
          </Col>
          <Col span={8}>
            <MetricCard
              title="公开模板"
              value={stats.public}
              color={colors.green[500]}
              icon={<RocketOutlined style={{ fontSize: 20 }} />}
            />
          </Col>
          <Col span={8}>
            <MetricCard
              title="分类数"
              value={stats.categories}
              icon={<FolderOutlined style={{ fontSize: 20 }} />}
            />
          </Col>
        </Row>
      </div>

      {/* Template Table */}
      <Card>
        <div style={{ marginBottom: spacing[4] }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            filters={filterDefinitions}
            searchPlaceholder="搜索模板名称、描述或标签..."
            onFilter={(filters) => {
              if (filters.category) setCategoryFilter(String(filters.category));
            }}
            initialFilters={{ category: 'all' }}
          />
        </div>

        <Table<PipelineTemplate>
          columns={columns}
          dataSource={filteredTemplates}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={{ pageSize: 15, showTotal: (total) => `共 ${total} 个模板` }}
        />
      </Card>

      {/* Detail Drawer */}
      <Drawer
        title={selectedTemplate?.name || '模板详情'}
        width={720}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setSelectedTemplate(null);
        }}
        extra={
          <Space>
            <Button
              icon={<RocketOutlined />}
              onClick={() => {
                setDetailDrawerVisible(false);
                if (selectedTemplate) handleInstantiateTemplate(selectedTemplate);
              }}
            >
              实例化
            </Button>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setDetailDrawerVisible(false);
                if (selectedTemplate) openEdit(selectedTemplate);
              }}
            >
              编辑
            </Button>
          </Space>
        }
      >
        {selectedTemplate && (
          <Tabs
            defaultActiveKey="info"
            items={[
              {
                key: 'info',
                label: '基本信息',
                children: (
                  <div>
                    <p><strong>名称:</strong> {selectedTemplate.name}</p>
                    <p><strong>描述:</strong> {selectedTemplate.description || '-'}</p>
                    <p><strong>分类:</strong> {categoryLabel[selectedTemplate.category] || selectedTemplate.category}</p>
                    <p><strong>版本:</strong> v{selectedTemplate.version}</p>
                    <p><strong>可见性:</strong> {selectedTemplate.is_public ? '公开' : '私有'}</p>
                    <p><strong>创建人:</strong> {selectedTemplate.created_by || '-'}</p>
                    <p><strong>创建时间:</strong> {dayjs(selectedTemplate.created_at).format('YYYY-MM-DD HH:mm')}</p>
                    <p><strong>更新时间:</strong> {dayjs(selectedTemplate.updated_at).format('YYYY-MM-DD HH:mm')}</p>
                    <p><strong>标签:</strong></p>
                    <Space wrap>
                      {(selectedTemplate.tags || []).map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </Space>
                  </div>
                ),
              },
              {
                key: 'yaml',
                label: 'YAML 定义',
                children: (
                  <div>
                    <div
                      style={{
                        background: colors.neutral[50],
                        padding: spacing[4],
                        borderRadius: 4,
                        overflow: 'auto',
                        maxHeight: 500,
                      }}
                    >
                      <pre style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {selectedTemplate.yaml_definition}
                      </pre>
                    </div>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Drawer>

      {/* Create Modal */}
      <Modal
        title="创建流水线模板"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
        width={700}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input placeholder="如: Node.js CI/CD 标准模板" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="模板用途描述..." />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select>
              {CATEGORY_OPTIONS.filter((o) => o.value !== 'all').map((o) => (
                <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="yaml_definition" label="YAML 定义" rules={[{ required: true, message: '请输入 YAML 定义' }]}>
            <TextArea rows={10} placeholder="pipeline:\n  name: ...\n  stages: ..." style={{ fontFamily: 'monospace' }} />
          </Form.Item>
          <Form.Item name="tags" label="标签 (逗号分隔)">
            <Input placeholder="如: nodejs, docker, k8s" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="编辑流水线模板"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingTemplate(null);
        }}
        onOk={handleEdit}
        confirmLoading={submitting}
        width={700}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="模板名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true }]}>
            <Select>
              {CATEGORY_OPTIONS.filter((o) => o.value !== 'all').map((o) => (
                <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="yaml_definition" label="YAML 定义" rules={[{ required: true }]}>
            <TextArea rows={10} style={{ fontFamily: 'monospace' }} />
          </Form.Item>
          <Form.Item name="tags" label="标签 (逗号分隔)">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* Instantiate Modal */}
      <Modal
        title="实例化模板"
        open={instantiateModalVisible}
        onCancel={() => setInstantiateModalVisible(false)}
        onOk={handleInstantiate}
        confirmLoading={submitting}
        width={600}
      >
        {selectedTemplate && (
          <div style={{ marginBottom: spacing[4] }}>
            <Text>正在从模板创建流水线: </Text>
            <Tag color={categoryColor[selectedTemplate.category]}>{selectedTemplate.name}</Tag>
          </div>
        )}
        <Form form={instantiateForm} layout="vertical">
          <Form.Item name="name" label="流水线名称" rules={[{ required: true, message: '请输入流水线名称' }]}>
            <Input placeholder="如: my-project-ci" />
          </Form.Item>
          <Form.Item name="projectId" label="项目 ID">
            <Input placeholder="关联的项目 ID (可选)" />
          </Form.Item>
          <Form.Item name="params" label="参数 (JSON 格式, 可选)">
            <TextArea rows={4} placeholder='{"env": "production", "region": "us-east-1"}' style={{ fontFamily: 'monospace' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PipelineTemplatePage;
