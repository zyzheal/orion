/**
 * DBA (Database Administration) Page
 * SQL order management, data source management, audit rules
 * Three-tab layout: SQL Orders | Data Sources | Audit Rules
 */
import React, { useState, useEffect } from 'react';
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
  Tabs,
  Spin,
  Popconfirm,
  Badge,
  Statistic,
  Row,
  Col,
  Switch,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  OrderedListOutlined,
  SafetyOutlined,
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  CheckOutlined,
  CloseOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import PageSkeleton from '@/components/PageSkeleton';
import {
  listOrders,
  getOrder,
  createOrder,
  approveOrder,
  rejectOrder,
  executeOrder,
  listDataSources,
  createDataSource,
  updateDataSource,
  deleteDataSource,
  testConnection,
  listAuditRules,
  updateAuditRule,
  type SqlOrder,
  type DataSource,
  type CreateOrderInput,
  type AuditRule,
} from '@/api/dba';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;

// ---- Color Maps ----

const orderStatusColorMap: Record<SqlOrder['status'], string> = {
  pending: 'blue',
  approved: 'green',
  rejected: 'red',
  executing: 'orange',
  completed: 'cyan',
  failed: 'magenta',
};

const orderStatusLabelMap: Record<SqlOrder['status'], string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已拒绝',
  executing: '执行中',
  completed: '已完成',
  failed: '失败',
};

const sqlTypeColorMap: Record<SqlOrder['type'], string> = {
  query: 'purple',
  insert: 'blue',
  update: 'orange',
  delete: 'red',
  ddl: 'cyan',
};

const sqlTypeLabelMap: Record<SqlOrder['type'], string> = {
  query: '查询',
  insert: '插入',
  update: '更新',
  delete: '删除',
  ddl: 'DDL',
};

const dbTypeLabelMap: Record<DataSource['type'], string> = {
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
  redis: 'Redis',
  mongodb: 'MongoDB',
};

// ---- Main Component ----

const DbaPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('orders');

  // Orders state
  const [orders, setOrders] = useState<SqlOrder[]>([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [orderForm] = Form.useForm();
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');

  // Data Sources state
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [dsLoading, setDsLoading] = useState(false);
  const [dsModalVisible, setDsModalVisible] = useState(false);
  const [dsForm] = Form.useForm();
  const [dsSubmitting, setDsSubmitting] = useState(false);
  const [editingDs, setEditingDs] = useState<DataSource | null>(null);
  const [testingDs, setTestingDs] = useState<string | null>(null);

  // Audit Rules state
  const [auditRules, setAuditRules] = useState<AuditRule[]>([]);
  const [ruleLoading, setRuleLoading] = useState(false);

  // ---- Data Loading ----

  const loadOrders = async () => {
    setOrderLoading(true);
    try {
      const res = await listOrders({ tenantId: 'default', page: 1, limit: 100 });
      const list = (res.data as { data?: { data?: SqlOrder[] } })?.data?.data ?? [];
      setOrders(Array.isArray(list) ? list : []);
    } catch (error: unknown) {
      setOrders([]);
      message.error(`加载SQL工单失败: ${(error as Error).message}`);
    } finally {
      setOrderLoading(false);
    }
  };

  const loadDataSources = async () => {
    setDsLoading(true);
    try {
      const res = await listDataSources('default');
      const list = (res.data as { data?: DataSource[] })?.data ?? [];
      setDataSources(Array.isArray(list) ? list : []);
    } catch (error: unknown) {
      setDataSources([]);
      message.error(`加载数据源失败: ${(error as Error).message}`);
    } finally {
      setDsLoading(false);
    }
  };

  const loadAuditRules = async () => {
    setRuleLoading(true);
    try {
      const res = await listAuditRules('default');
      const list = (res.data as { data?: DataSource[] })?.data ?? [];
      setAuditRules((Array.isArray(list) ? list : []) as unknown as AuditRule[]);
    } catch (error: unknown) {
      setAuditRules([]);
      message.error(`加载审计规则失败: ${(error as Error).message}`);
    } finally {
      setRuleLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadOrders(), loadDataSources(), loadAuditRules()]).finally(() =>
      setLoading(false)
    );
  }, []);

  // ---- Order Handlers ----

  const handleCreateOrder = async () => {
    try {
      const values = await orderForm.validateFields();
      setOrderSubmitting(true);
      const payload: CreateOrderInput = {
        database: values.database,
        sql: values.sql,
        comment: values.comment,
        type: values.type || 'query',
      };
      await createOrder(payload);
      message.success('SQL工单创建成功');
      setOrderModalVisible(false);
      orderForm.resetFields();
      loadOrders();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    } finally {
      setOrderSubmitting(false);
    }
  };

  const handleApproveOrder = async (id: string) => {
    try {
      await approveOrder(id);
      message.success('工单已审批通过');
      loadOrders();
    } catch (error: unknown) {
      message.error(`审批失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleRejectOrder = async (id: string) => {
    try {
      await rejectOrder(id, '工单被拒绝');
      message.success('工单已拒绝');
      loadOrders();
    } catch (error: unknown) {
      message.error(`拒绝失败: ${(error as Error).message}`);
    }
  };

  const handleExecuteOrder = async (id: string) => {
    try {
      await executeOrder(id);
      message.success('工单已开始执行');
      loadOrders();
    } catch (error: unknown) {
      message.error(`执行失败: ${(error as Error).message}`);
    }
  };

  // ---- Data Source Handlers ----

  const handleCreateOrUpdateDs = async () => {
    try {
      const values = await dsForm.validateFields();
      setDsSubmitting(true);
      const payload = {
        name: values.name,
        type: values.type,
        host: values.host,
        port: parseInt(values.port, 10),
        database: values.database,
      };
      if (editingDs) {
        await updateDataSource(editingDs.id, payload);
        message.success('数据源更新成功');
      } else {
        await createDataSource(payload);
        message.success('数据源创建成功');
      }
      setDsModalVisible(false);
      setEditingDs(null);
      dsForm.resetFields();
      loadDataSources();
    } catch (error: unknown) {
      message.error(`保存失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setDsSubmitting(false);
    }
  };

  const openDsEditModal = (ds: DataSource) => {
    setEditingDs(ds);
    dsForm.setFieldsValue({
      name: ds.name,
      type: ds.type,
      host: ds.host,
      port: ds.port.toString(),
      database: ds.database,
    });
    setDsModalVisible(true);
  };

  const openDsCreateModal = () => {
    setEditingDs(null);
    dsForm.resetFields();
    setDsModalVisible(true);
  };

  const handleDeleteDs = async (id: string) => {
    try {
      await deleteDataSource(id);
      message.success('数据源已删除');
      loadDataSources();
    } catch (error: unknown) {
      message.error(`删除失败: ${(error as Error).message}`);
    }
  };

  const handleTestConnection = async (id: string) => {
    setTestingDs(id);
    try {
      await testConnection(id);
      message.success('连接测试成功');
    } catch (error: unknown) {
      message.error(`连接测试失败: ${(error as Error).message}`);
    } finally {
      setTestingDs(null);
    }
  };

  // ---- Audit Rule Handlers ----

  const handleToggleRule = async (rule: AuditRule) => {
    try {
      await updateAuditRule(rule.id, { enabled: !rule.enabled });
      message.success(`规则已${rule.enabled ? '禁用' : '启用'}`);
      loadAuditRules();
    } catch (error: unknown) {
      message.error(`更新失败: ${(error as Error).message}`);
    }
  };

  // ---- Filtered Data ----

  const filteredOrders =
    orderStatusFilter === 'all'
      ? orders
      : orders.filter((o) => o.status === orderStatusFilter);

  // ---- Stats ----

  const orderStats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    completed: orders.filter((o) => o.status === 'completed').length,
    failed: orders.filter((o) => o.status === 'failed').length,
  };

  // ---- Order Table Columns ----

  const orderColumns: TableColumn<SqlOrder>[] = [
    {
      key: 'id',
      title: '工单ID',
      dataIndex: 'id',
      width: 120,
      render: (v: unknown) => <Text code>{String(v).slice(0, 8)}</Text>,
    },
    {
      key: 'database',
      title: '数据库',
      dataIndex: 'database',
      width: 140,
      render: (v: unknown) => (
        <Space>
          <DatabaseOutlined style={{ color: colors.primary[500] }} />
          <Text>{String(v)}</Text>
        </Space>
      ),
    },
    {
      key: 'sql',
      title: 'SQL',
      dataIndex: 'sql',
      ellipsis: true,
      render: (v: unknown) => (
        <Text code style={{ fontSize: 12 }}>
          {String(v).slice(0, 60)}
          {String(v).length > 60 ? '...' : ''}
        </Text>
      ),
    },
    {
      key: 'type',
      title: '类型',
      dataIndex: 'type',
      width: 80,
      render: (v: unknown) => (
        <Tag color={sqlTypeColorMap[v as SqlOrder['type']]}>
          {sqlTypeLabelMap[v as SqlOrder['type']]}
        </Tag>
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: unknown) => (
        <Tag color={orderStatusColorMap[v as SqlOrder['status']]}>
          {orderStatusLabelMap[v as SqlOrder['status']]}
        </Tag>
      ),
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (v: unknown) => <Text type="secondary">{String(v)}</Text>,
    },
    {
      key: 'actions',
      title: '操作',
      width: 200,
      render: (_: unknown, record: SqlOrder) => (
        <Space size="small">
          {record.status === 'pending' && (
            <>
              <Button
                type="link"
                size="small"
                style={{ color: colors.success[500] }}
                icon={<CheckOutlined />}
                onClick={() => handleApproveOrder(record.id)}
              >
                审批
              </Button>
              <Popconfirm title="确认拒绝此工单？" onConfirm={() => handleRejectOrder(record.id)}>
                <Button type="link" size="small" danger icon={<CloseOutlined />}>
                  拒绝
                </Button>
              </Popconfirm>
            </>
          )}
          {record.status === 'approved' && (
            <Button
              type="link"
              size="small"
              style={{ color: colors.primary[500] }}
              icon={<PlayCircleOutlined />}
              onClick={() => handleExecuteOrder(record.id)}
            >
              执行
            </Button>
          )}
          {record.status === 'completed' || record.status === 'failed' ? (
            <Button type="link" size="small" onClick={() => getOrder(record.id)}>
              查看结果
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  // ---- Audit Rule Columns ----

  const ruleColumns: TableColumn<AuditRule>[] = [
    {
      key: 'id',
      title: '规则ID',
      dataIndex: 'id',
      width: 100,
      render: (v: unknown) => <Text code>{String(v).slice(0, 8)}</Text>,
    },
    {
      key: 'name',
      title: '规则名称',
      dataIndex: 'name',
      width: 180,
      render: (v: unknown) => <Text strong>{String(v)}</Text>,
    },
    {
      key: 'pattern',
      title: '匹配模式',
      dataIndex: 'pattern',
      render: (v: unknown) => (
        <Text code style={{ fontSize: 12 }}>
          {String(v)}
        </Text>
      ),
    },
    {
      key: 'severity',
      title: '严重级别',
      dataIndex: 'severity',
      width: 100,
      render: (v: unknown) => {
        const severity = v as AuditRule['severity'];
        const colorMap: Record<AuditRule['severity'], string> = {
          info: 'blue',
          warning: 'orange',
          error: 'red',
        };
        const labelMap: Record<AuditRule['severity'], string> = {
          info: '信息',
          warning: '警告',
          error: '错误',
        };
        return <Tag color={colorMap[severity]}>{labelMap[severity]}</Tag>;
      },
    },
    {
      key: 'enabled',
      title: '启用',
      dataIndex: 'enabled',
      width: 80,
      render: (enabled: unknown, record: AuditRule) => (
        <Switch size="small" checked={!!enabled} onChange={() => handleToggleRule(record)} />
      ),
    },
  ];

  // ---- Tab Items ----

  const ordersTab = (
    <div>
      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="工单总数" value={orderStats.total} prefix={<OrderedListOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="待审批"
              value={orderStats.pending}
              valueStyle={{ color: colors.primary[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="已完成"
              value={orderStats.completed}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="失败"
              value={orderStats.failed}
              valueStyle={{ color: colors.error[500] }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filter and Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <Select
            style={{ width: 140 }}
            value={orderStatusFilter}
            onChange={(v) => setOrderStatusFilter(v)}
            options={[
              { label: '全部状态', value: 'all' },
              { label: '待审批', value: 'pending' },
              { label: '已通过', value: 'approved' },
              { label: '已拒绝', value: 'rejected' },
              { label: '执行中', value: 'executing' },
              { label: '已完成', value: 'completed' },
              { label: '失败', value: 'failed' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={loadOrders} loading={orderLoading}>
            刷新
          </Button>
        </Space>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setOrderModalVisible(true)}
        >
          新建工单
        </Button>
      </div>

      {/* Orders Table */}
      <Table
        columns={orderColumns}
        dataSource={filteredOrders}
        loading={orderLoading}
        rowKey="id"
        size="middle"
        striped
      />

      {/* Create Order Modal */}
      <Modal
        title="新建SQL工单"
        open={orderModalVisible}
        onCancel={() => setOrderModalVisible(false)}
        onOk={handleCreateOrder}
        confirmLoading={orderSubmitting}
        width={600}
        destroyOnClose
      >
        <Form form={orderForm} layout="vertical">
          <Form.Item
            name="database"
            label="目标数据库"
            rules={[{ required: true, message: '请输入目标数据库' }]}
          >
            <Input placeholder="如: production_db" />
          </Form.Item>
          <Form.Item
            name="sql"
            label="SQL语句"
            rules={[{ required: true, message: '请输入SQL语句' }]}
          >
            <Input.TextArea rows={6} placeholder="SELECT * FROM users LIMIT 10;" />
          </Form.Item>
          <Form.Item
            name="type"
            label="SQL类型"
            rules={[{ required: true, message: '请选择SQL类型' }]}
            initialValue="query"
          >
            <Select
              options={[
                { label: '查询 (SELECT)', value: 'query' },
                { label: '插入 (INSERT)', value: 'insert' },
                { label: '更新 (UPDATE)', value: 'update' },
                { label: '删除 (DELETE)', value: 'delete' },
                { label: 'DDL (CREATE/ALTER/DROP)', value: 'ddl' },
              ]}
            />
          </Form.Item>
          <Form.Item name="comment" label="备注说明">
            <Input.TextArea rows={2} placeholder="说明执行该SQL的原因..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );

  const dataSourcesTab = (
    <div>
      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadDataSources} loading={dsLoading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openDsCreateModal}>
            添加数据源
          </Button>
        </Space>
      </div>

      {/* Data Source Cards */}
      <Spin spinning={dsLoading}>
        {dataSources.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: 40 }}>
            <DatabaseOutlined style={{ fontSize: 48, color: colors.neutral[300] }} />
            <p style={{ marginTop: 16, color: colors.neutral[500] }}>暂无数据源，请添加</p>
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {dataSources.map((ds) => (
              <Col xs={24} sm={12} md={8} lg={6} key={ds.id}>
                <Card
                  size="small"
                  hoverable
                  actions={[
                    <Button
                      key="test"
                      type="link"
                      size="small"
                      icon={<ThunderboltOutlined />}
                      loading={testingDs === ds.id}
                      onClick={() => handleTestConnection(ds.id)}
                    >
                      测试连接
                    </Button>,
                    <Button
                      key="edit"
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => openDsEditModal(ds)}
                    >
                      编辑
                    </Button>,
                    <Popconfirm
                      key="delete"
                      title="确认删除此数据源？"
                      onConfirm={() => handleDeleteDs(ds.id)}
                    >
                      <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                        删除
                      </Button>
                    </Popconfirm>,
                  ]}
                >
                  <div style={{ marginBottom: 8 }}>
                    <Space>
                      <DatabaseOutlined style={{ color: colors.primary[500] }} />
                      <Text strong>{ds.name}</Text>
                    </Space>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <Badge
                      status={
                        ds.status === 'online'
                          ? 'success'
                          : ds.status === 'offline'
                            ? 'default'
                            : 'error'
                      }
                      text={ds.status}
                    />
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dbTypeLabelMap[ds.type]}
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {ds.host}:{ds.port}
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    DB: {ds.database}
                  </Text>
                  {ds.lastChecked && (
                    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                      最后检测: {ds.lastChecked}
                    </Text>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Spin>

      {/* Data Source Modal */}
      <Modal
        title={editingDs ? '编辑数据源' : '添加数据源'}
        open={dsModalVisible}
        onCancel={() => {
          setDsModalVisible(false);
          setEditingDs(null);
          dsForm.resetFields();
        }}
        onOk={handleCreateOrUpdateDs}
        confirmLoading={dsSubmitting}
        width={500}
        destroyOnClose
      >
        <Form form={dsForm} layout="vertical">
          <Form.Item
            name="name"
            label="数据源名称"
            rules={[{ required: true, message: '请输入数据源名称' }]}
          >
            <Input placeholder="如: production-mysql" />
          </Form.Item>
          <Form.Item
            name="type"
            label="数据库类型"
            rules={[{ required: true, message: '请选择数据库类型' }]}
          >
            <Select
              options={[
                { label: 'MySQL', value: 'mysql' },
                { label: 'PostgreSQL', value: 'postgresql' },
                { label: 'Redis', value: 'redis' },
                { label: 'MongoDB', value: 'mongodb' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="host"
            label="主机地址"
            rules={[{ required: true, message: '请输入主机地址' }]}
          >
            <Input placeholder="如: 10.0.0.1" />
          </Form.Item>
          <Form.Item
            name="port"
            label="端口"
            rules={[{ required: true, message: '请输入端口号' }]}
          >
            <Input placeholder="如: 3306" />
          </Form.Item>
          <Form.Item
            name="database"
            label="数据库名"
            rules={[{ required: true, message: '请输入数据库名' }]}
          >
            <Input placeholder="如: orion_prod" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );

  const auditRulesTab = (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={loadAuditRules} loading={ruleLoading}>
          刷新
        </Button>
      </div>
      <Table
        columns={ruleColumns}
        dataSource={auditRules}
        loading={ruleLoading}
        rowKey="id"
        size="middle"
        striped
      />
    </div>
  );

  const tabItems = [
    {
      key: 'orders',
      label: (
        <span>
          <OrderedListOutlined /> SQL工单
        </span>
      ),
      children: ordersTab,
    },
    {
      key: 'datasources',
      label: (
        <span>
          <DatabaseOutlined /> 数据源
        </span>
      ),
      children: dataSourcesTab,
    },
    {
      key: 'audit',
      label: (
        <span>
          <SafetyOutlined /> 审计规则
        </span>
      ),
      children: auditRulesTab,
    },
  ];

  const isInitialLoading = loading && orders.length === 0 && dataSources.length === 0;

  return (
    <div style={{ padding: 0 }}>
      {isInitialLoading ? (
        <PageSkeleton cards={4} rows={8} />
      ) : (
        <>
          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <Title level={2} style={{ marginBottom: 8 }}>
            <DatabaseOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
              <DatabaseOutlined style={{ marginRight: 8, color: colors.primary[500] }} />
              数据库管理
            </Title>
            <Text type="secondary">管理SQL工单、数据源和审计规则</Text>
          </div>

          {/* Tabs */}
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            size="large"
          />
        </>
      )}
    </div>
  );
};

export default DbaPage;
