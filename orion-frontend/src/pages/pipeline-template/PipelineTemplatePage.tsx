/**
 * Pipeline Template Page
 * Workflow 9: Advanced CI/CD - Pipeline template management
 *
 * Features:
 * - Template list with category filtering
 * - Template CRUD operations
 * - Template versioning
 * - Template usage statistics
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import MetricCard from '@/components/MetricCard';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { colors, spacing } from '@/tokens';
import { listPipelineTemplate, createPipelineTemplate, deletePipelineTemplate } from '@/api/pipeline-template';

const { Title, Text } = Typography;

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
  const [templates, setTemplates] = useState<PipelineTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPipelineTemplate();
      const items = (res.data || []).map((t: any) => ({
        id: t.id,
        name: t.name || '',
        description: t.description || '',
        category: t.category || 'custom',
        version: t.version || '1.0.0',
        stages: t.stages ?? 0,
        usageCount: t.usage_count ?? t.usageCount ?? 0,
        createdBy: t.created_by || '',
        createdAt: t.created_at || '',
        updatedAt: t.updated_at || '',
        isPublic: t.is_public ?? false,
      }));
      setTemplates(items);
    } catch {
      message.error('加载模板列表失败');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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
      width: 160,
      render: (_: unknown, record) => (
        <Space size="small">
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

  const handleDelete = async (id: string) => {
    try {
      await deletePipelineTemplate(id);
      message.success('模板已删除');
      loadData();
    } catch {
      message.error('删除模板失败');
    }
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      await createPipelineTemplate({
        name: values.name,
        description: values.description || '',
        category: values.category,
        status: 'active',
      });
      message.success('模板创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
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
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <FileTextOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            <FileTextOutlined style={{ marginRight: spacing[2], color: colors.primary[500] }} />
            Pipeline 模板
          </Title>
          <Text type="secondary">管理和复用 Pipeline 配置模板</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData}>
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
        <div style={{ marginBottom: spacing[4] }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            filters={filterDefinitions}
            searchPlaceholder="搜索模板名称或描述..."
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
          pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 个模板` }}
        />
      </Card>

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