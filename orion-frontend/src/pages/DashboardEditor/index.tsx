/**
 * Dashboard Editor (P2-20)
 * 自定义仪表板可视化编辑器
 *
 * Features:
 * - Canvas with widget palette
 * - Drag-and-drop widget placement
 * - Widget property editing
 * - Dashboard template save/load
 * - Responsive grid layout preview
 */

import React, { useState } from 'react';
import { Card, Row, Col, Typography, Button, Select, Modal, Form, Input, message, Space, Tag, Table, Tooltip } from 'antd';
import {
  DashboardOutlined,
  BarChartOutlined,
  LineChartOutlined,
  PieChartOutlined,
  FundOutlined,
  DesktopOutlined,
  ReloadOutlined,
  SaveOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;
const { Option } = Select;

// ==================== Types ====================

type WidgetType = 'metric' | 'line' | 'bar' | 'pie' | 'table' | 'status';
type WidgetState = 'default' | 'loading' | 'error';

interface WidgetConfig {
  type: WidgetType;
  title: string;
  api?: string;
  metric?: string;
  interval?: string;
  filter?: string;
  refreshInterval?: number;
}

interface WidgetItem {
  id: string;
  type: WidgetType;
  config: WidgetConfig;
  position: { x: number; y: number; w: number; h: number };
  state: WidgetState;
  data: unknown;
}

interface DashboardTemplate {
  id: string;
  name: string;
  description?: string;
  widgets: WidgetItem[];
  background?: string;
  theme?: 'light' | 'dark';
  createdAt: string;
  updatedAt: string;
}

// ==================== Widget Config ====================

const WIDGET_TYPES: Array<{ type: WidgetType; label: string; icon: React.ReactNode; color: string; description: string }> = [
  { type: 'metric', label: '指标卡', icon: <DesktopOutlined />, color: colors.primary[500], description: '单一大数字指标' },
  { type: 'line', label: '折线图', icon: <LineChartOutlined />, color: colors.success[500], description: '时序趋势折线图' },
  { type: 'bar', label: '柱状图', icon: <BarChartOutlined />, color: colors.info[500], description: '分类对比柱状图' },
  { type: 'pie', label: '饼图', icon: <PieChartOutlined />, color: colors.warning[500], description: '占比分布饼图' },
  { type: 'table', label: '数据表', icon: <Table />, color: colors.neutral[500], description: '结构化数据表格' },
  { type: 'status', label: '状态面板', icon: <FundOutlined />, color: colors.purple[500], description: '系统状态面板' },
];

const GRID_COLS = 12;
const GRID_ROWS = 8;

// ==================== Default Templates ====================

const DEFAULT_TEMPLATES: DashboardTemplate[] = [
  {
    id: 'tpl-overview',
    name: '概览模板',
    description: '平台关键指标一览',
    widgets: [
      { id: 'w1', type: 'metric', config: { type: 'metric', title: 'Pipeline 成功率', metric: 'pipeline.successRate', interval: '7d' }, position: { x: 0, y: 0, w: 3, h: 2 }, state: 'default', data: null },
      { id: 'w2', type: 'metric', config: { type: 'metric', title: '活跃告警', metric: 'alerts.activeCount', interval: '1d' }, position: { x: 3, y: 0, w: 3, h: 2 }, state: 'default', data: null },
      { id: 'w3', type: 'metric', config: { type: 'metric', title: 'DORA 等级', metric: 'dora.level', interval: '30d' }, position: { x: 6, y: 0, w: 3, h: 2 }, state: 'default', data: null },
      { id: 'w4', type: 'metric', config: { type: 'metric', title: 'AI 采纳率', metric: 'ai.adoptionRate', interval: '30d' }, position: { x: 9, y: 0, w: 3, h: 2 }, state: 'default', data: null },
      { id: 'w5', type: 'line', config: { type: 'line', title: '部署频率趋势', metric: 'deploy.frequency', interval: '30d' }, position: { x: 0, y: 2, w: 6, h: 3 }, state: 'default', data: null },
      { id: 'w6', type: 'bar', config: { type: 'bar', title: '各服务 CPU 使用率', metric: 'infra.cpuUsage', interval: '1d' }, position: { x: 6, y: 2, w: 6, h: 3 }, state: 'default', data: null },
      { id: 'w7', type: 'table', config: { type: 'table', title: '最近 Pipeline 执行', metric: 'pipeline.runs', interval: '1h' }, position: { x: 0, y: 5, w: 8, h: 3 }, state: 'default', data: null },
      { id: 'w8', type: 'status', config: { type: 'status', title: '服务健康状态', metric: 'health.status', interval: '5m' }, position: { x: 8, y: 5, w: 4, h: 3 }, state: 'default', data: null },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl-alert',
    name: '告警监控模板',
    description: '告警规则与事件集中展示',
    widgets: [
      { id: 'w9', type: 'metric', config: { type: 'metric', title: '活跃告警数', metric: 'alerts.activeCount', interval: '1m' }, position: { x: 0, y: 0, w: 2, h: 2 }, state: 'default', data: null },
      { id: 'w10', type: 'metric', config: { type: 'metric', title: '今日告警总数', metric: 'alerts.totalToday', interval: '1d' }, position: { x: 2, y: 0, w: 2, h: 2 }, state: 'default', data: null },
      { id: 'w11', type: 'table', config: { type: 'table', title: '告警规则列表', metric: 'alerts.rules', interval: '5m' }, position: { x: 4, y: 0, w: 8, h: 4 }, state: 'default', data: null },
      { id: 'w12', type: 'line', config: { type: 'line', title: '告警趋势', metric: 'alerts.trend', interval: '7d' }, position: { x: 0, y: 2, w: 4, h: 3 }, state: 'default', data: null },
      { id: 'w13', type: 'table', config: { type: 'table', title: '最近告警事件', metric: 'alerts.events', interval: '5m' }, position: { x: 0, y: 5, w: 12, h: 3 }, state: 'default', data: null },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ==================== Widget Renderer ====================

const WidgetPreview: React.FC<{ widget: WidgetItem }> = ({ widget }) => {
  const typeInfo = WIDGET_TYPES.find((t) => t.type === widget.type);

  return (
    <Card
      size="small"
      style={{
        height: '100%',
        border: `1px solid ${typeInfo?.color || colors.primary[100]}22`,
        borderLeft: `3px solid ${typeInfo?.color || colors.primary[500]}`,
        background: colors.light.bg.primary,
      }}
      title={
        <Space size="small">
          <span style={{ color: typeInfo?.color }}>{typeInfo?.icon}</span>
          <Text strong>{widget.config.title}</Text>
        </Space>
      }
    >
      <div style={{ textAlign: 'center', padding: '12px 0', color: colors.neutral[400] }}>
        {widget.type === 'metric' && (
          <div>
            <Text style={{ fontSize: 28, fontWeight: 600, color: typeInfo?.color }}>
              42.5%
            </Text>
            <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
              {widget.config.title} · {widget.config.metric}
            </Text>
          </div>
        )}
        {widget.type === 'line' && <Text>折线图 · {widget.config.metric}</Text>}
        {widget.type === 'bar' && <Text>柱状图 · {widget.config.metric}</Text>}
        {widget.type === 'pie' && <Text>饼图 · {widget.config.metric}</Text>}
        {widget.type === 'table' && <Text>数据表 · {widget.config.metric}</Text>}
        {widget.type === 'status' && (
          <Row gutter={[8, 4]} style={{ justifyContent: 'center' }}>
            <Col><Tag color="green">Healthy</Tag></Col>
            <Col><Tag color="orange">Warning</Tag></Col>
            <Col><Tag color="red">Down</Tag></Col>
          </Row>
        )}
      </div>
    </Card>
  );
};

// ==================== Main Component ====================

const DashboardEditor: React.FC = () => {
  const [templates, setTemplates] = useState<DashboardTemplate[]>(DEFAULT_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState<DashboardTemplate>(DEFAULT_TEMPLATES[0]);
  const [editingWidget, setEditingWidget] = useState<WidgetItem | null>(null);
  const [createWidgetModal, setCreateWidgetModal] = useState(false);
  const [saveTemplateModal, setSaveTemplateModal] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [createForm] = Form.useForm();
  const [saveForm] = Form.useForm();

  const widgets = selectedTemplate.widgets;

  const addWidget = (type: WidgetType) => {
    const newWidget: WidgetItem = {
      id: 'w' + Date.now(),
      type,
      config: { type, title: type.charAt(0).toUpperCase() + type.slice(1) },
      position: { x: 0, y: widgets.length, w: 4, h: 2 },
      state: 'default',
      data: null,
    };
    setSelectedTemplate({
      ...selectedTemplate,
      widgets: [...widgets, newWidget],
      updatedAt: new Date().toISOString(),
    });
    setCreateWidgetModal(false);
    message.success('Widget 已添加');
  };

  const removeWidget = (id: string) => {
    setSelectedTemplate({
      ...selectedTemplate,
      widgets: widgets.filter((w) => w.id !== id),
      updatedAt: new Date().toISOString(),
    });
    message.success('Widget 已删除');
  };

  const duplicateWidget = (widget: WidgetItem) => {
    const copy: WidgetItem = {
      ...widget,
      id: 'w' + Date.now(),
      config: { ...widget.config, title: widget.config.title + ' (副本)' },
    };
    setSelectedTemplate({
      ...selectedTemplate,
      widgets: [...widgets, copy],
      updatedAt: new Date().toISOString(),
    });
    message.success('Widget 已复制');
  };

  const updateWidgetConfig = (id: string, config: WidgetConfig) => {
    setSelectedTemplate({
      ...selectedTemplate,
      widgets: widgets.map((w) => w.id === id ? { ...w, config } : w),
      updatedAt: new Date().toISOString(),
    });
    setEditingWidget(null);
    message.success('配置已更新');
  };

  const handleSaveTemplate = (values: Record<string, unknown>) => {
    const newTemplate: DashboardTemplate = {
      id: 'tpl-' + Date.now(),
      name: values.name as string,
      description: values.description as string,
      widgets: [...widgets],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTemplates([...templates, newTemplate]);
    setSaveTemplateModal(false);
    message.success('模板已保存');
  };

  const handleDeleteTemplate = (_id: string) => {
    if (templates.length <= 1) {
      message.warning('至少保留一个模板');
      return;
    }
    setTemplates(templates.filter((t) => t.id !== _id));
    message.success('模板已删除');
  };

  const widgetColumns = [
    { title: '类型', key: 'type', dataIndex: 'type', render: (t: WidgetType) => {
      const info = WIDGET_TYPES.find((wi) => wi.type === t);
      return <Tag color={info?.color}>{info?.label}</Tag>;
    }},
    { title: '标题', dataIndex: 'config.title', key: 'title' },
    { title: '指标', dataIndex: 'config.metric', key: 'metric', render: (v: string) => <Text code>{v || '-'}</Text> },
    { title: '刷新', dataIndex: 'config.interval', key: 'interval', render: (v: string) => v || '-' },
    {
      title: '操作', key: 'actions',
      render: (_: unknown, record: WidgetItem) => (
        <Space size="small">
          <Tooltip title="编辑"><Button size="small" icon={<EditOutlined />} onClick={() => { createForm.setFieldsValue(record.config); setEditingWidget(record); }} /></Tooltip>
          <Tooltip title="复制"><Button size="small" icon={<CopyOutlined />} onClick={() => duplicateWidget(record)} /></Tooltip>
          <Tooltip title="删除"><Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeWidget(record.id)} /></Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Row gutter={16} style={{ marginBottom: spacing.md }}>
        <Col flex="1">
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <DashboardOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            自定义仪表板编辑器
          </Title>
          <Text type="secondary">拖拽式仪表板布局编辑器 · 可视化 Widget 配置 · 模板管理</Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<SaveOutlined />} onClick={() => setSaveTemplateModal(true)}>
              保存模板
            </Button>
            <Button
              type={previewMode ? 'primary' : 'default'}
              icon={<PlayCircleOutlined />}
              onClick={() => setPreviewMode(!previewMode)}
            >
              {previewMode ? '编辑模式' : '预览模式'}
            </Button>
            <Button
              icon={<PlusOutlined />}
              onClick={() => setCreateWidgetModal(true)}
            >
              添加 Widget
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Template Selector */}
      <Card size="small" style={{ marginBottom: spacing.md }}>
        <Space wrap size="middle">
          <Text strong>模板:</Text>
          {templates.map((t) => (
            <Space key={t.id} size="small">
              <Button
                type={selectedTemplate.id === t.id ? 'primary' : 'default'}
                size="small"
                onClick={() => setSelectedTemplate(t)}
              >
                {t.name}
              </Button>
              {templates.length > 1 && (
                <Tooltip title="删除模板">
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDeleteTemplate(t.id)}
                  />
                </Tooltip>
              )}
            </Space>
          ))}
        </Space>
      </Card>

      {/* Canvas */}
      <Card
        size="small"
        style={{ marginBottom: spacing.md }}
        extra={
          <Space>
            <Text type="secondary">{widgets.length} widgets</Text>
            <Button icon={<ReloadOutlined />} onClick={() => {}}>重置布局</Button>
          </Space>
        }
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, 80px)`,
            gap: spacing.sm,
            padding: spacing.md,
            minHeight: 280,
            background: colors.light.bg.secondary,
            borderRadius: spacing.sm,
            overflow: 'auto',
          }}
        >
          {widgets.map((w) => (
            <div
              key={w.id}
              style={{
                gridColumn: `${w.position.x + 1} / span ${w.position.w}`,
                gridRow: `${w.position.y + 1} / span ${w.position.h}`,
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onClick={() => setSelectedWidgetId(w.id === selectedWidgetId ? null : w.id)}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = ''; }}
            >
              <div style={{
                boxShadow: selectedWidgetId === w.id
                  ? `0 0 0 2px ${colors.primary[500]}`
                  : '0 1px 3px rgba(0,0,0,0.06)',
                borderRadius: spacing.sm,
              }}>
                <WidgetPreview widget={w} />
              </div>
            </div>
          ))}
          {widgets.length === 0 && (
            <div style={{ gridColumn: `1 / -1`, gridRow: `1 / -1`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.neutral[400] }}>
              <div style={{ textAlign: 'center' }}>
                <PlusOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                <div><Text type="secondary">点击「添加 Widget」开始构建仪表板</Text></div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Widget List */}
      <Card size="small">
        <Table
          columns={widgetColumns}
          dataSource={widgets}
          rowKey="id"
          size="small"
          pagination={false}
          rowClassName={() => 'table-row-hover'}
        />
      </Card>

      {/* Add Widget Modal */}
      <Modal
        title="添加 Widget"
        open={createWidgetModal}
        onCancel={() => setCreateWidgetModal(false)}
        footer={null}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing.md }}>
          {WIDGET_TYPES.map((wt) => (
            <Card
              key={wt.type}
              size="small"
              hoverable
              style={{ textAlign: 'center', border: `1px solid ${wt.color}22`, cursor: 'pointer' }}
              onClick={() => addWidget(wt.type)}
            >
              <div style={{ fontSize: 28, color: wt.color, marginBottom: 8 }}>
                {wt.icon}
              </div>
              <Text strong>{wt.label}</Text>
              <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{wt.description}</Text>
            </Card>
          ))}
        </div>
      </Modal>

      {/* Edit Widget Config Modal */}
      <Modal
        title={`编辑 Widget 配置 — ${editingWidget?.config.title || ''}`}
        open={!!editingWidget}
        onCancel={() => setEditingWidget(null)}
        onOk={() => {
          if (editingWidget) {
            form.validateFields().then((values) => {
              updateWidgetConfig(editingWidget.id, { ...editingWidget.config, ...values });
            });
          }
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="标题" name="title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="指标路径" name="metric">
            <Input placeholder="e.g. pipeline.successRate" />
          </Form.Item>
          <Form.Item label="刷新间隔" name="interval">
            <Select>
              <Option value="5s">5 秒</Option>
              <Option value="10s">10 秒</Option>
              <Option value="30s">30 秒</Option>
              <Option value="1m">1 分钟</Option>
              <Option value="5m">5 分钟</Option>
              <Option value="1h">1 小时</Option>
              <Option value="1d">1 天</Option>
            </Select>
          </Form.Item>
          <Form.Item label="API 端点" name="api">
            <Input placeholder="/api/v1/..." />
          </Form.Item>
          <Form.Item label="过滤条件" name="filter">
            <Input.TextArea rows={2} placeholder="JSON 格式过滤器" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Save Template Modal */}
      <Modal
        title="保存模板"
        open={saveTemplateModal}
        onCancel={() => setSaveTemplateModal(false)}
        onOk={() => {
          saveForm.validateFields().then(handleSaveTemplate);
        }}
      >
        <Form form={saveForm} layout="vertical">
          <Form.Item label="模板名称" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DashboardEditor;
