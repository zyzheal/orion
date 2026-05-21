/**
 * Pipeline Template Page
 * Workflow 9: Advanced CI/CD - Pipeline template management
 *
 * Features:
 * - Template list with category filtering
 * - Template CRUD operations
 * - Template versioning
 * - Template usage statistics
 * - Template rating and comments
 * - Template detail drawer
 * - Template fork functionality
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Space,
  Button,
  Input,
  Modal,
  Form,
  Select,
  message,
  Row,
  Col,
  Tooltip,
  Popconfirm,
  Drawer,
  Rate,
  Tabs,
  Statistic,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  FileTextOutlined,
  EyeOutlined,
  StarOutlined,
  ForkOutlined,
  AppstoreOutlined,
  TableOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import MetricCard from '@/components/MetricCard';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { colors, spacing } from '@/tokens';
import { pipelineTemplatesApi } from '@/api/pipeline-templates';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

// ============================================================================
// Types
// ============================================================================

interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  category: 'build' | 'test' | 'deploy' | 'integration' | 'custom';
  version: string;
  stages: number;
  usageCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
}

// ============================================================================
// Mock Data
// ============================================================================

const mockTemplates: PipelineTemplate[] = [
  {
    id: 'template-1',
    name: 'Standard Build Pipeline',
    description: 'Standard CI build with lint, test, and artifact stages',
    category: 'build',
    version: '1.2.0',
    stages: 3,
    usageCount: 45,
    createdBy: 'admin',
    createdAt: '2026-01-10T00:00:00Z',
    updatedAt: '2026-04-15T00:00:00Z',
    isPublic: true,
  },
  {
    id: 'template-2',
    name: 'Kubernetes Deploy',
    description: 'Deploy to Kubernetes with canary rollout',
    category: 'deploy',
    version: '2.0.1',
    stages: 5,
    usageCount: 32,
    createdBy: 'admin',
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-04-20T00:00:00Z',
    isPublic: true,
  },
  {
    id: 'template-3',
    name: 'Integration Test Suite',
    description: 'Full integration test with mock services',
    category: 'integration',
    version: '1.0.0',
    stages: 4,
    usageCount: 18,
    createdBy: 'dev-team',
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-15T00:00:00Z',
    isPublic: false,
  },
];

const categoryLabels: Record<string, string> = {
  build: '构建',
  test: '测试',
  deploy: '部署',
  integration: '集成',
  custom: '自定义',
};

const categoryColors: Record<string, string> = {
  build: colors.primary[500],
  test: colors.success[500],
  deploy: colors.warning[500],
  integration: colors.info[500],
  custom: colors.neutral[500],
};

// ============================================================================
// Main Component
// ============================================================================

const PipelineTemplatePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<PipelineTemplate[]>(mockTemplates);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PipelineTemplate | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [createForm] = Form.useForm();

  // Rating state (mock)
  const [ratings, setRatings] = useState<Record<string, number>>({
    'template-1': 4,
    'template-2': 5,
    'template-3': 3,
  });

  // Load templates
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await pipelineTemplatesApi.list();
      if (response.data?.data) {
        setTemplates(response.data.data);
      }
    } catch (error) {
      // Use mock data on error
      console.warn('Using mock template data');
    } finally {
      setLoading(false);
    }
  };

  // Stats
  const stats = useMemo(() => ({
    total: templates.length,
    public: templates.filter((t) => t.isPublic).length,
    totalUsage: templates.reduce((sum, t) => sum + t.usageCount, 0),
  }), [templates]);

  // Filtered templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!t.name.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      return true;
    });
  }, [templates, searchQuery, categoryFilter]);

  // Table columns
  const columns: ColumnsType<PipelineTemplate> = [
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (category: string) => (
        <Tag color={categoryColors[category]}>
          {categoryLabels[category]}
        </Tag>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      render: (text: string) => <Tag>{text}</Tag>,
    },
    {
      title: '阶段数',
      dataIndex: 'stages',
      key: 'stages',
      width: 80,
      render: (num: number) => <Text>{num} 个阶段</Text>,
    },
    {
      title: '使用次数',
      dataIndex: 'usageCount',
      key: 'usageCount',
      width: 100,
      render: (count: number) => <Text type="secondary">{count} 次</Text>,
    },
    {
      title: '公开',
      dataIndex: 'isPublic',
      key: 'isPublic',
      width: 80,
      render: (isPublic: boolean) => (
        <Tag color={isPublic ? 'green' : 'default'}>
          {isPublic ? '公开' : '私有'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedTemplate(record);
                setDetailDrawerVisible(true);
              }}
            />
          </Tooltip>
          <Tooltip title="使用此模板">
            <Button
              type="link"
              size="small"
              icon={<ForkOutlined />}
              onClick={() => handleFork(record)}
            />
          </Tooltip>
          <Tooltip title="复制">
            <Button type="link" size="small" icon={<CopyOutlined />} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />} />
          </Tooltip>
          <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="删除">
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleDelete = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    message.success('模板已删除');
  };

  // Fork template
  const handleFork = async (template: PipelineTemplate) => {
    try {
      const forkedTemplate: PipelineTemplate = {
        ...template,
        id: `template-${Date.now()}`,
        name: `${template.name} (副本)`,
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setTemplates((prev) => [...prev, forkedTemplate]);
      message.success('模板已复制');
    } catch (error) {
      message.error('复制失败');
    }
  };

  // Rate template
  const handleRate = (templateId: string, value: number) => {
    setRatings((prev) => ({ ...prev, [templateId]: value }));
    message.success('评分已更新');
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      const newTemplate: PipelineTemplate = {
        id: `template-${Date.now()}`,
        name: values.name,
        description: values.description || '',
        category: values.category,
        version: '1.0.0',
        stages: 1,
        usageCount: 0,
        createdBy: 'current-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isPublic: values.isPublic ?? false,
      };
      setTemplates((prev) => [...prev, newTemplate]);
      message.success('模板创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
    } catch {
      // Form validation failed
    }
  };

  const filterDefinitions: FilterDefinition[] = [
    {
      key: 'category',
      label: '类别',
      options: [
        { label: '全部', value: 'all' },
        { label: '构建', value: 'build' },
        { label: '测试', value: 'test' },
        { label: '部署', value: 'deploy' },
        { label: '集成', value: 'integration' },
        { label: '自定义', value: 'custom' },
      ],
      placeholder: '按类别筛选',
    },
  ];

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
          <Title level={2} style={{ marginBottom: 8 }}>
            <FileTextOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            <FileTextOutlined style={{ marginRight: spacing[2], color: colors.primary[500] }} />
            Pipeline 模板
          </Title>
          <Text type="secondary">管理和复用 Pipeline 配置模板</Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setLoading(true);
              loadTemplates();
            }}
            loading={loading}
          >
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

      {/* Stats Cards */}
      <Row gutter={spacing[4]} style={{ marginBottom: spacing[6] }}>
        <Col span={8}>
          <MetricCard title="模板总数" value={stats.total} />
        </Col>
        <Col span={8}>
          <MetricCard title="公开模板" value={stats.public} color={colors.success[500]} />
        </Col>
        <Col span={8}>
          <MetricCard title="总使用次数" value={stats.totalUsage} />
        </Col>
      </Row>

      {/* Template Table */}
      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing[4],
          }}
        >
          <SearchFilterBar
            onSearch={setSearchQuery}
            filters={filterDefinitions}
            searchPlaceholder="搜索模板名称或描述..."
            onFilter={(filters) => {
              if (filters.category) setCategoryFilter(String(filters.category));
            }}
            initialFilters={{ category: 'all' }}
          />
          <Space>
            <Tooltip title="表格视图">
              <Button
                type={viewMode === 'table' ? 'primary' : 'default'}
                icon={<TableOutlined />}
                onClick={() => setViewMode('table')}
              />
            </Tooltip>
            <Tooltip title="网格视图">
              <Button
                type={viewMode === 'grid' ? 'primary' : 'default'}
                icon={<AppstoreOutlined />}
                onClick={() => setViewMode('grid')}
              />
            </Tooltip>
          </Space>
        </div>

        {viewMode === 'grid' ? (
          // Grid View
          <Row gutter={[spacing[4], spacing[4]]}>
            {filteredTemplates.map((template) => (
              <Col span={8} key={template.id}>
                <Card
                  hoverable
                  size="small"
                  actions={[
                    <EyeOutlined
                      key="view"
                      onClick={() => {
                        setSelectedTemplate(template);
                        setDetailDrawerVisible(true);
                      }}
                    />,
                    <ForkOutlined
                      key="fork"
                      onClick={() => handleFork(template)}
                    />,
                    <CopyOutlined key="copy" />,
                    <EditOutlined key="edit" />,
                  ]}
                >
                  <Card.Meta
                    avatar={
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 8,
                          background: categoryColors[template.category] || colors.primary[500],
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: 18,
                        }}
                      >
                        {categoryLabels[template.category]?.[0] || 'T'}
                      </div>
                    }
                    title={
                      <Space>
                        <Text strong>{template.name}</Text>
                        <Tag color={template.isPublic ? 'green' : 'default'}>
                          {template.isPublic ? '公开' : '私有'}
                        </Tag>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={spacing[1]}>
                        <Text type="secondary" ellipsis>
                          {template.description || '暂无描述'}
                        </Text>
                        <Space>
                          <Rate
                            disabled
                            defaultValue={ratings[template.id] || 0}
                            style={{ fontSize: 12 }}
                          />
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            ({template.usageCount} 次使用)
                          </Text>
                        </Space>
                      </Space>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
        ) : (
          // Table View
          <Table<PipelineTemplate>
            columns={columns}
            dataSource={filteredTemplates}
            rowKey="id"
            loading={loading}
            size="middle"
            pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 个模板` }}
          />
        )}
      </Card>

      {/* Detail Drawer */}
      <Drawer
        title={
          <Space>
            <FileTextOutlined />
            模板详情
          </Space>
        }
        width={600}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setSelectedTemplate(null);
        }}
        extra={
          <Button
            type="primary"
            icon={<ForkOutlined />}
            onClick={() => selectedTemplate && handleFork(selectedTemplate)}
          >
            使用此模板
          </Button>
        }
      >
        {selectedTemplate && (
          <Tabs
            items={[
              {
                key: 'info',
                label: '基本信息',
                children: (
                  <Space direction="vertical" size={spacing[4]} style={{ width: '100%' }}>
                    <div>
                      <Text type="secondary">模板名称</Text>
                      <br />
                      <Text strong style={{ fontSize: 16 }}>
                        {selectedTemplate.name}
                      </Text>
                    </div>
                    <div>
                      <Text type="secondary">类别</Text>
                      <br />
                      <Tag color={categoryColors[selectedTemplate.category]}>
                        {categoryLabels[selectedTemplate.category]}
                      </Tag>
                    </div>
                    <div>
                      <Text type="secondary">版本</Text>
                      <br />
                      <Tag>{selectedTemplate.version}</Tag>
                    </div>
                    <div>
                      <Text type="secondary">公开状态</Text>
                      <br />
                      <Tag color={selectedTemplate.isPublic ? 'green' : 'default'}>
                        {selectedTemplate.isPublic ? '公开' : '私有'}
                      </Tag>
                    </div>
                    <div>
                      <Text type="secondary">描述</Text>
                      <br />
                      <Paragraph>{selectedTemplate.description || '暂无描述'}</Paragraph>
                    </div>
                    <div>
                      <Text type="secondary">使用次数</Text>
                      <br />
                      <Statistic value={selectedTemplate.usageCount} suffix="次" />
                    </div>
                    <div>
                      <Text type="secondary">创建时间</Text>
                      <br />
                      <Text>{dayjs(selectedTemplate.createdAt).format('YYYY-MM-DD HH:mm')}</Text>
                    </div>
                    <div>
                      <Text type="secondary">更新时间</Text>
                      <br />
                      <Text>{dayjs(selectedTemplate.updatedAt).format('YYYY-MM-DD HH:mm')}</Text>
                    </div>
                  </Space>
                ),
              },
              {
                key: 'rating',
                label: '评分',
                children: (
                  <Space direction="vertical" size={spacing[4]} style={{ width: '100%' }}>
                    <div>
                      <Text type="secondary">给此模板评分</Text>
                      <br />
                      <Rate
                        value={ratings[selectedTemplate.id] || 0}
                        onChange={(value) => handleRate(selectedTemplate.id, value)}
                      />
                    </div>
                    <div>
                      <Text type="secondary">评分统计</Text>
                      <br />
                      <Row gutter={spacing[4]}>
                        <Col span={8}>
                          <Statistic
                            title="平均评分"
                            value={Object.values(ratings).reduce((a, b) => a + b, 0) /
                              (Object.keys(ratings).length || 1)}
                            precision={1}
                            prefix={<StarOutlined />}
                          />
                        </Col>
                        <Col span={8}>
                          <Statistic title="评分次数" value={Object.keys(ratings).length} />
                        </Col>
                      </Row>
                    </div>
                  </Space>
                ),
              },
            ]}
          />
        )}
      </Drawer>

      {/* Create Modal */}
      <Modal
        title="创建 Pipeline 模板"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate}
        width={600}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="模板名称" rules={[{ required: true }]}>
            <Input placeholder="如: Standard Build Pipeline" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="模板用途说明" />
          </Form.Item>
          <Form.Item name="category" label="类别" rules={[{ required: true }]}>
            <Select placeholder="选择类别">
              <Select.Option value="build">构建</Select.Option>
              <Select.Option value="test">测试</Select.Option>
              <Select.Option value="deploy">部署</Select.Option>
              <Select.Option value="integration">集成</Select.Option>
              <Select.Option value="custom">自定义</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="isPublic" label="公开状态" valuePropName="checked" initialValue={false}>
            <Select>
              <Select.Option value={false}>私有</Select.Option>
              <Select.Option value={true}>公开</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PipelineTemplatePage;