/**
 * Monitoring Rules Page
 * Manage alert rules with CRUD operations, toggle enable/disable, suppress/unsuppress
 */
import React, { useState, useEffect } from 'react';
import { Typography, Button, Space, Tag, Modal, Form, Input, InputNumber, Select, Switch, message } from 'antd';
import { PlusOutlined, ReloadOutlined, AlertOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import {
  getAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  toggleAlertRule,
} from '@/api/monitoring';
import type { AlertRule } from '@/api/monitoring';

const { Title, Text } = Typography;

const conditionOptions = [
  { label: '大于 (>)', value: '>' },
  { label: '大于等于 (>=)', value: '>=' },
  { label: '小于 (<)', value: '<' },
  { label: '小于等于 (<=)', value: '<=' },
  { label: '等于 (==)', value: '==' },
  { label: '不等于 (!=)', value: '!=' },
];

const MonitoringRules: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await getAlertRules();
      const apiData = response.data.data;
      setRules(Array.isArray(apiData) ? apiData : []);
    } catch (error) {
      console.error('Failed to load alert rules:', error);
      message.error('加载告警规则失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRules = React.useMemo(() => {
    return rules.filter((r) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [r.name, r.metric, r.condition].join(' ').toLowerCase();
        if (!searchable.includes(query)) return false;
      }
      const severityFilter = filters.severity;
      if (severityFilter && severityFilter !== 'all' && r.severity !== severityFilter) return false;
      return true;
    });
  }, [searchQuery, filters, rules]);

  const filterDefs: FilterDefinition[] = [
    {
      key: 'severity',
      label: '严重级别',
      options: [
        { label: '全部', value: 'all' },
        { label: '严重', value: 'critical' },
        { label: '警告', value: 'warning' },
        { label: '提示', value: 'info' },
      ],
    },
  ];

  const openModal = (rule?: AlertRule) => {
    setEditingRule(rule || null);
    if (rule) {
      form.setFieldsValue(rule);
    } else {
      form.resetFields();
      form.setFieldsValue({ enabled: true, severity: 'warning', condition: '>' });
    }
    setModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingRule) {
        await updateAlertRule(editingRule.id, values);
        message.success('规则已更新');
      } else {
        await createAlertRule(values);
        message.success('规则已创建');
      }
      setModalVisible(false);
      loadData();
    } catch (error) {
      message.error(editingRule ? '更新规则失败' : '创建规则失败');
    }
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除此告警规则吗？',
      onOk: async () => {
        try {
          await deleteAlertRule(id);
          message.success('规则已删除');
          loadData();
        } catch (error) {
          message.error('删除规则失败');
        }
      },
    });
  };

  const handleToggle = async (id: string) => {
    try {
      const res = await toggleAlertRule(id);
      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, enabled: res.data.data?.enabled ?? !r.enabled } : r))
      );
      message.success('规则状态已切换');
    } catch (error) {
      message.error('切换规则状态失败');
    }
  };

  const columns: TableColumn<AlertRule>[] = [
    {
      key: 'name',
      title: '规则名称',
      dataIndex: 'name',
      sortable: true,
      filterable: true,
      render: (v: unknown) => <Text strong>{String(v)}</Text>,
    },
    {
      key: 'metric',
      title: '监控指标',
      dataIndex: 'metric',
      sortable: true,
      render: (v: unknown) => <Tag color="blue">{String(v)}</Tag>,
    },
    {
      key: 'condition',
      title: '条件',
      dataIndex: 'condition',
      width: 100,
      render: (v: unknown, record: AlertRule) => (
        <Text>{String(v)} {record.threshold}</Text>
      ),
    },
    {
      key: 'severity',
      title: '级别',
      dataIndex: 'severity',
      width: 90,
      render: (v: unknown) => {
        const colorMap: Record<string, string> = { critical: 'red', warning: 'orange', info: 'blue' };
        return <Tag color={colorMap[String(v)]}>{String(v)}</Tag>;
      },
    },
    {
      key: 'enabled',
      title: '状态',
      dataIndex: 'enabled',
      width: 80,
      render: (v: unknown) => (
        <Tag color={v ? 'green' : 'default'}>{v ? '已启用' : '已禁用'}</Tag>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 200,
      render: (_, record: AlertRule) => (
        <Space size="small">
          <Switch
            checked={record.enabled}
            onChange={() => handleToggle(record.id)}
            checkedChildren="开"
            unCheckedChildren="关"
            size="small"
          />
          <Button type="link" size="small" onClick={() => openModal(record)}>
            编辑
          </Button>
          <Button type="link" size="small" danger onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <AlertOutlined style={{ marginRight: 8 }} />
            告警规则
          </Title>
          <Text type="secondary">共 {rules.length} 条规则</Text>
        </div>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            创建规则
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      <div style={{ marginBottom: 16 }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={filterDefs}
          searchPlaceholder="搜索规则名称、指标..."
        />
      </div>

      <Table
        columns={columns}
        dataSource={filteredRules}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
      />

      {/* Create/Edit Modal */}
      <Modal
        title={editingRule ? '编辑告警规则' : '创建告警规则'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input placeholder="例如：CPU使用率过高" />
          </Form.Item>
          <Form.Item name="metric" label="监控指标" rules={[{ required: true, message: '请输入指标名称' }]}>
            <Input placeholder="例如：cpu_usage_percent" />
          </Form.Item>
          <Form.Item name="condition" label="条件" rules={[{ required: true, message: '请选择条件' }]}>
            <Select options={conditionOptions} />
          </Form.Item>
          <Form.Item name="threshold" label="阈值" rules={[{ required: true, message: '请输入阈值' }]}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="severity" label="严重级别" rules={[{ required: true, message: '请选择级别' }]}>
            <Select
              options={[
                { label: '严重 (Critical)', value: 'critical' },
                { label: '警告 (Warning)', value: 'warning' },
                { label: '提示 (Info)', value: 'info' },
              ]}
            />
          </Form.Item>
          <Form.Item name="cooldownMs" label="冷却时间 (ms)">
            <InputNumber style={{ width: '100%' }} placeholder="例如：300000" />
          </Form.Item>
          <Form.Item name="enabled" label="启用状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              {editingRule ? '更新' : '创建'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MonitoringRules;
