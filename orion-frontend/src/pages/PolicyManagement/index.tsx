/**
 * Policy Management Page
 * Policy list with CRUD, violations dashboard, evaluate modal
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Modal,
  Form,
  Input,
  Select,
  message,
  Tabs,
} from 'antd';
import { colors, spacing } from '@/tokens';
import { PlusOutlined, ReloadOutlined, SyncOutlined, PlayCircleOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import {
  getPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  togglePolicy,
  getPolicyViolations,
  resolveViolation,
  evaluatePolicy,
} from '@/api/policies';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { PolicyDefinition, PolicyViolation, PolicyInput } from '@/api/policies';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// ---- Form value interfaces ----

interface EvaluateFormValues {
  policyId: string;
  input?: string;
}

const PolicyManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [policies, setPolicies] = useState<PolicyDefinition[]>([]);
  const [violations, setViolations] = useState<PolicyViolation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [policyModalVisible, setPolicyModalVisible] = useState(false);
  const [evaluateModalVisible, setEvaluateModalVisible] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<PolicyDefinition | null>(null);
  const [form] = Form.useForm();
  const [evalForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [policyRes, violationRes] = await Promise.all([getPolicies(), getPolicyViolations()]);
      setPolicies(Array.isArray(policyRes.data) ? policyRes.data : []);
      setViolations(Array.isArray(violationRes.data) ? violationRes.data : []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`Failed to load policy data：${error.message}`);
      } else {
        message.error('Failed to load policy data');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredPolicies = useMemo(() => {
    return policies.filter((p) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !(p.description || '').toLowerCase().includes(q))
          return false;
      }
      if (filters.category && filters.category !== 'all' && p.category !== filters.category)
        return false;
      if (filters.severity && filters.severity !== 'all' && p.severity !== filters.severity)
        return false;
      return true;
    });
  }, [searchQuery, filters, policies]);

  const openViolations = violations.filter((v) => v.status === 'open').length;
  const blockedViolations = violations.filter((v) => v.severity === 'block').length;

  const handleSavePolicy = async (values: Record<string, unknown>) => {
    try {
      const payload: PolicyInput = {
        name: String(values.name),
        description: values.description ? String(values.description) : undefined,
        category: values.category as PolicyInput['category'],
        regoPath: String(values.regoPath),
        gateId: values.gateId ? String(values.gateId) : undefined,
        severity: values.severity as PolicyInput['severity'],
        enabled: true,
      };
      if (editingPolicy) {
        await updatePolicy(editingPolicy.id, payload);
        message.success('Policy updated');
      } else {
        await createPolicy(payload);
        message.success('Policy created');
      }
      setPolicyModalVisible(false);
      setEditingPolicy(null);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`Failed to save policy：${error.message}`);
      } else {
        message.error('Failed to save policy');
      }
    }
  };

  const handleTogglePolicy = async (policy: PolicyDefinition) => {
    try {
      await togglePolicy(policy.id);
      message.success(`Policy ${policy.enabled ? 'disabled' : 'enabled'}`);
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`Failed to toggle policy：${error.message}`);
      } else {
        message.error('Failed to toggle policy');
      }
    }
  };

  const handleDeletePolicy = async (id: string) => {
    try {
      await deletePolicy(id);
      message.success('Policy deleted');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`Failed to delete policy：${error.message}`);
      } else {
        message.error('Failed to delete policy');
      }
    }
  };

  const handleEvaluate = async (values: EvaluateFormValues) => {
    try {
      const inputContext: Record<string, unknown> = values.input ? JSON.parse(values.input) : {};
      await evaluatePolicy({ policyId: values.policyId, input: inputContext });
      message.success('Policy evaluated');
      setEvaluateModalVisible(false);
      evalForm.resetFields();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`Failed to evaluate policy：${error.message}`);
      } else {
        message.error('Failed to evaluate policy');
      }
    }
  };

  const handleResolveViolation = async (id: string) => {
    try {
      await resolveViolation(id);
      message.success('Violation resolved');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`Failed to resolve violation：${error.message}`);
      } else {
        message.error('Failed to resolve violation');
      }
    }
  };

  const policyColumns: TableColumn<PolicyDefinition>[] = [
    {
      key: 'name',
      title: '策略名称',
      dataIndex: 'name',
      width: 200,
      sortable: true,
      render: (value: unknown, record: PolicyDefinition) => (
        <Space direction="vertical" size={0}>
          <Text strong>{String(value)}</Text>
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            {record.description || '-'}
          </Text>
        </Space>
      ),
    },
    {
      key: 'category',
      title: '分类',
      dataIndex: 'category',
      width: 120,
      render: (value: unknown) => {
        const colorMap: Record<string, string> = {
          security: 'red',
          cost: 'green',
          quality: 'blue',
          governance: 'purple',
        };
        return <Tag color={colorMap[String(value)] || 'default'}>{String(value)}</Tag>;
      },
    },
    {
      key: 'severity',
      title: '严重级别',
      dataIndex: 'severity',
      width: 120,
      render: (value: unknown) => {
        const colorMap: Record<string, string> = {
          block: 'red',
          warning: 'orange',
          info: 'default',
        };
        return <Tag color={colorMap[String(value)] || 'default'}>{String(value)}</Tag>;
      },
    },
    {
      key: 'gateId',
      title: '门禁',
      dataIndex: 'gateId',
      width: 140,
      render: (value: unknown) =>
        value ? <Tag>{String(value)}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      key: 'regoPath',
      title: 'Rego 路径',
      dataIndex: 'regoPath',
      width: 200,
      render: (value: unknown) => <Text code>{String(value)}</Text>,
    },
    {
      key: 'enabled',
      title: '状态',
      dataIndex: 'enabled',
      width: 100,
      render: (value: unknown) => (
        <StatusBadge status={value ? 'success' : 'cancelled'} size="small" />
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 200,
      render: (_: unknown, record: PolicyDefinition) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => {
              setEditingPolicy(record);
              form.setFieldsValue(record);
              setPolicyModalVisible(true);
            }}
          >
            编辑
          </Button>
          <Button type="link" size="small" onClick={() => handleTogglePolicy(record)}>
            {record.enabled ? '禁用' : '启用'}
          </Button>
          <Button type="link" size="small" danger onClick={() => handleDeletePolicy(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const violationColumns: TableColumn<PolicyViolation>[] = [
    {
      key: 'policyName',
      title: '策略',
      dataIndex: 'policyName',
      width: 160,
      render: (value: unknown) => <Text strong>{value ? String(value) : '-'}</Text>,
    },
    {
      key: 'message',
      title: '消息',
      dataIndex: 'message',
      width: 300,
      render: (value: unknown) => (
        <Text ellipsis={{ tooltip: String(value) }} style={{ maxWidth: 300 }}>
          {String(value)}
        </Text>
      ),
    },
    {
      key: 'severity',
      title: '严重级别',
      dataIndex: 'severity',
      width: 100,
      render: (value: unknown) => {
        const colorMap: Record<string, string> = {
          block: 'red',
          warning: 'orange',
          info: 'default',
        };
        return <Tag color={colorMap[String(value)] || 'default'}>{String(value)}</Tag>;
      },
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: unknown) => (
        <StatusBadge
          status={value === 'open' ? 'warning' : value === 'resolved' ? 'success' : 'pending'}
          size="small"
        />
      ),
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(String(value)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 100,
      render: (_: unknown, record: PolicyViolation) =>
        record.status === 'open' ? (
          <Button type="link" size="small" onClick={() => handleResolveViolation(record.id)}>
            解决
          </Button>
        ) : null,
    },
  ];

  const filterDefs: FilterDefinition[] = [
    {
      key: 'category',
      label: '分类',
      options: [
        { label: '全部', value: 'all' },
        { label: 'Security', value: 'security' },
        { label: 'Cost', value: 'cost' },
        { label: 'Quality', value: 'quality' },
        { label: 'Governance', value: 'governance' },
      ],
    },
    {
      key: 'severity',
      label: '严重级别',
      options: [
        { label: '全部', value: 'all' },
        { label: 'Block', value: 'block' },
        { label: 'Warning', value: 'warning' },
        { label: 'Info', value: 'info' },
      ],
    },
  ];

  return (
    <div style={{ padding: 0 }}>
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
            <SafetyCertificateOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            OPA 策略管理
          </Title>
          <Text type="secondary">策略即代码，统一治理全链路</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button icon={<SyncOutlined />} onClick={() => message.info('Bundle sync triggered')}>
            同步 Bundle
          </Button>
          <Button icon={<PlayCircleOutlined />} onClick={() => setEvaluateModalVisible(true)}>
            评估策略
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingPolicy(null);
              form.resetFields();
              setPolicyModalVisible(true);
            }}
          >
            创建策略
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="策略总数" value={policies.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="启用中"
              value={policies.filter((p) => p.enabled).length}
              valueStyle={{ color: colors.success[600] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃违规"
              value={openViolations}
              valueStyle={{ color: colors.error[600] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="阻断违规"
              value={blockedViolations}
              valueStyle={{ color: colors.error[600] }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabs: Policies + Violations */}
      <Tabs
        defaultActiveKey="policies"
        items={[
          {
            key: 'policies',
            label: '策略列表',
            children: (
              <>
                <div style={{ marginBottom: 16 }}>
                  <SearchFilterBar
                    onSearch={setSearchQuery}
                    onFilter={setFilters}
                    filters={filterDefs}
                    searchPlaceholder="搜索策略名称、描述..."
                  />
                </div>
                <Table
                  columns={policyColumns}
                  dataSource={filteredPolicies}
                  loading={loading}
                  rowKey="id"
                  size="middle"
                  striped
                />
              </>
            ),
          },
          {
            key: 'violations',
            label: `违规 (${violations.length})`,
            children: (
              <Table
                columns={violationColumns}
                dataSource={violations}
                loading={loading}
                rowKey="id"
                size="middle"
                striped
              />
            ),
          },
        ]}
      />

      {/* Policy Create/Edit Modal */}
      <Modal
        title={editingPolicy ? '编辑策略' : '创建策略'}
        open={policyModalVisible}
        onCancel={() => {
          setPolicyModalVisible(false);
          setEditingPolicy(null);
        }}
        onOk={() => form.submit()}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSavePolicy}>
          <Form.Item name="name" label="策略名称" rules={[{ required: true }]}>
            <Input placeholder="策略名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="策略描述" />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'Security', value: 'security' },
                { label: 'Cost', value: 'cost' },
                { label: 'Quality', value: 'quality' },
                { label: 'Governance', value: 'governance' },
              ]}
            />
          </Form.Item>
          <Form.Item name="severity" label="严重级别" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'Block', value: 'block' },
                { label: 'Warning', value: 'warning' },
                { label: 'Info', value: 'info' },
              ]}
            />
          </Form.Item>
          <Form.Item name="regoPath" label="Rego 路径" rules={[{ required: true }]}>
            <Input placeholder="policies/security/require-mfa.rego" />
          </Form.Item>
          <Form.Item name="gateId" label="关联门禁">
            <Input placeholder="例如: deploy-gate" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Evaluate Modal */}
      <Modal
        title="评估策略"
        open={evaluateModalVisible}
        onCancel={() => setEvaluateModalVisible(false)}
        onOk={() => evalForm.submit()}
        destroyOnClose
      >
        <Form form={evalForm} layout="vertical" onFinish={handleEvaluate}>
          <Form.Item name="policyId" label="策略" rules={[{ required: true }]}>
            <Select options={policies.map((p) => ({ label: p.name, value: p.id }))} />
          </Form.Item>
          <Form.Item name="input" label="输入上下文 (JSON)">
            <Input.TextArea rows={6} placeholder='{"resource": "deployment", "action": "create"}' />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PolicyManagement;
