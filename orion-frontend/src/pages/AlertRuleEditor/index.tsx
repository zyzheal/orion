/**
 * Alert Rule Visual Editor (P3-07)
 * CRUD interface for alert rules with condition builder, severity config, and cooldown settings.
 *
 * Features:
 * - Rule list table with visual condition expressions
 * - Severity-based color coding (critical/warning/info)
 * - Enable/disable switch with toggle API
 * - Create/edit modal with full condition builder
 * - Delete with Popconfirm confirmation
 * - Summary stat cards at top
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Modal,
  message,
  Popconfirm,
  Spin,
  Empty,
  Switch,
  Input,
  Select,
  InputNumber,
  Form,
  Card,
  Statistic,
} from 'antd';
import {
  ThunderboltOutlined,
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import { colors, spacing } from '@/tokens';
import {
  getAlertRules,
  createAlertRule as apiCreateAlertRule,
  updateAlertRule as apiUpdateAlertRule,
  deleteAlertRule as apiDeleteAlertRule,
  toggleAlertRule as apiToggleAlertRule,
  type AlertRule,
} from '@/api/alerts';

const { Title, Text } = Typography;

// ---- Severity config ----
const severityConfig: Record<string, { color: string; label: string }> = {
  critical: { color: colors.error[500], label: '严重' },
  warning: { color: colors.warning[500], label: '警告' },
  info: { color: colors.info[500], label: '信息' },
};

const severitySelectOptions = [
  { label: '严重 (Critical)', value: 'critical' },
  { label: '警告 (Warning)', value: 'warning' },
  { label: '信息 (Info)', value: 'info' },
];

const conditionSelectOptions = [
  { label: '大于 (>)', value: '>' },
  { label: '小于 (<)', value: '<' },
  { label: '大于等于 (>=)', value: '>=' },
  { label: '小于等于 (<=)', value: '<=' },
  { label: '等于 (==)', value: '==' },
  { label: '不等于 (!=)', value: '!=' },
];

// ---- Default empty rule for form ----
const blankRule: Omit<AlertRule, 'id' | 'enabled'> & Partial<Pick<AlertRule, 'id' | 'enabled'>> = {
  name: '',
  metric: '',
  condition: '>',
  threshold: 0,
  severity: 'warning',
  cooldown: undefined,
};

const AlertRuleEditor: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [form] = Form.useForm();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ---- Load rules ----
  const loadRules = async () => {
    setLoading(true);
    try {
      const response = await getAlertRules();
      const apiData = response.data;
      const list = Array.isArray(apiData)
        ? apiData
        : (apiData as { data?: unknown[]; items?: unknown[] })?.data ??
          (apiData as { data?: unknown[]; items?: unknown[] })?.items ??
          [];
      setRules(list as AlertRule[]);
    } catch (_error: unknown) {
      message.error('加载告警规则失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  // ---- Summary stats ----
  const stats = useMemo(() => {
    return {
      total: rules.length,
      enabled: rules.filter((r) => r.enabled).length,
      critical: rules.filter((r) => r.severity === 'critical' && r.enabled).length,
    };
  }, [rules]);

  // ---- Modal handlers ----
  const handleOpenCreate = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({ ...blankRule });
    setModalVisible(true);
  };

  const handleOpenEdit = (rule: AlertRule) => {
    setEditingRule(rule);
    form.setFieldsValue(rule);
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setEditingRule(null);
  };

  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        name: values.name,
        metric: values.metric,
        condition: values.condition,
        threshold: values.threshold,
        severity: values.severity,
        cooldown: values.cooldown,
      };

      if (editingRule) {
        await apiUpdateAlertRule(editingRule.id, payload);
        setRules((prev) => prev.map((r) => (r.id === editingRule.id ? { ...r, ...payload } : r)));
        message.success('规则已更新');
      } else {
        const newRule = (await apiCreateAlertRule(payload)).data as AlertRule;
        setRules((prev) => [...prev, newRule]);
        message.success('规则已创建');
      }
      setModalVisible(false);
      setEditingRule(null);
    } catch (_error: unknown) {
      message.error(editingRule ? '更新规则失败' : '创建规则失败');
    }
  };

  // ---- Toggle rule ----
  const handleToggle = async (id: string, currentEnabled: boolean) => {
    setTogglingId(id);
    try {
      await apiToggleAlertRule(id);
      setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !currentEnabled } : r)));
      message.success(currentEnabled ? '规则已禁用' : '规则已启用');
    } catch (_error: unknown) {
      message.error('切换规则状态失败');
    } finally {
      setTogglingId(null);
    }
  };

  // ---- Delete rule ----
  const handleDelete = async (id: string) => {
    try {
      await apiDeleteAlertRule(id);
      setRules((prev) => prev.filter((r): r is AlertRule => r.id !== id));
      message.success('规则已删除');
    } catch (_error: unknown) {
      message.error('删除规则失败');
    }
  };

  // ---- Helpers ----
  const renderConditionTag = (rule: AlertRule) => {
    const config = severityConfig[rule.severity] || severityConfig.info;
    return (
      <Tag
        color={config.color}
        style={{
          fontFamily: 'monospace',
          fontSize: 12,
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span>{rule.metric}</span>
        <span>{rule.condition}</span>
        <span>{rule.threshold}</span>
      </Tag>
    );
  };

  const renderSeverityTag = (severity: string) => {
    const config = severityConfig[severity] || severityConfig.info;
    return <Tag color={config.color}>{config.label}</Tag>;
  };

  // ---- Table columns ----
  const columns: TableColumn<AlertRule>[] = [
    {
      key: 'name',
      title: '规则名称',
      dataIndex: 'name',
      width: 200,
      render: (value) => <Text strong>{String(value)}</Text>,
    },
    {
      key: 'metric',
      title: '指标',
      dataIndex: 'metric',
      width: 160,
      render: (value) => <Text code>{String(value)}</Text>,
    },
    {
      key: 'condition_expr',
      title: '条件表达式',
      width: 200,
      render: (_, record) => renderConditionTag(record),
    },
    {
      key: 'severity',
      title: '严重度',
      dataIndex: 'severity',
      width: 100,
      render: (value) => renderSeverityTag(String(value)),
    },
    {
      key: 'cooldown',
      title: '冷却时间',
      dataIndex: 'cooldown',
      width: 100,
      render: (value) => (
        <Text type="secondary">
          {value ? `${value} 秒` : '—'}
        </Text>
      ),
    },
    {
      key: 'enabled',
      title: '状态',
      dataIndex: 'enabled',
      width: 80,
      render: (value, record) => (
        <Switch
          checked={value as boolean}
          checkedChildren="开"
          unCheckedChildren="关"
          size="small"
          disabled={togglingId === record.id}
          loading={togglingId === record.id}
          onChange={() => handleToggle(record.id, value as boolean)}
        />
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 140,
      render: (_, record) => (
        <Space size={8}>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除此规则？"
            description="删除后无法恢复"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <Spin spinning={loading}>
        {/* Page header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: spacing.lg,
          }}
        >
          <div>
            <Title level={2} style={{ marginBottom: 8 }}>
              <ThunderboltOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
              告警规则可视化编辑器
            </Title>
            <Text type="secondary">条件编辑器 · 阈值配置 · 冷却时间设置</Text>
          </div>
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenCreate}
            >
              新建规则
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadRules}
              loading={loading}
            >
              刷新
            </Button>
          </Space>
        </div>

        {/* Summary stat cards */}
        <div
          style={{
            display: 'flex',
            gap: spacing.md,
            marginBottom: spacing.lg,
          }}
        >
          <Card
            style={{
              flex: 1,
              borderRadius: 12,
              borderColor: colors.primary[100],
            }}
          >
            <Statistic
              title="总规则数"
              value={stats.total}
              valueStyle={{ color: colors.primary[500], fontSize: 28 }}
            />
          </Card>
          <Card
            style={{
              flex: 1,
              borderRadius: 12,
              borderColor: colors.success[100],
            }}
          >
            <Statistic
              title="启用数"
              value={stats.enabled}
              valueStyle={{ color: colors.success[500], fontSize: 28 }}
            />
          </Card>
          <Card
            style={{
              flex: 1,
              borderRadius: 12,
              borderColor: colors.error[100],
            }}
          >
            <Statistic
              title="严重规则数"
              value={stats.critical}
              valueStyle={{ color: colors.error[500], fontSize: 28 }}
            />
          </Card>
        </div>

        {/* Rules table */}
        {rules.length > 0 ? (
          <Table
            columns={columns}
            dataSource={rules}
            loading={loading}
            rowKey="id"
            size="middle"
            striped
          />
        ) : (
          !loading && (
            <Empty
              description="暂无告警规则"
              style={{ marginTop: 60, marginBottom: 60 }}
            />
          )
        )}

        {/* Create/Edit modal */}
        <Modal
          title={editingRule ? '编辑告警规则' : '新建告警规则'}
          open={modalVisible}
          onCancel={handleModalClose}
          onOk={handleModalSubmit}
          okText={editingRule ? '更新' : '创建'}
          cancelText="取消"
          okButtonProps={{ loading: loading }}
          width={600}
        >
          <Form
            form={form}
            layout="vertical"
            style={{ marginTop: 16, maxWidth: 560 }}
          >
            <Form.Item
              label="规则名称"
              name="name"
              rules={[{ required: true, message: '请输入规则名称' }]}
            >
              <Input placeholder="例如：CPU使用率过高告警" />
            </Form.Item>

            <Form.Item
              label="指标名称"
              name="metric"
              rules={[{ required: true, message: '请输入指标名称' }]}
            >
              <Input placeholder="例如：cpu_usage_percent" />
            </Form.Item>

            <Form.Item
              label="条件"
              name="condition"
              rules={[{ required: true, message: '请选择条件' }]}
            >
              <Select options={conditionSelectOptions} placeholder="选择比较条件" />
            </Form.Item>

            <Form.Item
              label="阈值"
              name="threshold"
              rules={[{ required: true, message: '请输入阈值' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                placeholder="例如：90"
                addonAfter={<Text type="secondary">单位</Text>}
              />
            </Form.Item>

            <Form.Item
              label="严重度"
              name="severity"
              rules={[{ required: true, message: '请选择严重度' }]}
            >
              <Select options={severitySelectOptions} placeholder="选择严重级别" />
            </Form.Item>

            <Form.Item
              label="冷却时间"
              name="cooldown"
              tooltip="告警触发后的冷却时间，避免重复告警"
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                placeholder="可选，单位：秒"
                addonAfter={<Text type="secondary">秒</Text>}
              />
            </Form.Item>
          </Form>
        </Modal>
      </Spin>
    </div>
  );
};

export default AlertRuleEditor;
