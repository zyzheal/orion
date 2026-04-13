/**
 * PluginManagement Page
 * - Summary cards (Total, Enabled, Disabled, Updates Available)
 * - Search and filter bar (by category, status)
 * - Plugin table with name, version, status, category, author, install date, actions
 * - Plugin detail drawer (metadata, config form, permissions, health status)
 * - Install plugin modal (name, version, source, install button)
 */
import React, { useState, useMemo } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Badge,
  Modal,
  message,
  Drawer,
  Form,
  Input,
  Select,
  Switch,
  Descriptions,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
  CloudDownloadOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  AppstoreOutlined,
  ClockCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import MetricCard from '@/components/MetricCard';
import {
  mockPlugins,
  categoryLabels,
  healthStatusLabels,
  type MockPlugin,
} from '@/pages/__mocks__/mockPluginData';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// ============================================================================
// Health status config
// ============================================================================

const healthConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  healthy: {
    color: '#52c41a',
    icon: <CheckCircleOutlined />,
  },
  warning: {
    color: '#faad14',
    icon: <WarningOutlined />,
  },
  error: {
    color: '#ff4d4f',
    icon: <CloseCircleOutlined />,
  },
};

// ============================================================================
// Plugin Detail Drawer Component
// ============================================================================

interface PluginDetailDrawerProps {
  plugin: MockPlugin | null;
  open: boolean;
  onClose: () => void;
}

const PluginDetailDrawer: React.FC<PluginDetailDrawerProps> = ({
  plugin,
  open,
  onClose,
}) => {
  const [form] = Form.useForm();

  if (!plugin) return null;

  const health = healthConfig[plugin.healthStatus] || healthConfig.healthy;

  return (
    <Drawer
      title={`插件详情 - ${plugin.name}`}
      placement="right"
      width={600}
      onClose={onClose}
      open={open}
      data-testid="plugin-detail-drawer"
    >
      {/* Plugin metadata */}
      <Descriptions
        title="基本信息"
        column={1}
        bordered
        size="small"
        style={{ marginBottom: 24 }}
      >
        <Descriptions.Item label="插件名称">{plugin.name}</Descriptions.Item>
        <Descriptions.Item label="当前版本">{plugin.version}</Descriptions.Item>
        {plugin.latestVersion && (
          <Descriptions.Item label="最新版本">
            <Badge
              count="可更新"
              style={{ backgroundColor: '#1890ff' }}
            >
              <Tag color="blue">{plugin.latestVersion}</Tag>
            </Badge>
          </Descriptions.Item>
        )}
        <Descriptions.Item label="描述">{plugin.description}</Descriptions.Item>
        <Descriptions.Item label="作者">{plugin.author}</Descriptions.Item>
        <Descriptions.Item label="分类">
          <Tag color="cyan">{categoryLabels[plugin.category]}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="安装时间">
          {dayjs(plugin.installedAt).format('YYYY-MM-DD HH:mm')}
        </Descriptions.Item>
        <Descriptions.Item label="健康状态">
          <Space>
            <span style={{ color: health.color }}>{health.icon}</span>
            <Text style={{ color: health.color }}>
              {healthStatusLabels[plugin.healthStatus]}
            </Text>
          </Space>
        </Descriptions.Item>
      </Descriptions>

      <Divider />

      {/* Configuration form */}
      <Title level={5}>配置项</Title>
      <Form
        form={form}
        layout="vertical"
        initialValues={plugin.config}
        style={{ marginBottom: 24 }}
      >
        {Object.entries(plugin.config).map(([key, value]) => (
          <Form.Item key={key} label={key} name={key}>
            <Input placeholder={`输入 ${key} 的值`} />
          </Form.Item>
        ))}
        <Form.Item>
          <Button
            type="primary"
            onClick={() => {
              message.success('配置保存成功');
            }}
          >
            保存配置
          </Button>
        </Form.Item>
      </Form>

      <Divider />

      {/* Permissions list */}
      <Title level={5}>权限列表</Title>
      <div style={{ marginBottom: 16 }}>
        <Space wrap>
          {plugin.permissions.map((perm) => (
            <Tag key={perm} color="geekblue">
              {perm}
            </Tag>
          ))}
        </Space>
      </div>
    </Drawer>
  );
};

// ============================================================================
// Install Plugin Modal Component
// ============================================================================

interface InstallPluginModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

const InstallPluginModal: React.FC<InstallPluginModalProps> = ({
  open,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [installing, setInstalling] = useState(false);

  const handleInstall = async () => {
    try {
      const values = await form.validateFields();
      setInstalling(true);

      // Simulate installation delay
      setTimeout(() => {
        setInstalling(false);
        message.success(`插件 ${values.name} 安装成功`);
        form.resetFields();
        onSuccess();
      }, 1500);
    } catch {
      // Validation failed, do nothing
    }
  };

  return (
    <Modal
      title={
        <Space>
          <CloudDownloadOutlined />
          安装插件
        </Space>
      }
      open={open}
      onCancel={onCancel}
      onOk={handleInstall}
      confirmLoading={installing}
      okText="安装"
      cancelText="取消"
      data-testid="install-plugin-modal"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          label="插件名称"
          name="name"
          rules={[{ required: true, message: '请输入插件名称' }]}
        >
          <Input
            placeholder="例如：数据库迁移助手"
            prefix={<SearchOutlined />}
            data-testid="plugin-name-input"
          />
        </Form.Item>

        <Form.Item
          label="版本"
          name="version"
          rules={[{ required: true, message: '请选择版本' }]}
          initialValue="latest"
        >
          <Select data-testid="plugin-version-select">
            <Select.Option value="latest">最新版本</Select.Option>
            <Select.Option value="stable">稳定版本</Select.Option>
            <Select.Option value="beta">测试版本</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="来源"
          name="source"
          rules={[{ required: true, message: '请选择来源' }]}
          initialValue="marketplace"
        >
          <Select data-testid="plugin-source-select">
            <Select.Option value="marketplace">插件市场</Select.Option>
            <Select.Option value="local">本地上传</Select.Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ============================================================================
// Main PluginManagement Component
// ============================================================================

const PluginManagement: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [loading, setLoading] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<MockPlugin | null>(null);

  // Filter plugins based on search and filters
  const filteredPlugins = useMemo(() => {
    return mockPlugins.filter((plugin) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [
          plugin.name,
          plugin.description,
          plugin.author,
          plugin.category,
        ].join(' ').toLowerCase();
        if (!searchable.includes(query)) return false;
      }

      // Category filter
      const categoryFilter = filters.category;
      if (categoryFilter && categoryFilter !== 'all' && plugin.category !== categoryFilter) {
        return false;
      }

      // Status filter
      const statusFilter = filters.status;
      if (statusFilter && statusFilter !== 'all' && plugin.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [searchQuery, filters]);

  // Summary metrics
  const totalCount = mockPlugins.length;
  const enabledCount = mockPlugins.filter((p) => p.status === 'enabled').length;
  const disabledCount = mockPlugins.filter((p) => p.status === 'disabled').length;
  const updatesAvailableCount = mockPlugins.filter((p) => p.latestVersion).length;

  // Filter definitions
  const filterDefs: FilterDefinition[] = [
    {
      key: 'category',
      label: '分类',
      options: [
        { label: '全部', value: 'all' },
        ...Object.entries(categoryLabels).map(([key, label]) => ({ label, value: key })),
      ],
    },
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '全部', value: 'all' },
        { label: '已启用', value: 'enabled' },
        { label: '已禁用', value: 'disabled' },
      ],
    },
  ];

  // Handle toggle plugin status
  const handleToggleStatus = (plugin: MockPlugin) => {
    const action = plugin.status === 'enabled' ? '禁用' : '启用';
    Modal.confirm({
      title: `${action}插件`,
      content: `确定要${action}插件 "${plugin.name}" 吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        message.success(`插件 ${plugin.name} 已${action}`);
      },
    });
  };

  // Handle open plugin detail drawer
  const handleConfigure = (plugin: MockPlugin) => {
    setSelectedPlugin(plugin);
    setDetailDrawerOpen(true);
  };

  // Handle update plugin
  const handleUpdate = (plugin: MockPlugin) => {
    Modal.confirm({
      title: '更新插件',
      content: `确定要将 "${plugin.name}" 从 v${plugin.version} 更新到 v${plugin.latestVersion} 吗？`,
      okText: '确认更新',
      cancelText: '取消',
      onOk: () => {
        message.success(`插件 ${plugin.name} 更新成功`);
      },
    });
  };

  // Handle delete plugin
  const handleDelete = (plugin: MockPlugin) => {
    Modal.confirm({
      title: '删除插件',
      content: `确定要删除插件 "${plugin.name}" 吗？此操作不可撤销。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        message.success(`插件 ${plugin.name} 已删除`);
      },
    });
  };

  // Handle refresh
  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 800);
  };

  // Handle install success
  const handleInstallSuccess = () => {
    setInstallModalOpen(false);
  };

  // Table columns
  const columns: TableColumn<MockPlugin>[] = [
    {
      key: 'name',
      title: '插件名称',
      dataIndex: 'name',
      width: 200,
      render: (value: unknown, record: MockPlugin) => (
        <Space>
          <AppstoreOutlined style={{ color: '#1890ff' }} />
          <Text strong>{String(value)}</Text>
        </Space>
      ),
    },
    {
      key: 'version',
      title: '版本',
      dataIndex: 'version',
      width: 140,
      render: (value: unknown, record: MockPlugin) => (
        <Space>
          <Tag>v{String(value)}</Tag>
          {record.latestVersion && (
            <Badge count="新" style={{ backgroundColor: '#1890ff' }} />
          )}
        </Space>
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: unknown) => {
        const isEnabled = value === 'enabled';
        return (
          <Badge
            status={isEnabled ? 'success' : 'default'}
            text={isEnabled ? '已启用' : '已禁用'}
          />
        );
      },
    },
    {
      key: 'category',
      title: '分类',
      dataIndex: 'category',
      width: 100,
      render: (value: unknown) => (
        <Tag color="cyan" style={{ margin: 0 }}>
          {categoryLabels[String(value)] || String(value)}
        </Tag>
      ),
    },
    {
      key: 'author',
      title: '作者',
      dataIndex: 'author',
      width: 100,
      render: (value: unknown) => <Text>{String(value)}</Text>,
    },
    {
      key: 'installedAt',
      title: '安装时间',
      dataIndex: 'installedAt',
      width: 140,
      render: (value: unknown) => (
        <Space>
          <ClockCircleOutlined style={{ color: '#8c8c8c' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(String(value)).format('YYYY-MM-DD')}
          </Text>
        </Space>
      ),
    },
    {
      key: 'health',
      title: '健康状态',
      dataIndex: 'healthStatus',
      width: 100,
      render: (value: unknown) => {
        const status = String(value) as 'healthy' | 'warning' | 'error';
        const config = healthConfig[status] || healthConfig.healthy;
        return (
          <Space>
            <span style={{ color: config.color }}>{config.icon}</span>
            <Text style={{ color: config.color, fontSize: 12 }}>
              {healthStatusLabels[status]}
            </Text>
          </Space>
        );
      },
    },
    {
      key: 'actions',
      title: '操作',
      width: 220,
      render: (_: unknown, record: MockPlugin) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => handleToggleStatus(record)}
            data-testid={`toggle-plugin-${record.id}`}
          >
            {record.status === 'enabled' ? '禁用' : '启用'}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<SettingOutlined />}
            onClick={() => handleConfigure(record)}
            data-testid={`configure-plugin-${record.id}`}
          >
            配置
          </Button>
          {record.latestVersion && (
            <Button
              type="link"
              size="small"
              icon={<CloudDownloadOutlined />}
              onClick={() => handleUpdate(record)}
              data-testid={`update-plugin-${record.id}`}
            >
              更新
            </Button>
          )}
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            data-testid={`delete-plugin-${record.id}`}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }} data-testid="plugin-management-page">
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            插件管理
          </Title>
          <Text type="secondary">
            共 {filteredPlugins.length} 个插件
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setInstallModalOpen(true)}
            data-testid="install-plugin-button"
          >
            安装插件
          </Button>
        </Space>
      </div>

      {/* Summary cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
        data-testid="plugin-summary-cards"
      >
        <MetricCard
          title="插件总数"
          value={totalCount}
          icon={<AppstoreOutlined />}
          color="#1890ff"
          footer="已安装的全部插件"
        />
        <MetricCard
          title="已启用"
          value={enabledCount}
          icon={<CheckCircleOutlined />}
          color="#52c41a"
          footer="当前运行中的插件"
        />
        <MetricCard
          title="已禁用"
          value={disabledCount}
          icon={<CloseCircleOutlined />}
          color="#8c8c8c"
          footer="已停止的插件"
        />
        <MetricCard
          title="可更新"
          value={updatesAvailableCount}
          icon={<CloudDownloadOutlined />}
          color="#722ed1"
          footer="有新版本可用的插件"
        />
      </div>

      {/* Search and filter bar */}
      <div style={{ marginBottom: 16 }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={filterDefs}
          searchPlaceholder="搜索插件名称、描述、作者..."
        />
      </div>

      {/* Plugin table */}
      <Table
        columns={columns as any}
        dataSource={filteredPlugins as any}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
        data-testid="plugin-table"
      />

      {/* Install plugin modal */}
      <InstallPluginModal
        open={installModalOpen}
        onCancel={() => setInstallModalOpen(false)}
        onSuccess={handleInstallSuccess}
      />

      {/* Plugin detail drawer */}
      <PluginDetailDrawer
        plugin={selectedPlugin}
        open={detailDrawerOpen}
        onClose={() => {
          setDetailDrawerOpen(false);
          setSelectedPlugin(null);
        }}
      />
    </div>
  );
};

export default PluginManagement;
