/**
 * Distributed Config Center Page
 * 命名空间 → 配置分组 → 配置项 CRUD → 快照发布/回滚 → 变更审计
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
  Tabs,
  Descriptions,
  TreeSelect,
  InputNumber,
  Popconfirm,
  Divider,
  Spin,
} from 'antd';
import {
  SettingOutlined,
  PlusOutlined,
  ReloadOutlined,
  CloudUploadOutlined,
  RollbackOutlined,
  HistoryOutlined,
  FolderOutlined,
  DatabaseOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import {
  listNamespaces,
  createNamespace,
  listGroups,
  createGroup,
  listItems,
  createItem,
  updateItem,
  deleteItem,
  getItemHistory,
  publishSnapshot,
  listSnapshots,
  publishRelease,
  rollbackRelease,
  listReleases,
  listAudit,
  type ConfigNamespace,
  type ConfigGroup,
  type ConfigItem,
  type ConfigSnapshot,
  type ConfigRelease,
  type ConfigAudit,
  type ValueType,
} from '@/api/distributedConfig';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// ==================== Page ====================

const ConfigCenterPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('items');
  const [loading, setLoading] = useState(false);

  // Namespace / Group state
  const [namespaces, setNamespaces] = useState<ConfigNamespace[]>([]);
  const [groups, setGroups] = useState<ConfigGroup[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>();
  const [selectedGroup, setSelectedGroup] = useState<string>();

  // Items
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ConfigItem | null>(null);

  // Snapshot / Release
  const [snapshots, setSnapshots] = useState<ConfigSnapshot[]>([]);
  const [releases, setReleases] = useState<ConfigRelease[]>([]);
  const [selectedEnv, setSelectedEnv] = useState('default');

  // Audit
  const [audits, setAudits] = useState<ConfigAudit[]>([]);

  // Namespace modal
  const [nsModalOpen, setNsModalOpen] = useState(false);
  const [nsForm] = Form.useForm();
  const [groupForm] = Form.useForm();
  const [itemForm] = Form.useForm();
  const [releaseForm] = Form.useForm();
  const [rollbackForm] = Form.useForm();
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const operator = localStorage.getItem('username') || 'system';

  // ==================== Loaders ====================

  const loadNamespaces = useCallback(async () => {
    try {
      const res = await listNamespaces();
      setNamespaces(Array.isArray(res) ? res : ([]));
    } catch {
      setNamespaces([]);
    }
  }, []);

  const loadGroups = useCallback(async (nsId?: string) => {
    try {
      const res = await listGroups(nsId);
      setGroups(Array.isArray(res) ? res : ([]));
    } catch {
      setGroups([]);
    }
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listItems(selectedGroup || undefined);
      setItems(Array.isArray(res) ? res : ([]));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [selectedGroup]);

  const loadSnapshots = useCallback(async () => {
    try {
      const res = await listSnapshots(selectedGroup || undefined, selectedEnv || undefined);
      setSnapshots(Array.isArray(res) ? res : ([]));
    } catch {
      setSnapshots([]);
    }
  }, [selectedGroup, selectedEnv]);

  const loadReleases = useCallback(async () => {
    try {
      const res = await listReleases(selectedEnv || undefined);
      setReleases(Array.isArray(res) ? res : ([]));
    } catch {
      setReleases([]);
    }
  }, [selectedEnv]);

  const loadAudit = useCallback(async () => {
    try {
      const res = await listAudit(100);
      setAudits(Array.isArray(res) ? res : ([]));
    } catch {
      setAudits([]);
    }
  }, []);

  useEffect(() => {
    loadNamespaces();
  }, [loadNamespaces]);

  useEffect(() => {
    if (selectedNamespace) loadGroups(selectedNamespace);
    else loadGroups();
  }, [selectedNamespace, loadGroups]);

  useEffect(() => {
    loadItems();
  }, [selectedGroup, loadItems]);

  useEffect(() => {
    if (activeTab === 'snapshots') loadSnapshots();
  }, [activeTab, loadSnapshots]);

  useEffect(() => {
    if (activeTab === 'releases') loadReleases();
  }, [activeTab, loadReleases]);

  useEffect(() => {
    if (activeTab === 'audit') loadAudit();
  }, [activeTab, loadAudit]);

  // ==================== Handlers ====================

  const handleCreateNamespace = async (values: { name: string; description?: string }) => {
    try {
      const res = await createNamespace(values);
      const ns = res;
      if (ns) setNamespaces((prev) => [...prev, ns]);
      message.success('命名空间创建成功');
      setNsModalOpen(false);
      nsForm.resetFields();
    } catch {
      message.error('创建失败');
    }
  };

  const handleCreateGroup = async (values: { namespaceId: string; name: string; description?: string }) => {
    try {
      const res = await createGroup(values);
      const g = res;
      if (g) {
        setGroups((prev) => [...prev, g]);
        setSelectedGroup(g.id);
      }
      message.success('配置分组创建成功');
      groupForm.resetFields();
      loadGroups(selectedNamespace);
    } catch {
      message.error('创建失败');
    }
  };

  const handleCreateItem = async (values: any) => {
    try {
      if (!selectedGroup) {
        message.warning('请先选择配置分组');
        return;
      }
      const res = await createItem({
        groupId: selectedGroup,
        namespaceId: namespaces.find((n) =>
          groups.find((g) => g.id === selectedGroup)?.namespaceId === n.id
        )?.id || '',
        keyName: values.keyName,
        value: String(values.value),
        valueType: values.valueType,
        encrypted: values.encrypted || false,
        description: values.description,
      });
      const item = res;
      if (item) setItems((prev) => [...prev, item]);
      message.success('配置项创建成功');
      setItemModalOpen(false);
      setEditingItem(null);
      itemForm.resetFields();
      loadItems();
    } catch {
      message.error('创建失败');
    }
  };

  const handleUpdateItem = async (id: string, values: any) => {
    try {
      const data: any = {};
      if (values.value !== undefined) data.value = String(values.value);
      if (values.valueType !== undefined) data.valueType = values.valueType;
      if (values.encrypted !== undefined) data.encrypted = values.encrypted;
      if (values.description !== undefined) data.description = values.description;
      await updateItem(id, data);
      message.success('配置项更新成功');
      setItemModalOpen(false);
      setEditingItem(null);
      loadItems();
    } catch {
      message.error('更新失败');
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await deleteItem(id);
      message.success('已删除');
      loadItems();
    } catch {
      message.error('删除失败');
    }
  };

  const handleViewHistory = async (item: ConfigItem) => {
    try {
      const res = await getItemHistory(item.id);
      const data = Array.isArray(res) ? res : ([]);
      setHistoryData(data);
      setHistoryOpen(true);
    } catch {
      message.error('获取历史失败');
    }
  };

  const handlePublishSnapshot = async () => {
    if (!selectedGroup) { message.warning('请先选择分组'); return; }
    setLoading(true);
    try {
      const res = await publishSnapshot(selectedGroup, { environment: selectedEnv, operator });
      const snap = res;
      if (snap) setSnapshots((prev) => [snap, ...prev]);
      message.success('快照发布成功');
      loadSnapshots();
    } catch {
      message.error('发布失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishRelease = async (values: { snapshotId: string; environment: string; releaseNote?: string }) => {
    setLoading(true);
    try {
      const res = await publishRelease({
        snapshotId: values.snapshotId,
        environment: values.environment,
        operator,
        releaseNote: values.releaseNote,
      });
      const rel = res;
      if (rel) setReleases((prev) => [rel, ...prev]);
      message.success('发布成功');
      releaseForm.resetFields();
      loadReleases();
    } catch {
      message.error('发布失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (values: { snapshotId: string; reason?: string }) => {
    setLoading(true);
    try {
      const res = await rollbackRelease({ snapshotId: values.snapshotId, operator, reason: values.reason });
      const rel = res;
      if (rel) setReleases((prev) => [rel, ...prev]);
      message.success('回滚成功');
      rollbackForm.resetFields();
      loadReleases();
    } catch {
      message.error('回滚失败');
    } finally {
      setLoading(false);
    }
  };

  // ==================== Columns ====================

  const itemColumns = [
    { title: 'Key', dataIndex: 'keyName', key: 'keyName', width: 200 },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      ellipsis: true,
      render: (v: string) => <Text copyable={{ text: v }}>{v.length > 50 ? v.slice(0, 50) + '...' : v}</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'valueType',
      key: 'valueType',
      width: 80,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '加密',
      dataIndex: 'encrypted',
      key: 'encrypted',
      width: 60,
      render: (v: boolean) => v ? <Tag color="red">Yes</Tag> : <Tag>No</Tag>,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: ConfigItem) => (
        <Space>
          <Button
            size="small"
            type="link"
            icon={<HistoryOutlined />}
            onClick={() => handleViewHistory(record)}
          >
            历史
          </Button>
          <Button
            size="small"
            type="link"
            onClick={() => {
              setEditingItem(record);
              itemForm.setFieldsValue({
                value: record.value,
                valueType: record.valueType,
                encrypted: record.encrypted,
                description: record.description,
              });
              setItemModalOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDeleteItem(record.id)}>
            <Button size="small" type="link" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const snapshotColumns = [
    { title: '快照 ID', dataIndex: 'id', key: 'id', width: 100, ellipsis: true },
    { title: '环境', dataIndex: 'environment', key: 'environment', width: 100 },
    { title: '版本号', dataIndex: 'version', key: 'version', width: 80 },
    { title: 'Checksum', dataIndex: 'checksum', key: 'checksum', width: 120, ellipsis: true },
    {
      title: '创建者',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: ConfigSnapshot) => (
        <Button size="small" type="primary" onClick={() => {
          releaseForm.setFieldsValue({ snapshotId: record.id, environment: record.environment });
          Modal.confirm({
            title: '发布配置快照',
            content: <Form form={releaseForm} layout="vertical">
              <Form.Item name="releaseNote" label="发布说明">
                <TextArea rows={2} />
              </Form.Item>
            </Form>,
            onOk: () => releaseForm.validateFields().then((values) => handlePublishRelease(values)),
            okButtonProps: { loading: false },
          });
          releaseForm.resetFields();
        }}>
          发布
        </Button>
      ),
    },
  ];

  const releaseColumns = [
    {
      title: '版本',
      dataIndex: 'releaseVersion',
      key: 'releaseVersion',
      width: 80,
      render: (v: number) => <Tag color="blue">v{v}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => {
        const c: Record<string, string> = { released: 'green', rollback: 'orange', failed: 'red', pending: 'gold' };
        return <Tag color={c[v] || 'default'}>{v}</Tag>;
      },
    },
    { title: '环境', dataIndex: 'environment', key: 'environment', width: 100 },
    { title: 'Snapshot', dataIndex: 'snapshotId', key: 'snapshotId', ellipsis: true },
    { title: '发布人', dataIndex: 'releasedBy', key: 'releasedBy', width: 100 },
    { title: '说明', dataIndex: 'releaseNote', key: 'releaseNote', ellipsis: true },
    {
      title: '发布时间',
      dataIndex: 'releasedAt',
      key: 'releasedAt',
      width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString() : '-',
    },
  ];

  const auditColumns = [
    { title: '操作者', dataIndex: 'actor', key: 'actor', width: 100 },
    {
      title: '动作',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    { title: '目标类型', dataIndex: 'targetType', key: 'targetType', width: 100 },
    { title: '目标 ID', dataIndex: 'targetId', key: 'targetId', ellipsis: true, width: 120 },
    {
      title: 'IP',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 120,
      render: (v: string) => v || '-',
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString() : '-',
    },
  ];

  // ==================== Layout ====================

  const totalItems = items.length;
  const totalSnapshots = snapshots.length;
  const totalReleases = releases.length;

  return (
    <div style={{ padding: spacing.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.md }}>
        <div>
          <Title level={2} style={{ marginBottom: 8, color: colors.neutral[900], fontWeight: 600 }}>
            <SettingOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            分布式配置中心
          </Title>
          <Text type="secondary" style={{ display: 'block' }}>
            命名空间 · 配置分组 · 快照发布 · 变更审计
          </Text>
        </div>
      </div>

      {/* Stats */}
      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Card>
            <Text type="secondary">命名空间</Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: colors.primary[500] }}>{namespaces.length}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text type="secondary">配置项</Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: colors.info[500] }}>{totalItems}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text type="secondary">快照</Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: colors.success[500] }}>{totalSnapshots}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text type="secondary">发布记录</Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: colors.purple[500] }}>{totalReleases}</div>
          </Card>
        </Col>
      </Row>

      <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ marginBottom: spacing.md }}>
        <Tabs.TabItem key="items" label="配置项管理" icon={<DatabaseOutlined />} />
        <Tabs.TabItem key="snapshots" label="快照管理" icon={<CloudUploadOutlined />} />
        <Tabs.TabItem key="releases" label="发布记录" icon={<RollbackOutlined />} />
        <Tabs.TabItem key="audit" label="变更审计" icon={<AuditOutlined />} />
      </Tabs>

      {activeTab === 'items' && (
        <Card
          title="配置项列表"
          extra={
            <Space>
              <Button icon={<ReloadOutlined />} size="small" onClick={loadItems} loading={loading}>刷新</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                setEditingItem(null);
                itemForm.resetFields();
                setItemModalOpen(true);
              }}>新增配置</Button>
            </Space>
          }
        >
          <Space style={{ marginBottom: spacing.md }} size={spacing.sm}>
            <Text type="secondary">命名空间：</Text>
            <Select
              style={{ width: 160 }}
              value={selectedNamespace}
              onChange={setSelectedNamespace}
              allowClear
              placeholder="选择命名空间"
            >
              {namespaces.map((n) => (
                <Option key={n.id} value={n.id}>{n.name}</Option>
              ))}
            </Select>
            <Text type="secondary">分组：</Text>
            <Select
              style={{ width: 180 }}
              value={selectedGroup}
              onChange={setSelectedGroup}
              allowClear
              placeholder="选择分组"
            >
              {groups.map((g) => (
                <Option key={g.id} value={g.id}>{g.name}</Option>
              ))}
            </Select>
            <Divider type="vertical" style={{ height: 24 }} />
            <Space>
              <Text type="secondary">新建命名空间：</Text>
              <Button size="small" onClick={() => setNsModalOpen(true)}>
                创建
              </Button>
              <Text type="secondary">新建分组：</Text>
              <Button size="small" onClick={() => {
                if (!selectedNamespace) { message.warning('请先选择命名空间'); return; }
                groupForm.setFieldsValue({ namespaceId: selectedNamespace });
                Modal.confirm({
                  title: '新建配置分组',
                  content: <Form form={groupForm} layout="vertical">
                    <Form.Item name="name" label="分组名称" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                    <Form.Item name="description" label="描述">
                      <Input />
                    </Form.Item>
                  </Form>,
                  onOk: () => groupForm.validateFields().then((values) => handleCreateGroup(values)),
                });
                groupForm.resetFields();
              }}>
                创建
              </Button>
            </Space>
          </Space>
          <Table
            columns={itemColumns}
            dataSource={items}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            size="small"
          />
        </Card>
      )}

      {activeTab === 'snapshots' && (
        <Card
          title="快照管理"
          extra={
            <Space>
              <Select
                style={{ width: 120 }}
                value={selectedEnv}
                onChange={setSelectedEnv}
                placeholder="环境"
              >
                <Option value="default">default</Option>
                <Option value="development">development</Option>
                <Option value="staging">staging</Option>
                <Option value="production">production</Option>
              </Select>
              <Button type="primary" icon={<CloudUploadOutlined />} onClick={handlePublishSnapshot} loading={loading}>
                发布快照
              </Button>
            </Space>
          }
        >
          <Table
            columns={snapshotColumns}
            dataSource={snapshots}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            size="small"
          />
        </Card>
      )}

      {activeTab === 'releases' && (
        <Card
          title="发布记录"
          extra={
            <Space>
              <Select
                style={{ width: 120 }}
                value={selectedEnv}
                onChange={setSelectedEnv}
                placeholder="环境"
              >
                <Option value="default">default</Option>
                <Option value="development">development</Option>
                <Option value="staging">staging</Option>
                <Option value="production">production</Option>
              </Select>
              <Button icon={<RollbackOutlined />} onClick={() => {
                Modal.confirm({
                  title: '回滚发布',
                  content: <Form form={rollbackForm} layout="vertical">
                    <Form.Item name="snapshotId" label="目标快照 ID" rules={[{ required: true }]}>
                      <Input placeholder="请输入快照 ID" />
                    </Form.Item>
                    <Form.Item name="reason" label="回滚原因">
                      <TextArea rows={2} />
                    </Form.Item>
                  </Form>,
                  onOk: () => rollbackForm.validateFields().then((values) => handleRollback(values)),
                });
                rollbackForm.resetFields();
              }}>
                回滚
              </Button>
            </Space>
          }
        >
          <Table
            columns={releaseColumns}
            dataSource={releases}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            size="small"
          />
        </Card>
      )}

      {activeTab === 'audit' && (
        <Card
          title="变更审计"
          extra={<Button icon={<ReloadOutlined />} size="small" onClick={loadAudit}>刷新</Button>}
        >
          <Table
            columns={auditColumns}
            dataSource={audits}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            size="small"
          />
        </Card>
      )}

      {/* Item Create/Edit Modal */}
      <Modal
        title={editingItem ? '编辑配置项' : '新增配置项'}
        open={itemModalOpen}
        onCancel={() => { setItemModalOpen(false); setEditingItem(null); itemForm.resetFields(); }}
        onOk={() => itemForm.submit()}
        width={600}
      >
        <Form
          form={itemForm}
          layout="vertical"
          onFinish={editingItem ? (v) => handleUpdateItem(editingItem.id, v) : handleCreateItem}
        >
          {!editingItem && (
            <Form.Item name="keyName" label="配置键名" rules={[{ required: true }]}>
              <Input placeholder="config.key.name" />
            </Form.Item>
          )}
          <Form.Item name="value" label="配置值" rules={[{ required: true }]}>
            <TextArea rows={3} placeholder="配置值" />
          </Form.Item>
          <Form.Item name="valueType" label="值类型" initialValue="string">
            <Select>
              <Option value="string">string</Option>
              <Option value="int">int</Option>
              <Option value="float">float</Option>
              <Option value="bool">bool</Option>
              <Option value="json">json</Option>
              <Option value="secret">secret</Option>
            </Select>
          </Form.Item>
          <Form.Item name="encrypted" label="加密" valuePropName="checked">
            <Input type="hidden" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input placeholder="配置说明" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Namespace Modal */}
      <Modal
        title="创建命名空间"
        open={nsModalOpen}
        onCancel={() => setNsModalOpen(false)}
        onOk={() => nsForm.submit()}
        width={500}
      >
        <Form form={nsForm} layout="vertical" onFinish={handleCreateNamespace}>
          <Form.Item name="name" label="命名空间名称" rules={[{ required: true }]}>
            <Input placeholder="e.g. production, dev" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* History Modal */}
      <Modal
        title="变更历史"
        open={historyOpen}
        onCancel={() => setHistoryOpen(false)}
        footer={<Button onClick={() => setHistoryOpen(false)}>关闭</Button>}
        width={700}
      >
        <Table
          dataSource={historyData}
          rowKey="id"
          size="small"
          columns={[
            { title: '版本', dataIndex: 'version', key: 'version', width: 80 },
            { title: '新值', dataIndex: 'newValue', key: 'newValue', ellipsis: true },
            { title: '操作者', dataIndex: 'operator', key: 'operator', width: 100 },
            { title: '原因', dataIndex: 'reason', key: 'reason', ellipsis: true },
            {
              title: '时间',
              dataIndex: 'createdAt',
              key: 'createdAt',
              width: 160,
              render: (v: string) => v ? new Date(v).toLocaleString() : '-',
            },
          ]}
        />
      </Modal>
    </div>
  );
};

export default ConfigCenterPage;