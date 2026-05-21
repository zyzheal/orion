/**
 * SubApp Management Page
 *
 * Page-based sub-application configuration management
 * Enables adding, editing, and managing sub-apps without code changes.
 */

import React, { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Switch,
  Modal,
  Form,
  Input,
  Select,
  message,
  Alert,
  Drawer,
  Timeline,
  Typography,
  Popconfirm,
  Tooltip,
  Badge,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  HistoryOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LinkOutlined,
  CopyOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useSubAppStore, SubAppConfig, SubAppConfigHistory } from '@/stores/subappStore';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ==================== Icons Map ====================

const iconOptions = [
  { value: 'DatabaseOutlined', label: '数据库' },
  { value: 'BookOutlined', label: '知识' },
  { value: 'DashboardOutlined', label: '监控' },
  { value: 'CloudServerOutlined', label: '云服务' },
  { value: 'SecurityScanOutlined', label: '安全' },
  { value: 'CodeOutlined', label: '开发' },
  { value: 'SettingOutlined', label: '设置' },
  { value: 'AppstoreOutlined', label: '应用' },
];

// ==================== Main Component ====================

const SubAppManagement: React.FC = () => {
  const {
    apps,
    loading,
    error,
    fetchApps,
    createApp,
    updateApp,
    deleteApp,
    toggleStatus,
    getHistory,
    clearError,
  } = useSubAppStore();

  const [form] = Form.useForm();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<SubAppConfig | null>(null);
  const [historyData, setHistoryData] = useState<SubAppConfigHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Load apps on mount
  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  // Handle error
  useEffect(() => {
    if (error) {
      message.error(error);
      clearError();
    }
  }, [error, clearError]);

  // Open create modal
  const handleCreate = () => {
    setSelectedApp(null);
    form.resetFields();
    setIsEditing(false);
    setDrawerOpen(true);
  };

  // Open edit modal
  const handleEdit = (app: SubAppConfig) => {
    setSelectedApp(app);
    form.setFieldsValue({
      ...app,
      routes: app.routes.join(', '),
    });
    setIsEditing(true);
    setDrawerOpen(true);
  };

  // Handle form submit
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Convert routes string to array
      const routes = values.routes
        ? values.routes
            .split(',')
            .map((r: string) => r.trim())
            .filter((r: string) => r.startsWith('/'))
        : [];

      const appData = {
        ...values,
        routes,
      };

      if (isEditing && selectedApp) {
        await updateApp(selectedApp.key, appData);
        message.success('子应用配置已更新');
      } else {
        await createApp(appData);
        message.success('子应用创建成功');
      }

      setDrawerOpen(false);
      form.resetFields();
    } catch (err: any) {
      if (err.errorFields) {
        // Form validation error
        return;
      }
      message.error(err.message || '操作失败');
    }
  };

  // Handle delete
  const handleDelete = async (key: string) => {
    try {
      await deleteApp(key);
      message.success('子应用已删除');
    } catch (err: any) {
      message.error(err.message || '删除失败');
    }
  };

  // Handle status toggle
  const handleToggleStatus = async (key: string) => {
    try {
      const updated = await toggleStatus(key);
      message.success(`子应用已${updated.status === 'enabled' ? '启用' : '禁用'}`);
    } catch (err: any) {
      message.error(err.message || '操作失败');
    }
  };

  // Handle history
  const handleShowHistory = async (app: SubAppConfig) => {
    setSelectedApp(app);
    setHistoryLoading(true);
    setHistoryDrawerOpen(true);

    try {
      const history = await getHistory(app.key);
      setHistoryData(history);
    } catch (err: any) {
      message.error('获取历史记录失败');
    } finally {
      setHistoryLoading(false);
    }
  };

  // Copy access link
  const handleCopyLink = (path: string) => {
    const url = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(url)
      .then(() => message.success(`链接已复制: ${url}`))
      .catch(() => message.error('复制失败，请手动复制'));
  };

  // Table columns
  const columns = [
    {
      title: '状态',
      dataIndex: 'key',
      key: 'status',
      width: 90,
      render: (_: any, record: SubAppConfig) => {
        const isEnabled = record.status === 'enabled';
        return (
          <Tag
            color={isEnabled ? colors.success[50] : colors.neutral[100]}
            style={{
              color: isEnabled ? colors.success[600] : colors.neutral[600],
              border: `1px solid ${isEnabled ? colors.success[200] : colors.neutral[200]}`,
              borderRadius: 6,
              fontWeight: 500,
            }}
          >
            {isEnabled ? '● 启用' : '○ 禁用'}
          </Tag>
        );
      },
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: SubAppConfig) => (
        <Space>
          <Text strong>{name}</Text>
          <Tag>v{record.version}</Tag>
        </Space>
      ),
    },
    {
      title: '标识',
      dataIndex: 'key',
      key: 'key',
      render: (key: string) => (
        <Tag
          color={colors.primary[50]}
          style={{
            color: colors.primary[600],
            border: `1px solid ${colors.primary[200]}`,
            borderRadius: 6,
            fontWeight: 500,
          }}
        >
          {key}
        </Tag>
      ),
    },
    {
      title: '路由',
      dataIndex: 'routes',
      key: 'routes',
      render: (routes: string[]) => (
        <Space direction="vertical" size={0}>
          {routes?.map((r) => (
            <Tag key={r} style={{ cursor: 'pointer' }} onClick={() => handleCopyLink(r)}>
              <CopyOutlined /> {r}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '入口',
      dataIndex: 'entry_dev',
      key: 'entry',
      render: (dev: string, record: SubAppConfig) => (
        <Tooltip title={record.entry_prod}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dev}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {desc || '-'}
        </Text>
      ),
    },
    {
      title: 'API 域',
      dataIndex: 'api_domain',
      key: 'api_domain',
      width: 100,
      render: (domain: string | null, record: SubAppConfig) => (
        <Tag color={domain ? 'blue' : 'default'}>
          {domain || record.key}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: SubAppConfig) => (
        <Space>
          <Switch
            checked={record.status === 'enabled'}
            onChange={() => handleToggleStatus(record.key)}
            size="small"
          />
          <Tooltip title="历史记录">
            <Button
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => handleShowHistory(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description={`确定要删除子应用 "${record.name}" 吗？`}
            onConfirm={() => handleDelete(record.key)}
            okText="确认删除"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="删除">
              <Button size="small" icon={<DeleteOutlined />} danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* Page Header */}
      <div
        style={{
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <SettingOutlined style={{ marginRight: 8, color: colors.primary[500] }} />
            子应用管理
          </Title>
          <Text type="secondary">配置和管理微前端子应用，无需代码修改即可接入新子系统</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          新增子应用
        </Button>
      </div>

      {/* Info Alert */}
      <Alert
        message="页面化管理"
        description="子应用配置通过页面管理，保存后立即生效。3个子应用已预配置：数据库管理、知识库、监控中心。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={apps}
          loading={loading}
          rowKey="key"
          pagination={false}
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={isEditing ? '编辑子应用' : '新增子应用'}
        open={drawerOpen}
        onCancel={() => {
          setDrawerOpen(false);
          form.resetFields();
        }}
        onOk={handleSubmit}
        width={600}
        okText={isEditing ? '保存' : '创建'}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="显示名称"
            rules={[{ required: true, message: '请输入显示名称' }]}
          >
            <Input placeholder="例如：数据库管理" />
          </Form.Item>

          <Form.Item
            name="key"
            label="唯一标识"
            rules={[
              { required: true, message: '请输入唯一标识' },
              { pattern: /^[a-z][a-z0-9-]*$/, message: '必须以小写字母开头，只包含小写字母、数字、中划线' },
            ]}
            extra="用于路由路径，例如：dba → /dba"
          >
            <Input placeholder="例如：dba" disabled={isEditing} />
          </Form.Item>

          <Form.Item
            name="version"
            label="版本号"
            rules={[{ required: true, message: '请输入版本号' }]}
            initialValue="1.0.0"
          >
            <Input placeholder="1.0.0" />
          </Form.Item>

          <Form.Item
            name="entry_dev"
            label="开发环境入口"
            rules={[{ required: true, message: '请输入开发环境入口' }]}
            extra="本地开发时的访问地址"
          >
            <Input placeholder="http://localhost:3030/orion-dba/" />
          </Form.Item>

          <Form.Item
            name="entry_prod"
            label="生产环境入口"
            rules={[{ required: true, message: '请输入生产环境入口' }]}
            extra="部署后的访问路径（以 / 开头）"
          >
            <Input placeholder="/orion-dba/index.html" />
          </Form.Item>

          <Form.Item
            name="routes"
            label="路由路径"
            rules={[{ required: true, message: '请输入路由路径' }]}
            extra="主应用访问路径，多个用逗号分隔"
          >
            <Input placeholder="/dba" />
          </Form.Item>

          <Space>
            <Form.Item name="keep_alive" valuePropName="checked" initialValue={false}>
              <Switch />保持存活
            </Form.Item>
            <Form.Item name="preload" valuePropName="checked" initialValue={false}>
              <Switch />预加载
            </Form.Item>
          </Space>

          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="简要描述此子应用的功能" />
          </Form.Item>

          <Form.Item
            name="api_domain"
            label="API 路由域"
            extra="子应用后端 API 的路由前缀，例如 'dba' 对应 /api/v1/dba/*"
            rules={[
              { pattern: /^[a-z][a-z0-9-]*$/, message: '必须以小写字母开头，只包含小写字母、数字、中划线' },
            ]}
          >
            <Input placeholder="例如：dba（留空则使用 key）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* History Drawer */}
      <Drawer
        title={`${selectedApp?.name} - 配置历史`}
        placement="right"
        width={500}
        open={historyDrawerOpen}
        onClose={() => setHistoryDrawerOpen(false)}
      >
        {historyLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
        ) : (
          <Timeline
            items={historyData.map((item) => ({
              color: item.action === 'created' ? 'green' : item.action === 'deleted' ? 'red' : 'blue',
              children: (
                <div>
                  <Text strong>
                    {item.action === 'created' && '创建'}
                    {item.action === 'updated' && '更新'}
                    {item.action === 'deleted' && '删除'}
                    {item.action === 'status_changed' && '状态变更'}
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {item.change_summary}
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {new Date(item.created_at).toLocaleString()}
                  </Text>
                </div>
              ),
            }))}
          />
        )}
      </Drawer>
    </div>
  );
};

export default SubAppManagement;