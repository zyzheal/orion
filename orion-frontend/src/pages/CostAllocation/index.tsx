/**
 * Cost Allocation Page
 *
 * Features:
 * - Cost summary cards (total, compute, storage, network) with month selector
 * - Top expensive namespaces table
 * - Cost trend display (month-over-month data)
 * - Budget management CRUD (list/create/edit/delete budgets)
 * - Budget alerts display
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Space,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Row,
  Col,
  Statistic,
  Progress,
  Popconfirm,
  Empty,
  Switch,
  InputNumber,
  message,
} from 'antd';
import {
  DollarOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  WarningOutlined,
  BarChartOutlined,
  ClusterOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { colors, spacing } from '@/tokens';
import {
  getCostSummary,
  getCostTrend,
  getTopNamespaces,
  listBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  checkBudgetAlerts,
  type CostSummary,
  type CostTrend,
  type FinopsBudget,
  type CreateBudgetInput,
  type UpdateBudgetInput,
} from '@/api/cost-allocation';

const { Title, Text } = Typography;

const scopeTypeLabel: Record<string, string> = {
  cluster: '集群',
  namespace: '命名空间',
  team: '团队',
};

const scopeTypeColor: Record<string, string> = {
  cluster: 'blue',
  namespace: 'cyan',
  team: 'purple',
};

export default function CostAllocationPage() {
  // --- State ---
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [trend, setTrend] = useState<CostTrend[]>([]);
  const [topNamespaces, setTopNamespaces] = useState<{ namespace: string; cost: number }[]>([]);
  const [budgets, setBudgets] = useState<FinopsBudget[]>([]);
  const [alerts, setAlerts] = useState<{ budgetId: string; budgetName: string; currentSpend: number; limit: number; exceeded: boolean }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [budgetConfirmLoading, setBudgetConfirmLoading] = useState(false);
  const [editingBudget, setEditingBudget] = useState<FinopsBudget | null>(null);
  const [form] = Form.useForm();

  // --- Data Fetching ---
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, trendRes, nsRes, budgetRes, alertRes] = await Promise.all([
        getCostSummary({ month: selectedMonth }),
        getCostTrend({ months: 6 }),
        getTopNamespaces({ month: selectedMonth, limit: 10 }),
        listBudgets(),
        checkBudgetAlerts(),
      ]);
      setSummary(summaryRes.data ?? null);
      setTrend(trendRes.data ?? []);
      setTopNamespaces(nsRes.data ?? []);
      setBudgets(budgetRes.data ?? []);
      setAlerts(alertRes.data ?? []);
    } catch {
      message.error('获取成本数据失败');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // --- Month Selector ---
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const m = dayjs().subtract(i, 'month');
    return { label: m.format('YYYY-MM'), value: m.format('YYYY-MM') };
  });

  // --- Budget CRUD Handlers ---
  const handleCreateBudget = () => {
    setEditingBudget(null);
    form.resetFields();
    form.setFieldsValue({ enabled: true, alertThreshold: 80, currency: 'CNY' });
    setBudgetModalVisible(true);
  };

  const handleEditBudget = (record: FinopsBudget) => {
    setEditingBudget(record);
    form.setFieldsValue({
      name: record.name,
      scopeType: record.scopeType,
      scopeValue: record.scopeValue,
      monthlyLimit: record.monthlyLimit,
      currency: record.currency,
      alertThreshold: record.alertThreshold,
      enabled: record.enabled,
    });
    setBudgetModalVisible(true);
  };

  const handleSaveBudget = async () => {
    try {
      const values = await form.validateFields();
      setBudgetConfirmLoading(true);
      if (editingBudget) {
        const updateInput: UpdateBudgetInput = {
          name: values.name,
          monthlyLimit: values.monthlyLimit,
          alertThreshold: values.alertThreshold,
          enabled: values.enabled,
        };
        await updateBudget(editingBudget.id, updateInput);
        message.success('预算更新成功');
      } else {
        const createInput: CreateBudgetInput = {
          name: values.name,
          scopeType: values.scopeType,
          scopeValue: values.scopeValue,
          monthlyLimit: values.monthlyLimit,
          currency: values.currency,
          alertThreshold: values.alertThreshold,
          enabled: values.enabled,
        };
        await createBudget(createInput);
        message.success('预算创建成功');
      }
      setBudgetModalVisible(false);
      fetchAll();
    } catch (err: any) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('保存失败');
    } finally {
      setBudgetConfirmLoading(false);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    try {
      await deleteBudget(id);
      message.success('预算删除成功');
      fetchAll();
    } catch {
      message.error('删除失败');
    }
  };

  // --- Format Helpers ---
  const formatCost = (value?: number | null) => {
    if (value == null) return '-';
    return `\u00a5${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // --- Namespace Table Columns ---
  const namespaceColumns: ColumnsType<{ namespace: string; cost: number }> = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_, __, index) => (
        <Tag color={index < 3 ? colors.error[500] : 'default'}>{index + 1}</Tag>
      ),
    },
    {
      title: '命名空间',
      dataIndex: 'namespace',
      key: 'namespace',
      render: (text: string) => (
        <Space>
          <ClusterOutlined style={{ color: colors.primary[500] }} />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: '本月费用',
      dataIndex: 'cost',
      key: 'cost',
      align: 'right',
      sorter: (a, b) => a.cost - b.cost,
      render: (cost: number) => (
        <Text style={{ color: cost > 10000 ? colors.error[500] : colors.neutral[900], fontWeight: 600 }}>
          {formatCost(cost)}
        </Text>
      ),
    },
  ];

  // --- Trend Table Columns ---
  const trendColumns: ColumnsType<CostTrend> = [
    {
      title: '月份',
      dataIndex: 'month',
      key: 'month',
      render: (text: string) => <Tag>{text}</Tag>,
    },
    {
      title: '总费用',
      dataIndex: 'totalCost',
      key: 'totalCost',
      align: 'right',
      render: (v: number) => <Text strong>{formatCost(v)}</Text>,
    },
    {
      title: '计算',
      dataIndex: 'computeCost',
      key: 'computeCost',
      align: 'right',
      render: (v: number) => formatCost(v),
    },
    {
      title: '存储',
      dataIndex: 'storageCost',
      key: 'storageCost',
      align: 'right',
      render: (v: number) => formatCost(v),
    },
    {
      title: '环比变化',
      key: 'change',
      align: 'right',
      render: (_, __, index) => {
        if (index >= trend.length - 1) return '-';
        const current = trend[index].totalCost;
        const prev = trend[index + 1].totalCost;
        if (!prev) return '-';
        const pct = ((current - prev) / prev) * 100;
        const isUp = pct > 0;
        return (
          <Text style={{ color: isUp ? colors.error[500] : colors.success[500] }}>
            {isUp ? '+' : ''}{pct.toFixed(1)}%
          </Text>
        );
      },
    },
  ];

  // --- Budget Table Columns ---
  const budgetColumns: ColumnsType<FinopsBudget> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '范围类型',
      dataIndex: 'scopeType',
      key: 'scopeType',
      render: (type: string) => <Tag color={scopeTypeColor[type]}>{scopeTypeLabel[type] ?? type}</Tag>,
    },
    {
      title: '范围值',
      dataIndex: 'scopeValue',
      key: 'scopeValue',
    },
    {
      title: '月度限额',
      dataIndex: 'monthlyLimit',
      key: 'monthlyLimit',
      align: 'right',
      render: (v: number, record) => formatCost(v) + (record.currency ? ` ${record.currency}` : ''),
    },
    {
      title: '告警阈值',
      dataIndex: 'alertThreshold',
      key: 'alertThreshold',
      align: 'center',
      render: (v: number) => <Tag color="orange">{v}%</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      align: 'center',
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'green' : 'default'}>{enabled ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditBudget(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除此预算？" onConfirm={() => handleDeleteBudget(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // --- Alerts ---
  const activeAlerts = alerts.filter(a => a.currentSpend / a.limit >= (a.exceeded ? 1 : 0));

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: 16 }}>
        <DollarOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        成本分配
      </Title>

      {/* --- Month Selector + Refresh --- */}
      <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
        <Col>
          <Space>
            <Text>选择月份：</Text>
            <Select
              value={selectedMonth}
              onChange={setSelectedMonth}
              options={monthOptions}
              style={{ width: 140 }}
            />
          </Space>
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={fetchAll} loading={loading}>
            刷新
          </Button>
        </Col>
      </Row>

      {/* --- Cost Summary Cards --- */}
      <Row gutter={16} style={{ marginBottom: spacing.lg }}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <Statistic
              title={<Text style={{ color: colors.neutral[500] }}>本月总费用</Text>}
              value={summary?.totalCost ?? 0}
              precision={2}
              prefix={<DollarOutlined style={{ color: colors.primary[500] }} />}
              suffix="CNY"
              valueStyle={{ color: colors.neutral[900], fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <Statistic
              title={<Text style={{ color: colors.neutral[500] }}>计算费用</Text>}
              value={summary?.computeCost ?? 0}
              precision={2}
              prefix="&#x2699;"
              suffix="CNY"
              valueStyle={{ color: colors.primary[500], fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <Statistic
              title={<Text style={{ color: colors.neutral[500] }}>存储费用</Text>}
              value={summary?.storageCost ?? 0}
              precision={2}
              prefix="&#x1f4c1;"
              suffix="CNY"
              valueStyle={{ color: colors.warning[500], fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <Statistic
              title={<Text style={{ color: colors.neutral[500] }}>网络费用</Text>}
              value={summary?.networkCost ?? 0}
              precision={2}
              prefix="&#x1f310;"
              suffix="CNY"
              valueStyle={{ color: colors.success[500], fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* --- Budget Alerts --- */}
      {activeAlerts.length > 0 && (
        <Card
          title={
            <Space>
              <WarningOutlined style={{ color: colors.warning[500] }} />
              <Text strong>预算告警</Text>
            </Space>
          }
          style={{
            borderRadius: 12,
            marginBottom: spacing.lg,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
            borderLeft: `3px solid ${colors.warning[500]}`,
          }}
        >
          <Row gutter={[16, 16]}>
            {activeAlerts.map(alert => {
              const pct = Math.min(Math.round((alert.currentSpend / alert.limit) * 100), 100);
              const isOver = alert.exceeded || pct >= 100;
              return (
                <Col xs={24} sm={12} lg={8} key={alert.budgetId}>
                  <Card size="small" style={{ borderRadius: 8, background: isOver ? '#fff2f0' : '#fffbe6' }}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Row justify="space-between">
                        <Text strong>{alert.budgetName}</Text>
                        <Tag color={isOver ? 'red' : 'orange'}>{isOver ? '已超限' : '接近限额'}</Tag>
                      </Row>
                      <Progress
                        percent={pct}
                        status={isOver ? 'exception' : 'active'}
                        strokeColor={isOver ? colors.error[500] : colors.warning[500]}
                        format={() => `${formatCost(alert.currentSpend)} / ${formatCost(alert.limit)}`}
                      />
                    </Space>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </Card>
      )}

      {/* --- Top Namespaces + Cost Trend --- */}
      <Row gutter={16} style={{ marginBottom: spacing.lg }}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <ClusterOutlined style={{ color: colors.primary[500] }} />
                <Text strong>Top 10 高费用命名空间</Text>
              </Space>
            }
            style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}
          >
            {topNamespaces.length === 0 ? (
              <Empty description="暂无数据" />
            ) : (
              <Table
                columns={namespaceColumns}
                dataSource={topNamespaces}
                rowKey="namespace"
                size="small"
                pagination={false}
                loading={loading}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <BarChartOutlined style={{ color: colors.primary[500] }} />
                <Text strong>费用趋势（近 6 个月）</Text>
              </Space>
            }
            style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}
          >
            {trend.length === 0 ? (
              <Empty description="暂无数据" />
            ) : (
              <Table
                columns={trendColumns}
                dataSource={[...trend].reverse()}
                rowKey="month"
                size="small"
                pagination={false}
                loading={loading}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* --- Budget Management --- */}
      <Card
        title={
          <Space>
            <DollarOutlined style={{ color: colors.primary[500] }} />
            <Text strong>预算管理</Text>
          </Space>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateBudget}>
            创建预算
          </Button>
        }
        style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}
      >
        {budgets.length === 0 ? (
          <Empty description="暂无预算">
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateBudget}>
              创建第一个预算
            </Button>
          </Empty>
        ) : (
          <Table
            columns={budgetColumns}
            dataSource={budgets}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        )}
      </Card>

      {/* --- Budget Create/Edit Modal --- */}
      <Modal
        title={editingBudget ? '编辑预算' : '创建预算'}
        open={budgetModalVisible}
        onOk={handleSaveBudget}
        confirmLoading={budgetConfirmLoading}
        onCancel={() => setBudgetModalVisible(false)}
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
          <Form.Item name="name" label="预算名称" rules={[{ required: true, message: '请输入预算名称' }]}>
            <Input placeholder="例如：生产集群-计算预算" style={{ height: 36 }} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="scopeType" label="范围类型" rules={[{ required: true, message: '请选择范围类型' }]}>
                <Select placeholder="选择范围类型" style={{ height: 36 }}>
                  <Select.Option value="cluster">集群</Select.Option>
                  <Select.Option value="namespace">命名空间</Select.Option>
                  <Select.Option value="team">团队</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="scopeValue" label="范围值" rules={[{ required: true, message: '请输入范围值' }]}>
                <Input placeholder="例如：prod-cluster" style={{ height: 36 }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="monthlyLimit" label="月度限额" rules={[{ required: true, message: '请输入月度限额' }]}>
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%', height: 36 }}
                  placeholder="例如：50000"
                  addonAfter="CNY"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="alertThreshold" label="告警阈值 (%)">
                <InputNumber
                  min={1}
                  max={100}
                  style={{ width: '100%', height: 36 }}
                  placeholder="80"
                  addonAfter="%"
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="currency" label="币种">
                <Select style={{ height: 36 }}>
                  <Select.Option value="CNY">CNY (人民币)</Select.Option>
                  <Select.Option value="USD">USD (美元)</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="enabled" label="启用" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
