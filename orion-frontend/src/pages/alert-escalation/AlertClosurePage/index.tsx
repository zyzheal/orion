/**
 * 告警闭环与升级策略 (Alert Closure & Escalation)
 * /api/v1/alert-escalation — 策略管理 · 升级触发器 · 告警闭环 · MTTR
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Space,
  Row,
  Col,
  message,
  Typography,
  Empty,
  Descriptions,
  Popconfirm,
  Tabs,
} from 'antd';
import {
  BellOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { colors, spacing, themeVars } from '@/tokens';
import {
  listPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  evaluatePolicy,
  listTriggers,
  resolveTrigger,
  listClosures,
  acknowledgeAlert,
  resolveAlert,
  getMetrics,
  type EscalationPolicy,
  type EscalationTrigger,
  type AlertClosure,
  type AlertMetrics,
} from '@/api/alertEscalation';

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const SEVERITY_MAP: Record<string, { color: string; label: string }> = {
  critical: { color: 'red', label: '致命' },
  warning: { color: 'orange', label: '警告' },
  info: { color: 'blue', label: '信息' },
};

const CLOSURE_STATUS: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: '待确认' },
  acknowledged: { color: 'gold', label: '已确认' },
  resolved: { color: 'green', label: '已解决' },
};

const AlertClosurePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'policies' | 'closures' | 'metrics'>('policies');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [form] = Form.useForm();

  const [policies, setPolicies] = useState<EscalationPolicy[]>([]);
  const [triggers, setTriggers] = useState<EscalationTrigger[]>([]);
  const [closures, setClosures] = useState<AlertClosure[]>([]);
  const [metrics, setMetrics] = useState<AlertMetrics | null>(null);
  const [policyStatus, setPolicyStatus] = useState<string>('');

  const operator = localStorage.getItem('username') || 'system';

  const loadPolicies = useCallback(async () => {
    try {
      const data = await listPolicies();
      setPolicies(Array.isArray(data) ? data : []);
    } catch {
      setPolicies([]);
    }
  }, []);

  const loadTriggers = useCallback(async () => {
    try {
      const data = await listTriggers();
      setTriggers(Array.isArray(data) ? data : []);
    } catch {
      setTriggers([]);
    }
  }, []);

  const loadClosures = useCallback(async () => {
    try {
      const data = await listClosures(policyStatus || undefined);
      setClosures(Array.isArray(data) ? data : []);
    } catch {
      setClosures([]);
    }
  }, [policyStatus]);

  const loadMetrics = useCallback(async () => {
    try {
      const data = await getMetrics();
      setMetrics(data || {});
    } catch {
      setMetrics(null);
    }
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      if (activeTab === 'policies') {
        await Promise.all([loadPolicies(), loadTriggers()]);
      } else if (activeTab === 'closures') await loadClosures();
      else await loadMetrics();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleRefresh();
  }, [activeTab]);

  // --- Policy CRUD ---
  const handleCreate = () => {
    setSelectedItem(null);
    form.resetFields();
    setModalOpen(true);
  };
  const handleEdit = (r: EscalationPolicy) => {
    setSelectedItem(r);
    form.setFieldsValue(r);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      let rulesObj = values.rules;
      if (typeof rulesObj === 'string') {
        try {
          rulesObj = JSON.parse(rulesObj);
        } catch {
          message.error('Rules 格式无效');
          return;
        }
      }
      if (!Array.isArray(rulesObj) || rulesObj.length === 0) {
        message.error('至少需要一条升级规则');
        return;
      }

      if (selectedItem) {
        await updatePolicy(selectedItem.id, values);
        message.success('策略更新成功');
      } else {
        await createPolicy(values);
        message.success('策略创建成功');
      }
      setModalOpen(false);
      form.resetFields();
      loadPolicies();
    } catch {
      /* validated */
    }
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后不可恢复，确定要删除吗？',
      onOk: async () => {
        try {
          await deletePolicy(id);
          message.success('删除成功');
          loadPolicies();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const handleViewDetail = (r: EscalationPolicy) => {
    setSelectedItem(r);
    setDetailOpen(true);
  };

  const handleEvaluate = async (policy: EscalationPolicy) => {
    try {
      const data = await evaluatePolicy(policy.id, policy.severity || 'critical');
      message.success(`已触发 ${Array.isArray(data) ? data.length : 0} 个升级动作`);
      loadTriggers();
    } catch {
      message.error('评估失败');
    }
  };

  // --- Closure actions ---
  const handleAcknowledge = async (closure: AlertClosure) => {
    try {
      await acknowledgeAlert(closure.alertId, operator);
      message.success('告警已确认');
      loadClosures();
    } catch {
      message.error('确认失败');
    }
  };

  const handleResolve = (closure: AlertClosure) => {
    Modal.confirm({
      title: '确认解决',
      content: (
        <TextArea
          rows={3}
          placeholder="请填写解决说明"
          onChange={(e) => {
            closure.resolutionNote = e.target.value;
          }}
        />
      ),
      onOk: async () => {
        try {
          await resolveAlert(closure.alertId, operator, closure.resolutionNote);
          message.success('告警已解决');
          loadClosures();
          loadMetrics();
        } catch {
          message.error('解决失败');
        }
      },
    });
  };

  const handleTriggerResolve = async (trigger: EscalationTrigger) => {
    try {
      await resolveTrigger(trigger.id);
      message.success('触发器已解决');
      loadTriggers();
    } catch {
      message.error('解决失败');
    }
  };

  // --- Columns ---
  const policyColumns = [
    { title: '策略名', dataIndex: 'name', key: 'name' },
    {
      title: '严重度',
      dataIndex: 'severity',
      key: 'severity',
      render: (v: string) => (
        <Tag color={SEVERITY_MAP[v]?.color}>{SEVERITY_MAP[v]?.label || v}</Tag>
      ),
    },
    {
      title: '规则数',
      key: 'rulesCount',
      render: (_: any, r: EscalationPolicy) => r.rules?.length || 0,
    },
    { title: '创建者', dataIndex: 'createdBy', key: 'createdBy', width: 100 },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      render: (_: any, r: EscalationPolicy) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(r)}
          >
            详情
          </Button>
          <Button type="link" size="small" onClick={() => handleEvaluate(r)}>
            模拟
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>
            编辑
          </Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const triggerColumns = [
    { title: '触发器ID', dataIndex: 'id', key: 'id', width: 80, ellipsis: true },
    { title: '策略ID', dataIndex: 'policyId', key: 'policyId', width: 100, ellipsis: true },
    { title: '告警ID', dataIndex: 'alertId', key: 'alertId', width: 100, ellipsis: true },
    { title: '层级', dataIndex: 'level', key: 'level', width: 60 },
    { title: '目标', dataIndex: 'target', key: 'target' },
    { title: '渠道', dataIndex: 'channel', key: 'channel', width: 80 },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag>{v}</Tag> },
    {
      title: '触发时间',
      dataIndex: 'triggeredAt',
      key: 'triggeredAt',
      width: 160,
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: any, r: EscalationTrigger) =>
        r.status === 'pending' ? (
          <Button type="link" size="small" onClick={() => handleTriggerResolve(r)}>
            解决
          </Button>
        ) : null,
    },
  ];

  const closureColumns = [
    { title: '告警ID', dataIndex: 'alertId', key: 'alertId', width: 120, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: string) => (
        <Tag color={CLOSURE_STATUS[v]?.color}>{CLOSURE_STATUS[v]?.label || v}</Tag>
      ),
    },
    {
      title: '确认人',
      dataIndex: 'acknowledgedBy',
      key: 'acknowledgedBy',
      width: 90,
      render: (v: string) => v || '-',
    },
    {
      title: '确认时间',
      dataIndex: 'acknowledgedAt',
      key: 'acknowledgedAt',
      width: 160,
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '解决人',
      dataIndex: 'resolvedBy',
      key: 'resolvedBy',
      width: 90,
      render: (v: string) => v || '-',
    },
    {
      title: '解决时间',
      dataIndex: 'resolvedAt',
      key: 'resolvedAt',
      width: 160,
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: 'MTTR',
      dataIndex: 'mttrSeconds',
      key: 'mttrSeconds',
      width: 90,
      render: (v: number) => (v > 0 ? `${v}s` : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, r: AlertClosure) => (
        <Space>
          {r.status === 'pending' && (
            <Button type="link" size="small" onClick={() => handleAcknowledge(r)}>
              确认
            </Button>
          )}
          {(r.status === 'pending' || r.status === 'acknowledged') && (
            <Button type="link" size="small" onClick={() => handleResolve(r)}>
              解决
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: 8 }}>
        <BellOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        告警闭环与升级策略
      </Title>
      <Typography.Text type="secondary" style={{ marginBottom: spacing.md, display: 'block' }}>
        升级策略管理 · 告警确认与解决 · MTTR 指标追踪
      </Typography.Text>

      <Tabs activeKey={activeTab} onChange={(k) => setActiveTab(k as any)}>
        <Tabs.TabPane tab={`升级策略 (${policies.length})`} key="policies" />
        <Tabs.TabPane tab={`告警闭环 (${closures.length})`} key="closures" />
        <Tabs.TabPane tab="MTTR 指标" key="metrics" />
      </Tabs>

      {activeTab === 'policies' && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Card
            title="升级策略"
            extra={
              <Space>
                <Button
                  icon={<ReloadOutlined />}
                  size="small"
                  onClick={handleRefresh}
                  loading={loading}
                >
                  刷新
                </Button>
                <Button type="primary" size="small" onClick={handleCreate}>
                  新建策略
                </Button>
              </Space>
            }
          >
            <Table
              columns={policyColumns}
              dataSource={policies}
              rowKey="id"
              loading={loading}
              size="small"
              locale={{ emptyText: <Empty description="暂无升级策略" /> }}
              pagination={{ pageSize: 10 }}
            />
          </Card>
          <Card
            title="升级触发器"
            extra={
              <Button icon={<ReloadOutlined />} size="small" onClick={loadTriggers}>
                刷新
              </Button>
            }
          >
            <Table
              columns={triggerColumns}
              dataSource={triggers}
              rowKey="id"
              size="small"
              locale={{ emptyText: <Empty description="暂无触发记录" /> }}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </Space>
      )}

      {activeTab === 'closures' && (
        <Card
          title="告警闭环"
          extra={
            <Space>
              <Select
                style={{ width: 120 }}
                value={policyStatus}
                onChange={setPolicyStatus}
                allowClear
                placeholder="状态"
              >
                <Option value="pending">待确认</Option>
                <Option value="acknowledged">已确认</Option>
                <Option value="resolved">已解决</Option>
              </Select>
              <Button
                icon={<ReloadOutlined />}
                size="small"
                onClick={loadClosures}
                loading={loading}
              >
                刷新
              </Button>
            </Space>
          }
        >
          <Table
            columns={closureColumns}
            dataSource={closures}
            rowKey="id"
            loading={loading}
            size="small"
            locale={{ emptyText: <Empty description="暂无告警记录" /> }}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      )}

      {activeTab === 'metrics' && metrics && (
        <Row gutter={[spacing.md, spacing.md]}>
          <Col span={6}>
            <Card>
              <Typography.Text type="secondary">总告警数</Typography.Text>
              <div style={{ fontSize: 24, fontWeight: 600, color: colors.primary[500] }}>
                {metrics.totalAlerts}
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Typography.Text type="secondary">待确认</Typography.Text>
              <div style={{ fontSize: 24, fontWeight: 600, color: colors.warning[500] }}>
                {metrics.openCount}
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Typography.Text type="secondary">已确认</Typography.Text>
              <div style={{ fontSize: 24, fontWeight: 600, color: colors.info[500] }}>
                {metrics.acknowledgedCount}
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Typography.Text type="secondary">已解决</Typography.Text>
              <div style={{ fontSize: 24, fontWeight: 600, color: colors.success[500] }}>
                {metrics.resolvedCount}
              </div>
            </Card>
          </Col>
          <Col span={24}>
            <Card>
              <Typography.Text type="secondary">平均 MTTR</Typography.Text>
              <div
                style={{ fontSize: 32, fontWeight: 700, color: colors.purple[500], marginTop: 4 }}
              >
                {metrics.avgMTTRFormatted || '0s'}
              </div>
              <Typography.Text type="secondary">({metrics.avgMTTRSeconds} 秒)</Typography.Text>
            </Card>
          </Col>
        </Row>
      )}

      <Modal
        title={selectedItem ? '编辑策略' : '新建策略'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={640}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="策略名称"
            rules={[{ required: true, message: '请输入策略名称' }]}
          >
            <Input placeholder="e.g. 生产环境致命告警升级策略" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="severity" label="严重度" rules={[{ required: true }]}>
            <Select>
              <Option value="critical">致命</Option>
              <Option value="warning">警告</Option>
              <Option value="info">信息</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="rules"
            label="升级规则 (JSON 数组)"
            rules={[{ required: true, message: '请配置升级规则' }]}
          >
            <TextArea
              rows={6}
              placeholder={JSON.stringify(
                [
                  { level: 1, delayMinutes: 5, target: 'oncall', channel: 'webhook' },
                  { level: 2, delayMinutes: 15, target: 'manager', channel: 'sms' },
                ],
                null,
                2
              )}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="策略详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={<Button onClick={() => setDetailOpen(false)}>关闭</Button>}
        width={600}
      >
        {selectedItem && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="策略名称">{selectedItem.name}</Descriptions.Item>
            <Descriptions.Item label="严重度">
              <Tag color={SEVERITY_MAP[selectedItem.severity]?.color}>
                {SEVERITY_MAP[selectedItem.severity]?.label || selectedItem.severity}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建者">{selectedItem.createdBy}</Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {selectedItem.createdAt ? new Date(selectedItem.createdAt).toLocaleString() : '-'}
            </Descriptions.Item>
            {selectedItem.description && (
              <Descriptions.Item label="描述">{selectedItem.description}</Descriptions.Item>
            )}
            {selectedItem.rules && (
              <Descriptions.Item label="升级规则">
                <pre
                  style={{
                    margin: 0,
                    fontSize: 12,
                    maxHeight: 200,
                    overflow: 'auto',
                    background: themeVars.bgSecondary,
                    padding: 8,
                    borderRadius: 4,
                  }}
                >
                  {JSON.stringify(selectedItem.rules, null, 2)}
                </pre>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default AlertClosurePage;
