/**
 * Quality Gate Page
 * Gate results, exemption requests, trend analysis panel
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
  Table as AntTable,
  Descriptions,
  Drawer,
  Row,
  Col,
  Statistic,
  Progress,
  Tabs,
} from 'antd';
import {
  ReloadOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  EditOutlined,
  CheckSquareOutlined,} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  getPolicies,
  getPolicyViolations,
  waiveViolation,
  evaluateGate,
  type PolicyDefinition,
  type PolicyViolation,
} from '@/api/policies';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// ---- Color maps ----

const severityColorMap: Record<string, string> = {
  block: 'red',
  warning: 'orange',
  info: 'blue',
};

const severityLabelMap: Record<string, string> = {
  block: '阻止',
  warning: '警告',
  info: '信息',
};

const violationStatusColorMap: Record<string, string> = {
  open: 'red',
  waived: 'gold',
  resolved: 'green',
};

const violationStatusLabelMap: Record<string, string> = {
  open: '未处理',
  waived: '已豁免',
  resolved: '已解决',
};

const categoryColorMap: Record<string, string> = {
  security: 'red',
  cost: 'blue',
  quality: 'green',
  governance: 'purple',
};

// ---- Stat Card ----

const StatCard: React.FC<{
  title: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
}> = ({ title, value, icon, color }) => (
  <Card size="small">
    <Statistic
      title={<Text type="secondary">{title}</Text>}
      value={value}
      prefix={icon}
      valueStyle={{ color }}
    />
  </Card>
);

// ---- Main Component ----

const QualityGatePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [policies, setPolicies] = useState<PolicyDefinition[]>([]);
  const [violations, setViolations] = useState<PolicyViolation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});

  // Gate evaluation
  const [gateModalVisible, setGateModalVisible] = useState(false);
  const [gateForm] = Form.useForm();
  const [gateResult, setGateResult] = useState<Record<string, unknown> | null>(null);
  const [gateLoading, setGateLoading] = useState(false);

  // Waive modal
  const [waiveModalVisible, setWaiveModalVisible] = useState(false);
  const [selectedViolation, setSelectedViolation] = useState<PolicyViolation | null>(null);
  const [waiveForm] = Form.useForm();
  const [waiveLoading, setWaiveLoading] = useState(false);

  // Detail drawer
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyDefinition | null>(null);

  const loadPolicies = async () => {
    setLoading(true);
    try {
      const res = await getPolicies({ page: 1, pageSize: 100 });
      const raw = res.data?.data;
      setPolicies(Array.isArray(raw) ? raw : []);
    } catch (error: unknown) {
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  };

  const loadViolations = async () => {
    try {
      const res = await getPolicyViolations({ page: 1, pageSize: 100 });
      const raw = res.data?.data;
      setViolations(Array.isArray(raw) ? raw : []);
    } catch (error: unknown) {
      setViolations([]);
    }
  };

  useEffect(() => {
    loadPolicies();
    loadViolations();
  }, []);

  const filteredViolations = useMemo(() => {
    return violations.filter((v) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !v.message.toLowerCase().includes(q) &&
          !(v.policyName && v.policyName.toLowerCase().includes(q)) &&
          !(v.resourceId && v.resourceId.toLowerCase().includes(q))
        )
          return false;
      }
      if (filters.severity && filters.severity !== 'all' && v.severity !== filters.severity) return false;
      if (filters.status && filters.status !== 'all' && v.status !== filters.status) return false;
      return true;
    });
  }, [searchQuery, filters, violations]);

  // Stats
  const stats = useMemo(() => {
    const total = policies.length;
    const enabled = policies.filter((p) => p.enabled).length;
    const openViolations = violations.filter((v) => v.status === 'open').length;
    const blocked = violations.filter(
      (v) => v.status === 'open' && v.severity === 'block'
    ).length;
    return { total, enabled, openViolations, blocked };
  }, [policies, violations]);

  const handleWaive = async () => {
    if (!selectedViolation) return;
    try {
      const values = await waiveForm.validateFields();
      setWaiveLoading(true);
      await waiveViolation(selectedViolation.id, {
        reason: values.reason,
        expiresAt: values.expiresAt,
        scope: values.scope || 'project',
      });
      message.success('豁免申请提交成功');
      setWaiveModalVisible(false);
      waiveForm.resetFields();
      loadViolations();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`豁免失败: ${(error as Error).message}`);
      }
    } finally {
      setWaiveLoading(false);
    }
  };

  const openWaiveModal = (v: PolicyViolation) => {
    setSelectedViolation(v);
    waiveForm.resetFields();
    setWaiveModalVisible(true);
  };

  const openPolicyDetail = (p: PolicyDefinition) => {
    setSelectedPolicy(p);
    setDetailDrawerVisible(true);
  };

  const handleEvaluateGate = async () => {
    try {
      const values = await gateForm.validateFields();
      setGateLoading(true);
      const res = await evaluateGate(values.gateId, {});
      const data = res.data?.data;
      setGateResult((data && typeof data === 'object') ? data as Record<string, unknown> : null);
      message.success('门禁评估完成');
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`评估失败: ${(error as Error).message}`);
      }
    } finally {
      setGateLoading(false);
    }
  };

  // ---- Policy table ----

  const policyColumns: ColumnsType<PolicyDefinition> = [
    {
      title: '策略名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (v: string, record) => (
        <Text strong style={{ cursor: 'pointer' }} onClick={() => openPolicyDetail(record)}>
          {v}
        </Text>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (v: string) => (
        <Tag color={categoryColorMap[v] || 'default'}>{v}</Tag>
      ),
    },
    {
      title: '严重级别',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (v: string) => (
        <Tag color={severityColorMap[v] || 'default'}>
          {severityLabelMap[v] || v}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (v: boolean) => (
        <Tag color={v ? 'green' : 'default'}>{v ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: 'Rego 路径',
      dataIndex: 'regoPath',
      key: 'regoPath',
      ellipsis: true,
      render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 160,
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(v).format('YYYY-MM-DD HH:mm')}
        </Text>
      ),
    },
  ];

  // ---- Violation table ----

  const violationColumns: ColumnsType<PolicyViolation> = [
    {
      title: '策略',
      dataIndex: 'policyName',
      key: 'policyName',
      width: 160,
      render: (v: string) => <Text>{v || '-'}</Text>,
    },
    {
      title: '严重级别',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (v: string) => (
        <Tag color={severityColorMap[v] || 'default'}>
          {severityLabelMap[v] || v}
        </Tag>
      ),
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
    {
      title: '资源',
      dataIndex: 'resourceId',
      key: 'resourceId',
      width: 160,
      render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v || '-'}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => (
        <Tag color={violationStatusColorMap[v] || 'default'}>
          {violationStatusLabelMap[v] || v}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(v).format('YYYY-MM-DD HH:mm')}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) =>
        record.status === 'open' ? (
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openWaiveModal(record)}
          >
            申请豁免
          </Button>
        ) : null,
    },
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
            <CheckSquareOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            质量门禁
          </Title>
          <Text type="secondary">管理质量门禁策略、违规处理和豁免申请</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { loadPolicies(); loadViolations(); }} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<SafetyCertificateOutlined />}
            onClick={() => {
              setGateResult(null);
              setGateModalVisible(true);
            }}
          >
            门禁评估
          </Button>
        </Space>
      </div>

      {/* Stats Panel */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <StatCard
            title="总策略数"
            value={stats.total}
            icon={<SafetyCertificateOutlined />}
          />
        </Col>
        <Col span={6}>
          <StatCard
            title="已启用"
            value={stats.enabled}
            icon={<CheckCircleOutlined />}
            color="#52c41a"
          />
        </Col>
        <Col span={6}>
          <StatCard
            title="未处理违规"
            value={stats.openViolations}
            icon={<ExclamationCircleOutlined />}
            color={stats.openViolations > 0 ? '#faad14' : '#52c41a'}
          />
        </Col>
        <Col span={6}>
          <StatCard
            title="阻塞中"
            value={stats.blocked}
            icon={<CloseCircleOutlined />}
            color={stats.blocked > 0 ? '#ff4d4f' : '#52c41a'}
          />
        </Col>
      </Row>

      {/* Gate Pass Rate */}
      <Card title="门禁通过率趋势" style={{ marginBottom: 24 }}>
        <Row gutter={24}>
          <Col span={8}>
            <Statistic title="通过率" value={stats.total > 0 ? ((stats.total - stats.openViolations) / stats.total * 100).toFixed(1) : 100} suffix="%" />
            <Progress
              percent={stats.total > 0 ? Math.round(((stats.total - stats.openViolations) / stats.total) * 100) : 100}
              status={stats.blocked > 0 ? 'exception' : 'success'}
              style={{ marginTop: 8 }}
            />
          </Col>
          <Col span={8}>
            <Statistic title="已解决违规" value={violations.filter((v) => v.status === 'resolved').length} />
          </Col>
          <Col span={8}>
            <Statistic title="已豁免违规" value={violations.filter((v) => v.status === 'waived').length} />
          </Col>
        </Row>
      </Card>

      {/* Tabs: Policies and Violations */}
      <Card>
        <Tabs
          defaultActiveKey="policies"
          items={[
            {
              key: 'policies',
              label: '门禁策略',
              children: (
                <AntTable<PolicyDefinition>
                  columns={policyColumns}
                  dataSource={policies}
                  loading={loading}
                  rowKey="id"
                  size="middle"
                  pagination={{ pageSize: 20, showSizeChanger: true, showQuickJumper: true }}
                />
              ),
            },
            {
              key: 'violations',
              label: `违规记录 (${stats.openViolations})`,
              children: (
                <>
                  <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
                    <Input.Search
                      placeholder="搜索违规记录..."
                      onSearch={setSearchQuery}
                      style={{ width: 300 }}
                      allowClear
                    />
                    <Select
                      placeholder="严重级别"
                      style={{ width: 120 }}
                      allowClear
                      onChange={(v) => setFilters((prev) => ({ ...prev, severity: v || 'all' }))}
                      options={[
                        { label: '全部', value: 'all' },
                        { label: '阻止', value: 'block' },
                        { label: '警告', value: 'warning' },
                        { label: '信息', value: 'info' },
                      ]}
                    />
                    <Select
                      placeholder="状态"
                      style={{ width: 120 }}
                      allowClear
                      onChange={(v) => setFilters((prev) => ({ ...prev, status: v || 'all' }))}
                      options={[
                        { label: '全部', value: 'all' },
                        { label: '未处理', value: 'open' },
                        { label: '已豁免', value: 'waived' },
                        { label: '已解决', value: 'resolved' },
                      ]}
                    />
                  </div>
                  <AntTable<PolicyViolation>
                    columns={violationColumns}
                    dataSource={filteredViolations}
                    rowKey="id"
                    size="middle"
                    pagination={{ pageSize: 20, showSizeChanger: true, showQuickJumper: true }}
                  />
                </>
              ),
            },
          ]}
        />
      </Card>

      {/* Gate Evaluation Modal */}
      <Modal
        title="门禁评估"
        open={gateModalVisible}
        onCancel={() => setGateModalVisible(false)}
        footer={null}
        width={700}
        destroyOnClose
      >
        <Form form={gateForm} layout="vertical">
          <Form.Item name="gateId" label="门禁 ID" rules={[{ required: true, message: '请选择门禁' }]}>
            <Select
              options={policies.filter((p) => p.gateId).map((p) => ({
                label: p.name,
                value: p.gateId!,
              }))}
              placeholder="选择门禁"
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" onClick={handleEvaluateGate} loading={gateLoading}>
              执行评估
            </Button>
          </Form.Item>
        </Form>
        {gateResult && (
          <div style={{ marginTop: 16 }}>
            <Title level={5}>评估结果</Title>
            <pre
              style={{
                background: '#f5f5f5',
                padding: 16,
                borderRadius: 4,
                fontSize: 13,
                overflow: 'auto',
                maxHeight: 300,
              }}
            >
              {JSON.stringify(gateResult, null, 2)}
            </pre>
          </div>
        )}
      </Modal>

      {/* Waive Modal */}
      <Modal
        title="申请豁免"
        open={waiveModalVisible}
        onCancel={() => setWaiveModalVisible(false)}
        onOk={handleWaive}
        confirmLoading={waiveLoading}
        destroyOnClose
      >
        {selectedViolation && (
          <div style={{ marginBottom: 16 }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="策略">{selectedViolation.policyName}</Descriptions.Item>
              <Descriptions.Item label="违规消息">{selectedViolation.message}</Descriptions.Item>
            </Descriptions>
          </div>
        )}
        <Form form={waiveForm} layout="vertical">
          <Form.Item name="reason" label="豁免原因" rules={[{ required: true, message: '请输入豁免原因' }]}>
            <Input.TextArea rows={3} placeholder="请说明豁免原因..." />
          </Form.Item>
          <Form.Item
            name="expiresAt"
            label="豁免有效期"
            rules={[{ required: true, message: '请选择有效期' }]}
          >
            <Input placeholder="如: 2026-06-01T00:00:00Z" />
          </Form.Item>
          <Form.Item name="scope" label="豁免范围">
            <Select options={[
              { label: '项目级', value: 'project' },
              { label: '全局', value: 'global' },
              { label: '环境级', value: 'environment' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Policy Detail Drawer */}
      <Drawer
        title={selectedPolicy ? selectedPolicy.name : '策略详情'}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={600}
        destroyOnClose
      >
        {selectedPolicy && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="策略名称">{selectedPolicy.name}</Descriptions.Item>
            <Descriptions.Item label="分类">
              <Tag color={categoryColorMap[selectedPolicy.category]}>
                {selectedPolicy.category}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="严重级别">
              <Tag color={severityColorMap[selectedPolicy.severity]}>
                {severityLabelMap[selectedPolicy.severity]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={selectedPolicy.enabled ? 'green' : 'default'}>
                {selectedPolicy.enabled ? '启用' : '禁用'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Rego 路径">{selectedPolicy.regoPath}</Descriptions.Item>
            {selectedPolicy.description && (
              <Descriptions.Item label="描述">{selectedPolicy.description}</Descriptions.Item>
            )}
            <Descriptions.Item label="创建时间">
              {dayjs(selectedPolicy.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {dayjs(selectedPolicy.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};

export default QualityGatePage;
