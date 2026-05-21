/**
 * Pipeline Template Page
 * Template library management and instantiation wizard
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Modal,
  Form,
  Input,
  Select,
  message,
  Steps,
  Descriptions,
  Drawer,
  Tooltip,
  Popconfirm,
  Table as AntTable,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EyeOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  CopyOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { pipelineTemplatesApi } from '@/api/pipeline-templates';
import { colors } from '@/tokens/colors';
import type { PipelineTemplate } from '@/api/pipeline-templates';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

// ---- Category color map ----

const categoryColorMap: Record<string, string> = {
  'build': 'blue',
  'deploy': 'green',
  'test': 'purple',
  'ci-cd': 'orange',
  'security': 'red',
  'release': 'cyan',
  'default': 'default',
};

const categoryLabelMap: Record<string, string> = {
  'build': '构建',
  'deploy': '部署',
  'test': '测试',
  'ci-cd': 'CI/CD',
  'security': '安全',
  'release': '发布',
};

// ---- Main Component ----

const PipelineTemplatePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<PipelineTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});

  // Create modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // Detail drawer
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PipelineTemplate | null>(null);

  // Instantiate wizard
  const [instantiateModalVisible, setInstantiateModalVisible] = useState(false);
  const [instantiateStep, setInstantiateStep] = useState(0);
  const [instantiateForm] = Form.useForm();
  const [instantiateLoading, setInstantiateLoading] = useState(false);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await pipelineTemplatesApi.list({ page: 1, limit: 100 });
      const raw = res.data?.data;
      setTemplates(Array.isArray(raw) ? raw : []);
    } catch (error: unknown) {
      setTemplates([]);
      message.error(`加载模板列表失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const filteredData = useMemo(() => {
    return templates.filter((t) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !t.name.toLowerCase().includes(q) &&
          !(t.description && t.description.toLowerCase().includes(q))
        )
          return false;
      }
      if (filters.category && filters.category !== 'all' && t.category !== filters.category) return false;
      return true;
    });
  }, [searchQuery, filters, templates]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      await pipelineTemplatesApi.create({
        name: values.name,
        description: values.description,
        category: values.category || 'default',
        yaml_definition: values.yaml_definition,
        tags: values.tags
          ? values.tags.split(',').map((s: string) => s.trim()).filter(Boolean)
          : undefined,
      });
      message.success('模板创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadTemplates();
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
      await pipelineTemplatesApi.delete(id);
      message.success('模板已删除');
      loadTemplates();
    } catch (error: unknown) {
      message.error(`删除失败: ${(error as Error).message}`);
    }
  };

  const openDetail = (t: PipelineTemplate) => {
    setSelectedTemplate(t);
    setDetailDrawerVisible(true);
  };

  const openInstantiateWizard = (t: PipelineTemplate) => {
    setSelectedTemplate(t);
    setInstantiateStep(0);
    instantiateForm.setFieldsValue({ name: `${t.name}-instance` });
    setInstantiateModalVisible(true);
  };

  const handleInstantiate = async () => {
    if (!selectedTemplate) return;
    try {
      const values = await instantiateForm.validateFields();
      setInstantiateLoading(true);
      await pipelineTemplatesApi.instantiate(selectedTemplate.id, {
        name: values.name,
        tenant_id: values.tenant_id,
        project_id: values.project_id,
        params: values.params
          ? (() => {
              try {
                return JSON.parse(values.params);
              } catch {
                return undefined;
              }
            })()
          : undefined,
      });
      message.success('流水线实例化成功');
      setInstantiateModalVisible(false);
      instantiateForm.resetFields();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`实例化失败: ${(error as Error).message}`);
      }
    } finally {
      setInstantiateLoading(false);
    }
  };

  // ---- Table columns ----

  const columns: ColumnsType<PipelineTemplate> = [
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (v: unknown, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => openDetail(record)}>
            <FileTextOutlined style={{ marginRight: 6 }} />
            {String(v)}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {(record.description || '').slice(0, 60)}
            {(record.description || '').length > 60 ? '...' : ''}
          </Text>
        </Space>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (v: string) => (
        <Tag color={categoryColorMap[v] || 'default'}>
          {categoryLabelMap[v] || v}
        </Tag>
      ),
    },
    {
      title: '标签',
      key: 'tags',
      width: 200,
      render: (_, record) => (
        <Space wrap size={2}>
          {record.tags?.map((tag) => <Tag key={tag}>{tag}</Tag>)}
          {(!record.tags || record.tags.length === 0) && <Text type="secondary">-</Text>}
        </Space>
      ),
    },
    {
      title: '可见性',
      dataIndex: 'is_public',
      key: 'is_public',
      width: 80,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '公开' : '私有'}</Tag>,
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      render: (v: number) => <Text>v{v}</Text>,
    },
    {
      title: '创建人',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 120,
      render: (v: unknown) => <Text type="secondary">{(v as string) || '-'}</Text>,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      sorter: (a, b) => dayjs(a.updated_at).valueOf() - dayjs(b.updated_at).valueOf(),
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {v ? dayjs(String(v)).format('YYYY-MM-DD HH:mm:ss') : '-'}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 240,
      render: (_, record) => (
        <Space size="small" wrap>
          <Tooltip title="详情">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
              详情
            </Button>
          </Tooltip>
          <Tooltip title="实例化">
            <Button
              type="link"
              size="small"
              icon={<ThunderboltOutlined />}
              onClick={() => openInstantiateWizard(record)}
            >
              实例化
            </Button>
          </Tooltip>
          <Tooltip title="复制">
            <Button type="link" size="small" icon={<CopyOutlined />}>
              复制
            </Button>
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm
              title="确认删除该模板?"
              description="删除后不可恢复，请确认"
              onConfirm={() => handleDelete(record.id)}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // Instantiate wizard steps
  const instantiateSteps = [
    { title: '基本信息', description: '填写流水线名称和项目' },
    { title: '参数配置', description: '配置模板参数 (可选)' },
    { title: '确认', description: '确认并创建流水线' },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <FileTextOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            流水线模板
          </Title>
          <Text type="secondary">管理流水线模板库，快速实例化流水线</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadTemplates} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            创建模板
          </Button>
        </Space>
      </div>

      {/* Template List */}
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
          <Input.Search
            placeholder="搜索模板名称、描述..."
            onSearch={setSearchQuery}
            style={{ width: 300 }}
            allowClear
          />
          <Select
            placeholder="分类"
            style={{ width: 140 }}
            allowClear
            onChange={(v) => setFilters((prev) => ({ ...prev, category: v || 'all' }))}
            options={[
              { label: '全部', value: 'all' },
              { label: '构建', value: 'build' },
              { label: '部署', value: 'deploy' },
              { label: '测试', value: 'test' },
              { label: 'CI/CD', value: 'ci-cd' },
              { label: '安全', value: 'security' },
              { label: '发布', value: 'release' },
            ]}
          />
        </div>
        <AntTable<PipelineTemplate>
          columns={columns}
          dataSource={filteredData}
          loading={loading}
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 20, showSizeChanger: true, showQuickJumper: true }}
        />
      </Card>

      {/* Create Template Modal */}
      <Modal
        title="创建模板"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
        width={700}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input placeholder="如: standard-java-build" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="模板描述..." />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Select options={[
              { label: '构建', value: 'build' },
              { label: '部署', value: 'deploy' },
              { label: '测试', value: 'test' },
              { label: 'CI/CD', value: 'ci-cd' },
              { label: '安全', value: 'security' },
              { label: '发布', value: 'release' },
            ]} />
          </Form.Item>
          <Form.Item name="tags" label="标签 (逗号分隔)">
            <Input placeholder="如: java, maven, standard" />
          </Form.Item>
          <Form.Item
            name="yaml_definition"
            label="YAML 定义"
            rules={[{ required: true, message: '请输入 YAML 定义' }]}
          >
            <Input.TextArea rows={10} placeholder="pipeline:&#10;  name: ...&#10;  stages: ..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={selectedTemplate ? selectedTemplate.name : '模板详情'}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={800}
        destroyOnClose
      >
        {selectedTemplate && (
          <>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="模板名称">{selectedTemplate.name}</Descriptions.Item>
              <Descriptions.Item label="分类">
                <Tag color={categoryColorMap[selectedTemplate.category]}>
                  {categoryLabelMap[selectedTemplate.category] || selectedTemplate.category}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="可见性">
                <Tag color={selectedTemplate.is_public ? 'green' : 'default'}>
                  {selectedTemplate.is_public ? '公开' : '私有'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="版本">v{selectedTemplate.version}</Descriptions.Item>
              <Descriptions.Item label="创建人">{selectedTemplate.created_by || '-'}</Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {dayjs(selectedTemplate.updated_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="标签" span={2}>
                <Space wrap>
                  {selectedTemplate.tags?.map((tag) => <Tag key={tag}>{tag}</Tag>)}
                </Space>
              </Descriptions.Item>
              {selectedTemplate.description && (
                <Descriptions.Item label="描述" span={2}>{selectedTemplate.description}</Descriptions.Item>
              )}
            </Descriptions>

            {selectedTemplate.yaml_definition && (
              <div style={{ marginTop: 24 }}>
                <Title level={5}>YAML 定义</Title>
                <pre
                  style={{
                    background: '#f5f5f5',
                    padding: 16,
                    borderRadius: 4,
                    fontSize: 13,
                    overflow: 'auto',
                    maxHeight: 400,
                  }}
                >
                  {selectedTemplate.yaml_definition}
                </pre>
              </div>
            )}

            <div style={{ marginTop: 24 }}>
              <Space>
                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  onClick={() => {
                    setDetailDrawerVisible(false);
                    openInstantiateWizard(selectedTemplate);
                  }}
                >
                  实例化
                </Button>
                <Button icon={<CopyOutlined />}>复制模板</Button>
              </Space>
            </div>
          </>
        )}
      </Drawer>

      {/* Instantiate Wizard Modal */}
      <Modal
        title="实例化模板"
        open={instantiateModalVisible}
        onCancel={() => setInstantiateModalVisible(false)}
        footer={
          <Space>
            {instantiateStep > 0 && (
              <Button onClick={() => setInstantiateStep((s) => s - 1)}>上一步</Button>
            )}
            {instantiateStep < 2 && (
              <Button type="primary" onClick={() => setInstantiateStep((s) => s + 1)}>
                下一步
              </Button>
            )}
            {instantiateStep === 2 && (
              <Button type="primary" onClick={handleInstantiate} loading={instantiateLoading}>
                确认创建
              </Button>
            )}
          </Space>
        }
        width={700}
        destroyOnClose
      >
        <Steps current={instantiateStep} items={instantiateSteps} style={{ marginBottom: 24 }} />

        {selectedTemplate && (
          <>
            {/* Step 0: Basic info */}
            {instantiateStep === 0 && (
              <Form form={instantiateForm} layout="vertical">
                <Form.Item name="name" label="流水线名称" rules={[{ required: true, message: '请输入流水线名称' }]}>
                  <Input placeholder="新流水线名称" />
                </Form.Item>
                <Form.Item name="project_id" label="项目 ID">
                  <Input placeholder="如: proj-1" />
                </Form.Item>
                <Form.Item name="tenant_id" label="租户 ID">
                  <Input placeholder="如: tenant-1" />
                </Form.Item>
              </Form>
            )}

            {/* Step 1: Parameters */}
            {instantiateStep === 1 && (
              <Form form={instantiateForm} layout="vertical">
                <Form.Item name="params" label="参数 (JSON 格式)">
                  <Input.TextArea
                    rows={8}
                    placeholder={'{ "image": "openjdk:17", "maven_profile": "prod" }'}
                  />
                </Form.Item>
                <Alert
                  message="模板参数"
                  description="请参考模板 YAML 定义中声明的参数"
                  type="info"
                  showIcon
                />
              </Form>
            )}

            {/* Step 2: Confirm */}
            {instantiateStep === 2 && (
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="模板">{selectedTemplate.name}</Descriptions.Item>
                <Descriptions.Item label="分类">
                  <Tag color={categoryColorMap[selectedTemplate.category]}>
                    {categoryLabelMap[selectedTemplate.category] || selectedTemplate.category}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="流水线名称">
                  {instantiateForm.getFieldValue('name') || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="项目 ID">
                  {instantiateForm.getFieldValue('project_id') || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="参数">
                  <Paragraph copyable style={{ margin: 0 }}>
                    <pre style={{ margin: 0 }}>
                      {instantiateForm.getFieldValue('params') || '{}'}
                    </pre>
                  </Paragraph>
                </Descriptions.Item>
              </Descriptions>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default PipelineTemplatePage;
