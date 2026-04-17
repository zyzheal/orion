/**
 * PluginManagement Page
 * - Summary cards (Total, Enabled, Disabled, Updates Available)
 * - Search and filter bar (by category, status)
 * - Plugin table with name, version, status, category, author, install date, actions
 * - Plugin detail drawer (metadata, config form, permissions, health status)
 * - Install plugin modal (name, version, source, install button)
 */
import React, { useState, useMemo, useEffect } from 'react';
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
  PlayCircleOutlined,
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
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import MetricCard from '@/components/MetricCard';
import {
  getInstalledPlugins,
  getPlugin,
  getAvailablePlugins,
  installPlugin,
  uninstallPlugin,
  activatePlugin,
  deactivatePlugin,
  configurePlugin,
  executePlugin,
  type Plugin,
  type PluginType,
  type PluginHealthStatus,
  type PluginCategory,
} from '@/api/plugins';
import { categoryLabels, healthStatusLabels } from '@/pages/__mocks__/mockPluginData';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// ============================================================================
// Type aliases for UI compatibility
// ============================================================================

type ApiPlugin = Plugin & {
  category?: 'core' | 'extension' | 'security' | 'monitoring';
  status?: 'enabled' | 'disabled';
};

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
  plugin: ApiPlugin | null;
  open: boolean;
  onClose: () => void;
  onSaveConfig?: (config: Record<string, any>) => Promise<void>;
}

const PluginDetailDrawer: React.FC<PluginDetailDrawerProps> = ({
  plugin,
  open,
  onClose,
  onSaveConfig,
}) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  if (!plugin) return null;

  const health = healthConfig[plugin.healthStatus || 'healthy'] || healthConfig.healthy;

  const handleSaveConfig = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await onSaveConfig?.(values);
      setSaving(false);
    } catch (err) {
      setSaving(false);
    }
  };

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
          <Tag color="cyan">{plugin.category ? categoryLabels[plugin.category] : plugin.type}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="安装时间">
          {plugin.installedAt ? dayjs(plugin.installedAt).format('YYYY-MM-DD HH:mm') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="健康状态">
          <Space>
            <span style={{ color: health.color }}>{health.icon}</span>
            <Text style={{ color: health.color }}>
              {plugin.healthStatus ? healthStatusLabels[plugin.healthStatus] : '未知'}
            </Text>
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="状态">
          <Badge
            status={plugin.state === 'ACTIVE' ? 'success' : 'default'}
            text={plugin.state === 'ACTIVE' ? '运行中' : plugin.state}
          />
        </Descriptions.Item>
      </Descriptions>

      <Divider />

      {/* Configuration form */}
      <Title level={5}>配置项</Title>
      <Form
        form={form}
        layout="vertical"
        initialValues={plugin.config || {}}
        style={{ marginBottom: 24 }}
      >
        {plugin.configSchema && Object.entries(plugin.configSchema).map(([key, field]) => (
          <Form.Item
            key={key}
            label={field.description || key}
            name={key}
            rules={[{ required: field.required }]}
            initialValue={field.default}
          >
            {field.type === 'boolean' ? (
              <Switch />
            ) : field.enum ? (
              <Select>
                {field.enum.map((val) => (
                  <Select.Option key={val} value={val}>{val}</Select.Option>
                ))}
              </Select>
            ) : (
              <Input placeholder={`输入 ${key} 的值`} />
            )}
          </Form.Item>
        ))}
        <Form.Item>
          <Button
            type="primary"
            onClick={handleSaveConfig}
            loading={saving}
          >
            保存配置
          </Button>
        </Form.Item>
      </Form>

      <Divider />

      {/* Permissions list */}
      {plugin.permissions && plugin.permissions.length > 0 && (
        <>
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
        </>
      )}
    </Drawer>
  );
};

// ============================================================================
// Execute Plugin Task Modal Component
// ============================================================================

interface ExecutePluginTaskModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: (result: any) => void;
  plugin: ApiPlugin | null;
}

const ExecutePluginTaskModal: React.FC<ExecutePluginTaskModalProps> = ({
  open,
  onCancel,
  onSuccess,
  plugin,
}) => {
  const [form] = Form.useForm();
  const [executing, setExecuting] = useState(false);

  const handleExecute = async () => {
    try {
      const values = await form.validateFields();
      setExecuting(true);

      const response = await executePlugin(plugin!.id, {
        taskId: values.taskId,
        pipelineRunId: values.pipelineRunId,
        stageId: values.stageId,
        config: values.config ? JSON.parse(values.config) : undefined,
        env: values.env ? JSON.parse(values.env) : undefined,
        timeout: values.timeout ? parseInt(values.timeout, 10) : undefined,
      });

      message.success(`任务执行成功`);
      form.resetFields();
      setExecuting(false);
      onSuccess(response.data);
    } catch (err: any) {
      setExecuting(false);
      if (err.response?.status) {
        message.error(`执行失败：${err.message}`);
      }
    }
  };

  return (
    <Modal
      title={
        <Space>
          <PlayCircleOutlined />
          执行插件任务 - {plugin?.name}
        </Space>
      }
      open={open}
      onCancel={onCancel}
      onOk={handleExecute}
      confirmLoading={executing}
      okText="执行"
      cancelText="取消"
      width={700}
      data-testid="execute-plugin-modal"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          label="任务 ID"
          name="taskId"
          rules={[{ required: true, message: '请输入任务 ID' }]}
        >
          <Input placeholder="例如：task-001" />
        </Form.Item>

        <Form.Item
          label="流水线运行 ID"
          name="pipelineRunId"
          rules={[{ required: false }]}
        >
          <Input placeholder="可选，例如：run-123" />
        </Form.Item>

        <Form.Item
          label="阶段 ID"
          name="stageId"
          rules={[{ required: false }]}
        >
          <Input placeholder="可选，例如：stage-456" />
        </Form.Item>

        <Form.Item
          label="超时时间 (ms)"
          name="timeout"
          rules={[{ required: false }]}
        >
          <Input placeholder="默认 60000ms" type="number" />
        </Form.Item>

        <Form.Item
          label="配置 (JSON)"
          name="config"
          rules={[{ required: false }]}
        >
          <Input.TextArea
            rows={4}
            placeholder='{"key": "value"}'
          />
        </Form.Item>

        <Form.Item
          label="环境变量 (JSON)"
          name="env"
          rules={[{ required: false }]}
        >
          <Input.TextArea
            rows={4}
            placeholder='{"ENV": "production"}'
          />
        </Form.Item>
      </Form>
    </Modal>
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
  const [availablePlugins, setAvailablePlugins] = useState<Plugin[]>([]);

  // Load available plugins when modal opens
  useEffect(() => {
    if (open) {
      getAvailablePlugins({})
        .then((res: any) => {
          setAvailablePlugins(res.data.data || []);
        })
        .catch((err: any) => {
          console.error('Failed to load available plugins:', err);
        });
    }
  }, [open]);

  const handleInstall = async () => {
    try {
      const values = await form.validateFields();
      setInstalling(true);

      await installPlugin(values.pluginId, {
        version: values.version !== 'latest' ? values.version : undefined,
      });

      message.success(`插件 ${values.pluginId} 安装成功`);
      form.resetFields();
      setInstalling(false);
      onSuccess();
    } catch (err: any) {
      setInstalling(false);
      if (err.response?.status !== 400) {
        message.error(`安装失败：${err.message}`);
      }
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
          label="选择插件"
          name="pluginId"
          rules={[{ required: true, message: '请选择插件' }]}
        >
          <Select
            placeholder="选择要安装的插件"
            data-testid="plugin-select"
          >
            {availablePlugins.map((plugin) => (
              <Select.Option key={plugin.id} value={plugin.id}>
                {plugin.name} ({plugin.version})
              </Select.Option>
            ))}
          </Select>
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
  const [executeModalOpen, setExecuteModalOpen] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<ApiPlugin | null>(null);
  const [plugins, setPlugins] = useState<ApiPlugin[]>([]);

  // Load plugins on mount
  useEffect(() => {
    loadPlugins();
  }, []);

  const loadPlugins = async () => {
    setLoading(true);
    try {
      const response = await getInstalledPlugins({});
      setPlugins(response.data.data || []);
    } catch (err: any) {
      console.error('Failed to load plugins:', err);
      message.error('加载插件列表失败');
    } finally {
      setLoading(false);
    }
  };

  // Map plugin type to category for filtering
  const mapPluginTypeToCategory = (type: PluginType): PluginCategory => {
    switch (type) {
      case 'CUSTOM_TASK':
      case 'WEBHOOK_HANDLER':
        return 'extension';
      case 'AI_SKILL':
        return 'core';
      case 'APPROVAL_PROVIDER':
        return 'security';
      case 'NOTIFICATION_CHANNEL':
        return 'monitoring';
      case 'DEPLOYMENT_STRATEGY':
        return 'core';
      default:
        return 'extension';
    }
  };

  // Filter plugins based on search and filters
  const filteredPlugins = useMemo(() => {
    return plugins.filter((plugin) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [
          plugin.name,
          plugin.description,
          plugin.author,
          plugin.type,
          plugin.category,
        ].join(' ').toLowerCase();
        if (!searchable.includes(query)) return false;
      }

      // Category filter
      const categoryFilter = filters.category;
      if (categoryFilter && categoryFilter !== 'all') {
        const pluginCategory = plugin.category || mapPluginTypeToCategory(plugin.type);
        if (pluginCategory !== categoryFilter) return false;
      }

      // Status filter
      const statusFilter = filters.status;
      if (statusFilter && statusFilter !== 'all') {
        const pluginStatus = plugin.state === 'ACTIVE' ? 'enabled' :
                            plugin.state === 'INACTIVE' ? 'disabled' : 'disabled';
        if (pluginStatus !== statusFilter) return false;
      }

      return true;
    });
  }, [searchQuery, filters, plugins]);

  // Summary metrics
  const totalCount = plugins.length;
  const enabledCount = plugins.filter((p) => p.state === 'ACTIVE').length;
  const disabledCount = plugins.filter((p) => p.state !== 'ACTIVE').length;
  const updatesAvailableCount = plugins.filter((p) => p.latestVersion).length;

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
  const handleToggleStatus = async (plugin: ApiPlugin) => {
    const isEnable = plugin.state !== 'ACTIVE';
    const action = isEnable ? '启用' : '禁用';

    Modal.confirm({
      title: `${action}插件`,
      content: `确定要${action}插件 "${plugin.name}" 吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          if (isEnable) {
            await activatePlugin(plugin.id);
            message.success(`插件 ${plugin.name} 已启用`);
          } else {
            await deactivatePlugin(plugin.id);
            message.success(`插件 ${plugin.name} 已禁用`);
          }
          await loadPlugins();
        } catch (err: any) {
          message.error(`${action}失败：${err.message}`);
        }
      },
    });
  };

  // Handle open plugin detail drawer
  const handleConfigure = async (plugin: ApiPlugin) => {
    setSelectedPlugin(plugin);
    setDetailDrawerOpen(true);

    // Refresh plugin details
    try {
      const response = await getPlugin(plugin.id);
      setSelectedPlugin(response.data.data as ApiPlugin);
    } catch (err) {
      console.error('Failed to load plugin details:', err);
    }
  };

  // Handle open execute task modal
  const handleExecuteTask = (plugin: ApiPlugin) => {
    setSelectedPlugin(plugin);
    setExecuteModalOpen(true);
  };

  // Handle execute task success
  const handleExecuteSuccess = (result: any) => {
    setExecuteModalOpen(false);
    setSelectedPlugin(null);
    message.success(`任务执行完成：${result.status}`);
  };

  // Handle save plugin config
  const handleSaveConfig = async (config: Record<string, any>) => {
    if (!selectedPlugin) return;

    try {
      await configurePlugin(selectedPlugin.id, { config });
      message.success('配置保存成功');
      // Refresh plugin details
      const response = await getPlugin(selectedPlugin.id);
      setSelectedPlugin(response.data.data as ApiPlugin);
    } catch (err: any) {
      message.error(`保存配置失败：${err.message}`);
    }
  };

  // Handle update plugin
  const handleUpdate = async (plugin: ApiPlugin) => {
    Modal.confirm({
      title: '更新插件',
      content: `确定要将 "${plugin.name}" 从 v${plugin.version} 更新到 v${plugin.latestVersion} 吗？`,
      okText: '确认更新',
      cancelText: '取消',
      onOk: async () => {
        try {
          await installPlugin(plugin.id, { version: plugin.latestVersion });
          message.success(`插件 ${plugin.name} 更新成功`);
          await loadPlugins();
        } catch (err: any) {
          message.error(`更新失败：${err.message}`);
        }
      },
    });
  };

  // Handle delete plugin
  const handleDelete = async (plugin: ApiPlugin) => {
    Modal.confirm({
      title: '删除插件',
      content: `确定要删除插件 "${plugin.name}" 吗？此操作不可撤销。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await uninstallPlugin(plugin.id);
          message.success(`插件 ${plugin.name} 已删除`);
          await loadPlugins();
        } catch (err: any) {
          message.error(`删除失败：${err.message}`);
        }
      },
    });
  };

  // Handle refresh
  const handleRefresh = () => {
    loadPlugins();
  };

  // Handle install success
  const handleInstallSuccess = () => {
    setInstallModalOpen(false);
    loadPlugins();
  };

  // Table columns
  const columns: TableColumn<ApiPlugin>[] = [
    {
      key: 'name',
      title: '插件名称',
      dataIndex: 'name',
      width: 200,
      render: (value: unknown) => (
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
      render: (value: unknown, record: ApiPlugin) => (
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
      dataIndex: 'state',
      width: 100,
      render: (value: unknown) => {
        const isActive = value === 'ACTIVE';
        return (
          <Badge
            status={isActive ? 'success' : 'default'}
            text={isActive ? '已启用' : '已禁用'}
          />
        );
      },
    },
    {
      key: 'category',
      title: '分类',
      dataIndex: 'category',
      width: 100,
      render: (value: unknown, record: ApiPlugin) => {
        const category = value as PluginCategory || mapPluginTypeToCategory(record.type);
        return (
          <Tag color="cyan" style={{ margin: 0 }}>
            {categoryLabels[String(category)] || record.type}
          </Tag>
        );
      },
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
      render: (value: unknown, _record: ApiPlugin) => (
        <Space>
          <ClockCircleOutlined style={{ color: '#8c8c8c' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {value ? dayjs(String(value)).format('YYYY-MM-DD') : '-'}
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
        const status = (String(value) as PluginHealthStatus) || 'healthy';
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
      width: 280,
      render: (_: unknown, _record: ApiPlugin) => (
        <Space size="small" wrap>
          <Button
            type="link"
            size="small"
            onClick={() => handleToggleStatus(_record)}
            data-testid={`toggle-plugin-${_record.id}`}
          >
            {_record.state === 'ACTIVE' ? '禁用' : '启用'}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<SettingOutlined />}
            onClick={() => handleConfigure(_record)}
            data-testid={`configure-plugin-${_record.id}`}
          >
            配置
          </Button>
          <Button
            type="link"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => handleExecuteTask(_record)}
            data-testid={`execute-plugin-${_record.id}`}
          >
            执行
          </Button>
          {_record.latestVersion && (
            <Button
              type="link"
              size="small"
              icon={<CloudDownloadOutlined />}
              onClick={() => handleUpdate(_record)}
              data-testid={`update-plugin-${_record.id}`}
            >
              更新
            </Button>
          )}
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(_record)}
            data-testid={`delete-plugin-${_record.id}`}
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
        onSaveConfig={handleSaveConfig}
      />

      {/* Execute plugin task modal */}
      <ExecutePluginTaskModal
        open={executeModalOpen}
        onCancel={() => {
          setExecuteModalOpen(false);
          setSelectedPlugin(null);
        }}
        onSuccess={handleExecuteSuccess}
        plugin={selectedPlugin}
      />
    </div>
  );
};

export default PluginManagement;
