/**
 * AlertRulesPage - Custom Alert Rules Management
 * Phase 2: 创建、编辑、删除自定义告警规则，支持从模板创建
 */
import React, { useState, useEffect } from 'react';
import {
  Typography, Card, Table, Tag, Space, Button, Modal, Form, Input,
  Select, message, Row, Col, Switch, Drawer,
} from 'antd';
import {
  BellOutlined, PlusOutlined, DeleteOutlined, EditOutlined,
  ReloadOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import {
  getAlertRules, createAlertRule, updateAlertRule, deleteAlertRule,
  toggleAlertRule, getAlertRuleTemplates, createAlertRuleFromTemplate,
  type AlertRule, type AlertRuleInput, type AlertRuleTemplate,
} from '@/api/observability';

const { Title, Text } = Typography;

const severityColorMap: Record<string, string> = {
  critical: 'error',
  warning: 'warning',
  info: 'blue',
};

const ruleTypeLabels: Record<string, string> = {
  threshold: '阈值',
  trend: '趋势',
  composite: '复合',
};

const categoryLabels: Record<string, string> = {
  resource: '资源',
  reliability: '可靠性',
  performance: '性能',
};

// ---- Templates Drawer ----

const TemplatesDrawer: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSelect: (templateId: string) => void;
}> = ({ visible, onClose, onSelect }) => {
  const [templates, setTemplates] = useState<AlertRuleTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<string | undefined>(undefined);

  const loadTemplates = async (cat?: string) => {
    setLoading(true);
    try {
      const res = await getAlertRuleTemplates(cat ? { category: cat } : undefined);
      const rawData = res.data?.data;
      setTemplates(Array.isArray(rawData) ? rawData : (rawData?.data as AlertRuleTemplate[]) || []);
    } catch (error: unknown) {
      message.error(`加载模板失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) loadTemplates(category);
  }, [visible, category]);

  const columns = [
    { title: '模板名称', dataIndex: 'name', key: 'name', width: 180 },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 80,
      render: (v: string) => <Tag>{categoryLabels[v] || v}</Tag>,
    },
    {
      title: '类型',
      dataIndex: 'ruleType',
      key: 'ruleType',
      width: 80,
      render: (v: string) => <Tag color="purple">{ruleTypeLabels[v] || v}</Tag>,
    },
    { title: '严重度', dataIndex: 'severity', key: 'severity', width: 90, render: (v: string) => <Tag color={severityColorMap[v]}>{v}</Tag> },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: AlertRuleTemplate) => (
        <Button type="link" size="small" onClick={() => onSelect(record.id)}>使用此模板</Button>
      ),
    },
  ];

  return (
    <Drawer
      title="告警规则模板库"
      open={visible}
      onClose={onClose}
      width={800}
    >
      <Space style={{ marginBottom: 16 }}>
        <Text>按类别筛选：</Text>
        <Select
          style={{ width: 120 }}
          value={category}
          onChange={(v) => { setCategory(v || undefined); loadTemplates(v || undefined); }}
          allowClear
          options={[
            { label: '资源', value: 'resource' },
            { label: '可靠性', value: 'reliability' },
            { label: '性能', value: 'performance' },
          ]}
        />
      </Space>
      <Table columns={columns} dataSource={templates} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 8 }} />
    </Drawer>
  );
};

// ---- Alert Rules Page ----

const AlertRulesPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [templatesVisible, setTemplatesVisible] = useState(false);

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await getAlertRules();
      setRules(res.data?.data?.rules || []);
    } catch (error: unknown) {
      message.error(`加载告警规则失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const openCreateModal = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({ duration: '5m', severity: 'warning', ruleType: 'threshold' });
    setModalVisible(true);
  };

  const openEditModal = (rule: AlertRule) => {
    setEditingRule(rule);
    form.setFieldsValue({
      name: rule.name,
      metric: rule.metric,
      condition: rule.condition,
      threshold: rule.threshold,
      duration: rule.duration,
      severity: rule.severity,
      ruleType: 'threshold',
      summary: rule.annotations?.summary,
      description: rule.annotations?.description,
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload: AlertRuleInput = {
        name: values.name,
        metric: values.metric,
        condition: values.condition,
        threshold: values.threshold,
        duration: values.duration,
        severity: values.severity,
        annotations: values.summary
          ? { summary: values.summary, description: values.description || '' }
          : undefined,
      };

      if (editingRule) {
        await updateAlertRule(editingRule.id, payload);
        message.success('告警规则已更新');
      } else {
        await createAlertRule(payload);
        message.success('告警规则已创建');
      }
      setModalVisible(false);
      loadRules();
    } catch (error: unknown) {
      if (!(error as { errorFields?: unknown }).errorFields) {
        message.error(`操作失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (ruleId: string) => {
    try {
      await toggleAlertRule(ruleId);
      message.success('规则状态已切换');
      loadRules();
    } catch (error: unknown) {
      message.error(`切换失败: ${(error as Error).message}`);
    }
  };

  const handleDelete = async (ruleId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，是否继续？',
      onOk: async () => {
        try {
          await deleteAlertRule(ruleId);
          message.success('告警规则已删除');
          loadRules();
        } catch (error: unknown) {
          message.error(`删除失败: ${(error as Error).message}`);
        }
      },
    });
  };

  const handleTemplateSelect = async (templateId: string) => {
    try {
      await createAlertRuleFromTemplate({ templateId });
      message.success('已从模板创建规则');
      setTemplatesVisible(false);
      loadRules();
    } catch (error: unknown) {
      message.error(`创建失败: ${(error as Error).message}`);
    }
  };

  const conditionLabels: Record<string, string> = { gt: '>', lt: '<', eq: '==', gte: '>=', lte: '<=', neq: '!=' };

  const columns = [
    { title: '规则名称', dataIndex: 'name', key: 'name', width: 180, render: (v: string) => <Text strong>{v}</Text> },
    { title: '指标', dataIndex: 'metric', key: 'metric', width: 140 },
    {
      title: '条件',
      key: 'condition',
      width: 100,
      render: (_: unknown, record: AlertRule) => (
        <Tag>{conditionLabels[record.condition] || record.condition} {record.threshold}</Tag>
      ),
    },
    { title: '持续时间', dataIndex: 'duration', key: 'duration', width: 80 },
    {
      title: '严重度',
      dataIndex: 'severity',
      key: 'severity',
      width: 90,
      render: (v: string) => <Tag color={severityColorMap[v]}>{v}</Tag>,
    },
    {
      title: '状态',
      key: 'enabled',
      width: 80,
      render: (_: unknown, record: AlertRule) => (
        <Switch checked={record.enabled} size="small" onChange={() => handleToggle(record.id)} />
      ),
    },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 160, render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_: unknown, record: AlertRule) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>编辑</Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0, marginBottom: 8 }}>
          <BellOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          告警规则管理
        </Title>
        <Text type="secondary">管理和配置自定义告警规则，支持从模板快速创建</Text>
      </div>

      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Text type="secondary">共 {rules.length} 条规则</Text>
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadRules} loading={loading}>刷新</Button>
            <Button icon={<FileTextOutlined />} onClick={() => setTemplatesVisible(true)}>从模板创建</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>创建规则</Button>
          </Space>
        </div>

        <Table columns={columns} dataSource={rules} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 10 }} />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editingRule ? '编辑告警规则' : '创建告警规则'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}>
            <Input placeholder="如: CPU 使用率过高" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="metric" label="指标名称" rules={[{ required: true }]}>
                <Input placeholder="如: cpu_usage" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="condition" label="条件" rules={[{ required: true }]}>
                <Select options={[
                  { label: '> 大于', value: 'gt' },
                  { label: '< 小于', value: 'lt' },
                  { label: '>= 大于等于', value: 'gte' },
                  { label: '<= 小于等于', value: 'lte' },
                  { label: '== 等于', value: 'eq' },
                  { label: '!= 不等于', value: 'neq' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="threshold" label="阈值" rules={[{ required: true }]}>
                <Input type="number" placeholder="90" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="duration" label="持续时间">
                <Input placeholder="如: 5m, 10m, 1h" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="severity" label="严重度" rules={[{ required: true }]}>
                <Select options={[
                  { label: 'Critical', value: 'critical' },
                  { label: 'Warning', value: 'warning' },
                  { label: 'Info', value: 'info' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="summary" label="告警摘要">
            <Input placeholder="简短描述告警触发原因" />
          </Form.Item>
          <Form.Item name="description" label="详细描述">
            <Input.TextArea rows={3} placeholder="详细描述告警条件和影响" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Templates Drawer */}
      <TemplatesDrawer
        visible={templatesVisible}
        onClose={() => setTemplatesVisible(false)}
        onSelect={handleTemplateSelect}
      />
    </div>
  );
};

export default AlertRulesPage;
