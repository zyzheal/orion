/**
 * TemplateMarket - 低代码模板市场页面
 *
 * 功能：
 * - 浏览所有可用模板（支持分类筛选、搜索）
 * - 查看模板详情
 * - 应用模板创建新流程
 * - 发布流程为新模板
 */

import React, { useState, useEffect } from 'react';
import {
  Typography, Button, Space, Tag, message, Modal, Form, Input, Select,
  Empty, Card, Descriptions, Tooltip, Row, Col, Divider,
} from 'antd';
import {
  AppstoreOutlined, EyeOutlined, PlusOutlined, SearchOutlined, ThunderboltOutlined, ExportOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { lowcodeApi, type LowcodeTemplate, type LowcodeFlow } from '@/api/lowcode';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;

// ==================== Types ====================

interface CreateTemplateInput {
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
}

interface ApplyTemplateInput {
  workflowName: string;
  description?: string;
}

// ==================== Component ====================

const TemplateMarketPage: React.FC = () => {
  const [templates, setTemplates] = useState<LowcodeTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [_page, setPage] = useState(1);
  const [_pageSize] = useState(12);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  // Selected template for detail
  const [selectedTemplate, setSelectedTemplate] = useState<LowcodeTemplate | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // Apply template modal
  const [applyVisible, setApplyVisible] = useState(false);
  const [templateToApply, setTemplateToApply] = useState<LowcodeTemplate | null>(null);
  const [applyForm] = Form.useForm();
  const [applying, setApplying] = useState(false);

  // Create template modal (publish flow as template)
  const [publishVisible, setPublishVisible] = useState(false);
  const [publishForm] = Form.useForm();
  const [publishing, setPublishing] = useState(false);
  const [flows, setFlows] = useState<LowcodeFlow[]>([]);

  // ==================== Load templates ====================

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await lowcodeApi.listTemplates();
      let templates = data || [];
      // Apply filters client-side
      if (categoryFilter) {
        templates = templates.filter((t) => t.category === categoryFilter);
      }
      if (searchText) {
        const lower = searchText.toLowerCase();
        templates = templates.filter(
          (t) =>
            t.name.toLowerCase().includes(lower) ||
            t.description?.toLowerCase().includes(lower) ||
            t.tags?.some((tag) => tag.toLowerCase().includes(lower))
        );
      }
      setTemplates(templates);
      setTotal(templates.length);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '加载模板列表失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [categoryFilter, searchText]);

  // ==================== Load flows for publishing ====================

  const loadFlows = async () => {
    try {
      const result = await lowcodeApi.listFlows();
      setFlows(result.flows || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '加载流程列表失败';
      message.error(msg);
    }
  };

  // ==================== Apply template ====================

  const handleOpenApply = (template: LowcodeTemplate) => {
    setTemplateToApply(template);
    applyForm.resetFields();
    setApplyVisible(true);
  };

  const handleApplyTemplate = async (values: ApplyTemplateInput) => {
    if (!templateToApply) return;
    setApplying(true);
    try {
      await lowcodeApi.applyTemplate(templateToApply.id, {
        workflowName: values.workflowName,
        description: values.description,
      });
      message.success(`流程 "${values.workflowName}" 已创建`);
      setApplyVisible(false);
      setTemplateToApply(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '应用模板失败';
      message.error(msg);
    } finally {
      setApplying(false);
    }
  };

  // ==================== View template detail ====================

  const handleViewDetail = (template: LowcodeTemplate) => {
    setSelectedTemplate(template);
    setDetailVisible(true);
  };

  // ==================== Publish flow as template ====================

  const handleOpenPublish = () => {
    loadFlows();
    publishForm.resetFields();
    setPublishVisible(true);
  };

  const handlePublish = async (values: CreateTemplateInput & { flowId: string }) => {
    setPublishing(true);
    try {
      const flow = flows.find((f) => f.id === values.flowId);
      if (!flow) {
        message.error('请选择流程');
        return;
      }

      await lowcodeApi.createTemplate({
        name: values.name,
        description: values.description || flow.description,
        category: values.category || 'custom',
        definition: {
          nodes: flow.nodes,
          edges: flow.edges,
        },
        tags: values.tags,
      });

      message.success(`模板 "${values.name}" 发布成功`);
      setPublishVisible(false);
      publishForm.resetFields();
      loadTemplates();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '发布模板失败';
      message.error(msg);
    } finally {
      setPublishing(false);
    }
  };

  // ==================== Render template card ====================

  const renderTemplateCard = (template: LowcodeTemplate) => (
    <Card
      key={template.id}
      hoverable
      style={{ borderRadius: 12, height: '100%', display: 'flex', flexDirection: 'column' }}
      cover={
        template.thumbnail ? (
          <div style={{ height: 140, background: `url(${template.thumbnail}) center/cover`, borderRadius: '12px 12px 0 0' }} />
        ) : (
          <div style={{
            height: 100,
            background: `linear-gradient(135deg, ${colors.primary[100]}, ${colors.primary[200]})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <AppstoreOutlined style={{ fontSize: 40, color: colors.primary[500] }} />
          </div>
        )
      }
      actions={[
        <Tooltip title="查看详情">
          <Button type="text" icon={<EyeOutlined />} onClick={() => handleViewDetail(template)} />
        </Tooltip>,
        <Tooltip title="使用模板创建流程">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenApply(template)}>
            使用
          </Button>
        </Tooltip>,
      ]}
    >
      <Card.Meta
        title={
          <Space>
            <span style={{ fontWeight: 600 }}>{template.name}</span>
            {template.category && (
              <Tag color="blue" style={{ marginLeft: 4 }}>{template.category}</Tag>
            )}
          </Space>
        }
        description={
          <div>
            <Typography.Text type="secondary" ellipsis style={{ display: 'block', marginBottom: 4 }}>
              {template.description || '无描述'}
            </Typography.Text>
            <Space size="small">
              {template.tags?.map((tag) => (
                <Tag key={tag} style={{ fontSize: 11 }}>{tag}</Tag>
              ))}
            </Space>
            <Divider style={{ margin: '8px 0' }} />
            <Space size="large" style={{ fontSize: 12, color: colors.neutral[500] }}>
              <span>使用 {template.usageCount || 0} 次</span>
              <span>节点 {(template.definition.nodes || []).length}</span>
              <span>连线 {(template.definition.edges || []).length}</span>
            </Space>
          </div>
        }
      />
    </Card>
  );

  // ==================== Category list ====================

  const categories = Array.from(new Set(templates.map((t) => t.category).filter(Boolean)));

  // ==================== Render ====================

  return (
    <div style={{ padding: spacing.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
        <h2 style={{ marginBottom: 0, fontWeight: 600, color: colors.neutral[900] }}>
          <AppstoreOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          模板市场
        </h2>
        <Button icon={<ExportOutlined />} onClick={handleOpenPublish}>
          发布为模板
        </Button>
      </div>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: spacing.md }}>
        <Row gutter={12} align="middle">
          <Col flex="auto">
            <Space size="middle" wrap>
              <Input
                placeholder="搜索模板名称、描述、标签..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setPage(1); }}
                style={{ width: 300 }}
                allowClear
              />
              <Select
                placeholder="选择分类"
                value={categoryFilter || undefined}
                onChange={(val) => { setCategoryFilter(val || ''); setPage(1); }}
                style={{ width: 150 }}
                allowClear
              >
                {categories.map((cat) => (
                  <Option key={cat} value={cat}>{cat}</Option>
                ))}
              </Select>
              <Typography.Text type="secondary">
                共 {total} 个模板
              </Typography.Text>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Templates grid */}
      <Row gutter={spacing.md}>
        {templates.length === 0 && !loading ? (
          <Col span={24}>
            <Empty description="暂无模板">
              <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenPublish}>
                发布第一个模板
              </Button>
            </Empty>
          </Col>
        ) : (
          templates.map((template) => (
            <Col xs={24} sm={12} lg={8} xl={6} key={template.id}>
              {renderTemplateCard(template)}
            </Col>
          ))
        )}
      </Row>

      {/* Template Detail Modal */}
      <Modal
        title={`模板详情: ${selectedTemplate?.name}`}
        open={detailVisible}
        onCancel={() => { setDetailVisible(false); setSelectedTemplate(null); }}
        width={700}
        footer={
          <Space>
            <Button onClick={() => { setDetailVisible(false); setSelectedTemplate(null); }}>
              关闭
            </Button>
            {selectedTemplate && (
              <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => {
                setDetailVisible(false);
                handleOpenApply(selectedTemplate);
              }}>
                使用此模板
              </Button>
            )}
          </Space>
        }
      >
        {selectedTemplate && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="模板ID">{selectedTemplate.id}</Descriptions.Item>
            <Descriptions.Item label="名称">{selectedTemplate.name}</Descriptions.Item>
            <Descriptions.Item label="描述">{selectedTemplate.description || '无'}</Descriptions.Item>
            <Descriptions.Item label="分类">
              <Tag color="blue">{selectedTemplate.category || '未分类'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="标签">
              <Space>
                {selectedTemplate.tags?.map((tag) => <Tag key={tag}>{tag}</Tag>) || '无'}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="使用次数">{selectedTemplate.usageCount || 0}</Descriptions.Item>
            <Descriptions.Item label="创建人">{selectedTemplate.createdBy}</Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(selectedTemplate.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="节点定义">
              <pre style={{
                maxHeight: 200, overflow: 'auto', background: colors.neutral[100],
                padding: spacing.sm, borderRadius: 8, fontSize: 12,
              }}>
                {JSON.stringify(selectedTemplate.definition.nodes, null, 2)}
              </pre>
            </Descriptions.Item>
            <Descriptions.Item label="连线定义">
              <pre style={{
                maxHeight: 200, overflow: 'auto', background: colors.neutral[100],
                padding: spacing.sm, borderRadius: 8, fontSize: 12,
              }}>
                {JSON.stringify(selectedTemplate.definition.edges, null, 2)}
              </pre>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* Apply Template Modal */}
      <Modal
        title={`应用模板: ${templateToApply?.name}`}
        open={applyVisible}
        onCancel={() => { setApplyVisible(false); setTemplateToApply(null); applyForm.resetFields(); }}
        footer={null}
      >
        <Form form={applyForm} layout="vertical" onFinish={handleApplyTemplate}>
          <Form.Item
            name="workflowName"
            label="新流程名称"
            rules={[{ required: true, message: '请输入新流程名称' }]}
          >
            <Input placeholder="输入新流程的名称" />
          </Form.Item>
          <Form.Item name="description" label="描述（可选）">
            <TextArea placeholder="流程描述" rows={3} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block icon={<PlusOutlined />} loading={applying}>
              创建流程
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Publish Template Modal */}
      <Modal
        title="发布为模板"
        open={publishVisible}
        onCancel={() => { setPublishVisible(false); publishForm.resetFields(); }}
        footer={null}
      >
        <Form form={publishForm} layout="vertical" onFinish={handlePublish}>
          <Form.Item
            name="flowId"
            label="选择流程"
            rules={[{ required: true, message: '请选择要发布为模板的流程' }]}
          >
            <Select placeholder="选择一个已有流程" loading={flows.length === 0}>
              {flows.map((flow) => (
                <Option key={flow.id} value={flow.id}>
                  {flow.name} (v{flow.version})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="name"
            label="模板名称"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="模板名称" />
          </Form.Item>
          <Form.Item name="description" label="模板描述">
            <TextArea placeholder="描述模板的用途和适用场景" rows={3} />
          </Form.Item>
          <Form.Item name="category" label="分类" initialValue="custom">
            <Select>
              <Option value="custom">自定义</Option>
              <Option value="approval">审批流</Option>
              <Option value="data">数据处理</Option>
              <Option value="cicd">CI/CD</Option>
              <Option value="notification">通知</Option>
              <Option value="other">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="输入标签后按回车" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block icon={<ExportOutlined />} loading={publishing}>
              发布模板
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TemplateMarketPage;
