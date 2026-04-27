/**
 * Plugin SPI (Service Provider Interface) Page
 * 插件扩展点管理
 *
 * Features:
 * - SPI extension point table with registered plugins and status
 * - Plugin registration list
 * - Filter by SPI type and status
 * - Add/edit SPI configuration modal
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
  Alert,
  Row,
  Col,
  Tooltip,
  Badge,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  LinkOutlined,
  BlockOutlined,
  CheckCircleOutlined,
  ExperimentOutlined,
  ApiOutlined,
  SettingOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import MetricCard from '@/components/MetricCard';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// ============================================================================
// Types
// ============================================================================

type SPIStatus = 'active' | 'inactive' | 'deprecated' | 'experimental';

interface SPIExtensionPoint {
  id: string;
  name: string;
  description: string;
  spiType: string;
  registeredPlugins: number;
  status: SPIStatus;
  interfaceName: string;
  version: string;
  lastUpdated: string;
}

interface PluginRegistration {
  id: string;
  pluginName: string;
  spiPoint: string;
  provider: string;
  priority: number;
  status: 'enabled' | 'disabled' | 'error';
  version: string;
  registeredAt: string;
}

interface SPIConfig {
  id: string;
  spiType: string;
  enabled: boolean;
  maxPlugins: number;
  timeout: number;
  fallbackStrategy: string;
}

interface SPIStats {
  totalExtensionPoints: number;
  activePoints: number;
  totalRegistrations: number;
  enabledPlugins: number;
}

// ============================================================================
// Label & Color Maps
// ============================================================================

const statusColorMap: Record<SPIStatus, string> = {
  active: 'success',
  inactive: 'default',
  deprecated: 'error',
  experimental: 'warning',
};

const statusLabelMap: Record<SPIStatus, string> = {
  active: '活跃',
  inactive: '未激活',
  deprecated: '已废弃',
  experimental: '实验性',
};

const pluginStatusColorMap: Record<string, string> = {
  enabled: 'success',
  disabled: 'default',
  error: 'error',
};

const pluginStatusLabelMap: Record<string, string> = {
  enabled: '已启用',
  disabled: '已禁用',
  error: '异常',
};

const spiTypeLabelMap: Record<string, string> = {
  auth: '认证扩展',
  storage: '存储扩展',
  notification: '通知扩展',
  pipeline_stage: '流水线阶段',
  code_scanner: '代码扫描',
  deploy_strategy: '部署策略',
  metric_collector: '指标采集',
  event_handler: '事件处理',
  ai_model: 'AI 模型',
};

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_STATS: SPIStats = {
  totalExtensionPoints: 12,
  activePoints: 8,
  totalRegistrations: 34,
  enabledPlugins: 28,
};

const MOCK_EXTENSION_POINTS: SPIExtensionPoint[] = [
  {
    id: 'spi-001',
    name: 'AuthenticationProvider',
    description: '认证提供者扩展点，支持 OAuth2/LDAP/SAML 等认证方式',
    spiType: 'auth',
    registeredPlugins: 4,
    status: 'active',
    interfaceName: 'com.orion.spi.auth.AuthenticationProvider',
    version: '2.1.0',
    lastUpdated: '2026-04-20T10:00:00Z',
  },
  {
    id: 'spi-002',
    name: 'StorageBackend',
    description: '存储后端扩展点，支持本地存储、S3、OSS 等',
    spiType: 'storage',
    registeredPlugins: 3,
    status: 'active',
    interfaceName: 'com.orion.spi.storage.StorageBackend',
    version: '1.5.0',
    lastUpdated: '2026-04-18T14:00:00Z',
  },
  {
    id: 'spi-003',
    name: 'NotificationChannel',
    description: '通知渠道扩展点，支持邮件、Slack、钉钉、企业微信等',
    spiType: 'notification',
    registeredPlugins: 6,
    status: 'active',
    interfaceName: 'com.orion.spi.notification.NotificationChannel',
    version: '3.0.0',
    lastUpdated: '2026-04-25T08:00:00Z',
  },
  {
    id: 'spi-004',
    name: 'PipelineStageExecutor',
    description: '流水线阶段执行器扩展点',
    spiType: 'pipeline_stage',
    registeredPlugins: 8,
    status: 'active',
    interfaceName: 'com.orion.spi.pipeline.PipelineStageExecutor',
    version: '2.0.0',
    lastUpdated: '2026-04-22T16:00:00Z',
  },
  {
    id: 'spi-005',
    name: 'CodeScanner',
    description: '代码扫描器扩展点，支持 SonarQube、Checkmarx 等',
    spiType: 'code_scanner',
    registeredPlugins: 3,
    status: 'active',
    interfaceName: 'com.orion.spi.scanner.CodeScanner',
    version: '1.2.0',
    lastUpdated: '2026-04-15T12:00:00Z',
  },
  {
    id: 'spi-006',
    name: 'DeployStrategy',
    description: '部署策略扩展点，支持蓝绿、金丝雀、滚动等策略',
    spiType: 'deploy_strategy',
    registeredPlugins: 4,
    status: 'active',
    interfaceName: 'com.orion.spi.deploy.DeployStrategy',
    version: '1.8.0',
    lastUpdated: '2026-04-19T09:00:00Z',
  },
  {
    id: 'spi-007',
    name: 'MetricCollector',
    description: '指标采集器扩展点，支持 Prometheus、OpenTelemetry 等',
    spiType: 'metric_collector',
    registeredPlugins: 2,
    status: 'active',
    interfaceName: 'com.orion.spi.metrics.MetricCollector',
    version: '1.0.0',
    lastUpdated: '2026-04-10T11:00:00Z',
  },
  {
    id: 'spi-008',
    name: 'EventHandler',
    description: '事件处理器扩展点，支持自定义事件处理逻辑',
    spiType: 'event_handler',
    registeredPlugins: 2,
    status: 'inactive',
    interfaceName: 'com.orion.spi.events.EventHandler',
    version: '0.9.0',
    lastUpdated: '2026-03-28T15:00:00Z',
  },
  {
    id: 'spi-009',
    name: 'AIModelProvider',
    description: 'AI 模型提供者扩展点，支持 OpenAI、Claude、本地模型等',
    spiType: 'ai_model',
    registeredPlugins: 2,
    status: 'experimental',
    interfaceName: 'com.orion.spi.ai.AIModelProvider',
    version: '0.5.0-beta',
    lastUpdated: '2026-04-26T10:00:00Z',
  },
];

const MOCK_PLUGIN_REGISTRATIONS: PluginRegistration[] = [
  {
    id: 'reg-001',
    pluginName: 'OAuth2AuthProvider',
    spiPoint: 'AuthenticationProvider',
    provider: 'org.orion.plugins',
    priority: 1,
    status: 'enabled',
    version: '1.2.0',
    registeredAt: '2026-01-15T08:00:00Z',
  },
  {
    id: 'reg-002',
    pluginName: 'LDAPAuthProvider',
    spiPoint: 'AuthenticationProvider',
    provider: 'org.orion.plugins',
    priority: 2,
    status: 'enabled',
    version: '1.1.0',
    registeredAt: '2026-01-20T10:00:00Z',
  },
  {
    id: 'reg-003',
    pluginName: 'S3StorageBackend',
    spiPoint: 'StorageBackend',
    provider: 'com.amazonaws.plugins',
    priority: 1,
    status: 'enabled',
    version: '2.0.0',
    registeredAt: '2026-02-01T08:00:00Z',
  },
  {
    id: 'reg-004',
    pluginName: 'AliyunOSSStorage',
    spiPoint: 'StorageBackend',
    provider: 'com.aliyun.plugins',
    priority: 2,
    status: 'enabled',
    version: '1.5.0',
    registeredAt: '2026-02-10T09:00:00Z',
  },
  {
    id: 'reg-005',
    pluginName: 'SlackNotifier',
    spiPoint: 'NotificationChannel',
    provider: 'com.slack.plugins',
    priority: 1,
    status: 'enabled',
    version: '3.1.0',
    registeredAt: '2026-02-15T14:00:00Z',
  },
  {
    id: 'reg-006',
    pluginName: 'DingTalkNotifier',
    spiPoint: 'NotificationChannel',
    provider: 'com.dingtalk.plugins',
    priority: 2,
    status: 'enabled',
    version: '2.0.0',
    registeredAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'reg-007',
    pluginName: 'WeComNotifier',
    spiPoint: 'NotificationChannel',
    provider: 'com.wecom.plugins',
    priority: 3,
    status: 'disabled',
    version: '1.0.0',
    registeredAt: '2026-03-15T16:00:00Z',
  },
  {
    id: 'reg-008',
    pluginName: 'SonarQubeScanner',
    spiPoint: 'CodeScanner',
    provider: 'org.sonar.plugins',
    priority: 1,
    status: 'enabled',
    version: '4.0.0',
    registeredAt: '2026-03-20T08:00:00Z',
  },
  {
    id: 'reg-009',
    pluginName: 'BlueGreenDeployer',
    spiPoint: 'DeployStrategy',
    provider: 'org.orion.plugins',
    priority: 1,
    status: 'enabled',
    version: '1.3.0',
    registeredAt: '2026-04-01T10:00:00Z',
  },
  {
    id: 'reg-010',
    pluginName: 'CanaryDeployer',
    spiPoint: 'DeployStrategy',
    provider: 'org.orion.plugins',
    priority: 2,
    status: 'error',
    version: '1.2.0',
    registeredAt: '2026-04-05T12:00:00Z',
  },
];

const MOCK_SPI_CONFIGS: SPIConfig[] = [
  { id: 'cfg-001', spiType: 'auth', enabled: true, maxPlugins: 10, timeout: 5000, fallbackStrategy: 'reject' },
  { id: 'cfg-002', spiType: 'storage', enabled: true, maxPlugins: 5, timeout: 10000, fallbackStrategy: 'default' },
  { id: 'cfg-003', spiType: 'notification', enabled: true, maxPlugins: 20, timeout: 3000, fallbackStrategy: 'queue' },
  { id: 'cfg-004', spiType: 'pipeline_stage', enabled: true, maxPlugins: 50, timeout: 30000, fallbackStrategy: 'retry' },
  { id: 'cfg-005', spiType: 'code_scanner', enabled: true, maxPlugins: 5, timeout: 60000, fallbackStrategy: 'skip' },
  { id: 'cfg-006', spiType: 'deploy_strategy', enabled: true, maxPlugins: 10, timeout: 15000, fallbackStrategy: 'rollback' },
  { id: 'cfg-007', spiType: 'metric_collector', enabled: false, maxPlugins: 3, timeout: 5000, fallbackStrategy: 'default' },
  { id: 'cfg-008', spiType: 'event_handler', enabled: false, maxPlugins: 15, timeout: 5000, fallbackStrategy: 'log' },
  { id: 'cfg-009', spiType: 'ai_model', enabled: true, maxPlugins: 5, timeout: 30000, fallbackStrategy: 'fallback' },
];

// ============================================================================
// Main Component
// ============================================================================

const PluginSPIPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [extensionPoints, setExtensionPoints] = useState<SPIExtensionPoint[]>([]);
  const [pluginRegistrations, setPluginRegistrations] = useState<PluginRegistration[]>([]);
  const [spiConfigs, setSpiConfigs] = useState<SPIConfig[]>([]);
  const [stats, setStats] = useState<SPIStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [activeTab, setActiveTab] = useState<'extensions' | 'plugins' | 'config'>('extensions');
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SPIConfig | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [configForm] = Form.useForm();

  // ---- Data Loading ----

  const loadData = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call when SPI API is available
      throw new Error('API not yet implemented');
    } catch {
      setUsingMockData(true);
      setExtensionPoints(MOCK_EXTENSION_POINTS);
      setPluginRegistrations(MOCK_PLUGIN_REGISTRATIONS);
      setSpiConfigs(MOCK_SPI_CONFIGS);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      throw new Error('API not yet implemented');
    } catch {
      setUsingMockData(true);
      setStats(MOCK_STATS);
    }
  };

  useEffect(() => {
    loadData();
    loadStats();
  }, []);

  // ---- Filtering ----

  const filteredExtensionPoints = useMemo(() => {
    return extensionPoints.filter((ep) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !ep.name.toLowerCase().includes(q) &&
          !ep.description.toLowerCase().includes(q) &&
          !ep.interfaceName.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (filters.spiType && filters.spiType !== 'all' && ep.spiType !== filters.spiType) return false;
      if (filters.status && filters.status !== 'all' && ep.status !== filters.status) return false;
      return true;
    });
  }, [searchQuery, filters, extensionPoints]);

  const filteredPlugins = useMemo(() => {
    return pluginRegistrations.filter((p) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.pluginName.toLowerCase().includes(q) && !p.spiPoint.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (filters.status && filters.status !== 'all' && p.status !== filters.status) return false;
      return true;
    });
  }, [searchQuery, filters, pluginRegistrations]);

  // ---- Actions ----

  const handleSaveConfig = async () => {
    try {
      await configForm.validateFields();
      setSubmitting(true);
      // TODO: Replace with actual API call
      message.success(editingConfig ? 'SPI 配置已更新' : 'SPI 配置已添加');
      setConfigModalVisible(false);
      configForm.resetFields();
      setEditingConfig(null);
    } catch (error: unknown) {
      if (!(error instanceof Error && error.name === 'ValidationError')) {
        message.error('保存配置失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openEditConfig = (config: SPIConfig) => {
    setEditingConfig(config);
    configForm.setFieldsValue({
      spiType: config.spiType,
      enabled: config.enabled,
      maxPlugins: config.maxPlugins,
      timeout: config.timeout,
      fallbackStrategy: config.fallbackStrategy,
    });
    setConfigModalVisible(true);
  };

  const handleDeleteConfig = async (_id: string) => {
    try {
      // TODO: Replace with actual API call
      message.success('配置已删除');
    } catch {
      message.error('删除失败');
    }
  };

  const handleTogglePlugin = async (record: PluginRegistration) => {
    const newStatus = record.status === 'enabled' ? 'disabled' : 'enabled';
    try {
      // TODO: Replace with actual API call
      setPluginRegistrations((prev) =>
        prev.map((p) => (p.id === record.id ? { ...p, status: newStatus } : p))
      );
      message.success(
        `插件 "${record.pluginName}" 已${newStatus === 'enabled' ? '启用' : '禁用'}`
      );
    } catch {
      message.error('状态更新失败');
    }
  };

  // ---- Extension Point Table Columns ----

  const extensionColumns: TableColumn<SPIExtensionPoint>[] = [
    {
      key: 'name',
      title: '扩展点',
      dataIndex: 'name',
      width: 200,
      sortable: true,
      render: (value: unknown, record: SPIExtensionPoint) => (
        <Space direction="vertical" size={0}>
          <Text strong>
            <ApiOutlined style={{ marginRight: 4, color: colors.primary[500] }} />
            {String(value)}
          </Text>
          <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>
            {record.interfaceName}
          </Text>
        </Space>
      ),
    },
    {
      key: 'description',
      title: '描述',
      width: 250,
      render: (_: unknown, record: SPIExtensionPoint) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {record.description}
        </Text>
      ),
    },
    {
      key: 'spiType',
      title: 'SPI 类型',
      width: 120,
      render: (_: unknown, record: SPIExtensionPoint) => (
        <Tag color="purple">
          {spiTypeLabelMap[record.spiType] || record.spiType}
        </Tag>
      ),
    },
    {
      key: 'registeredPlugins',
      title: '已注册插件',
      dataIndex: 'registeredPlugins',
      width: 110,
      sortable: true,
      render: (value: unknown) => (
        <Tag icon={<LinkOutlined />}>{String(value)} 个</Tag>
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: 100,
      render: (_: unknown, record: SPIExtensionPoint) => (
        <Tag color={statusColorMap[record.status]}>{statusLabelMap[record.status]}</Tag>
      ),
    },
    {
      key: 'version',
      title: '版本',
      dataIndex: 'version',
      width: 100,
      render: (value: unknown) => <Text code>{String(value)}</Text>,
    },
    {
      key: 'lastUpdated',
      title: '最后更新',
      dataIndex: 'lastUpdated',
      width: 140,
      sortable: true,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(String(value)).fromNow()}
        </Text>
      ),
    },
  ];

  // ---- Plugin Registration Table Columns ----

  const pluginColumns: TableColumn<PluginRegistration>[] = [
    {
      key: 'pluginName',
      title: '插件名称',
      dataIndex: 'pluginName',
      width: 180,
      sortable: true,
      render: (value: unknown) => (
        <Space>
          <SafetyOutlined style={{ color: colors.primary[500] }} />
          <Text strong>{String(value)}</Text>
        </Space>
      ),
    },
    {
      key: 'spiPoint',
      title: '扩展点',
      dataIndex: 'spiPoint',
      width: 180,
      render: (value: unknown) => (
        <Text code style={{ fontSize: 12 }}>{String(value)}</Text>
      ),
    },
    {
      key: 'provider',
      title: '提供者',
      dataIndex: 'provider',
      width: 160,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{String(value)}</Text>
      ),
    },
    {
      key: 'priority',
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
      sortable: true,
      render: (value: unknown) => (
        <Badge count={Number(value)} style={{ backgroundColor: colors.primary[500] }} />
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: 100,
      render: (_: unknown, record: PluginRegistration) => (
        <Tag color={pluginStatusColorMap[record.status]}>
          {pluginStatusLabelMap[record.status]}
        </Tag>
      ),
    },
    {
      key: 'version',
      title: '版本',
      dataIndex: 'version',
      width: 100,
      render: (value: unknown) => <Text code>{String(value)}</Text>,
    },
    {
      key: 'registeredAt',
      title: '注册时间',
      dataIndex: 'registeredAt',
      width: 140,
      sortable: true,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(String(value)).format('YYYY-MM-DD')}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 100,
      render: (_: unknown, record: PluginRegistration) => (
        <Space size="small">
          <Tooltip title={record.status === 'enabled' ? '禁用' : '启用'}>
            <Button
              type="link"
              size="small"
              icon={
                record.status === 'enabled' ? <BlockOutlined /> : <CheckCircleOutlined />
              }
              onClick={() => handleTogglePlugin(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ---- Config Table Columns ----

  const configColumns: TableColumn<SPIConfig>[] = [
    {
      key: 'spiType',
      title: 'SPI 类型',
      dataIndex: 'spiType',
      width: 150,
      render: (value: unknown) => (
        <Tag color="purple">{spiTypeLabelMap[String(value)] || String(value)}</Tag>
      ),
    },
    {
      key: 'enabled',
      title: '状态',
      width: 80,
      render: (_: unknown, record: SPIConfig) => (
        <Badge
          status={record.enabled ? 'success' : 'default'}
          text={record.enabled ? '已启用' : '已禁用'}
        />
      ),
    },
    {
      key: 'maxPlugins',
      title: '最大插件数',
      dataIndex: 'maxPlugins',
      width: 100,
    },
    {
      key: 'timeout',
      title: '超时时间',
      dataIndex: 'timeout',
      width: 100,
      render: (value: unknown) => <Text>{`${value}ms`}</Text>,
    },
    {
      key: 'fallbackStrategy',
      title: '回退策略',
      dataIndex: 'fallbackStrategy',
      width: 120,
      render: (value: unknown) => <Text code>{String(value)}</Text>,
    },
    {
      key: 'actions',
      title: '操作',
      width: 100,
      render: (_: unknown, record: SPIConfig) => (
        <Space size="small">
          <Tooltip title="编辑配置">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEditConfig(record)}
            />
          </Tooltip>
          <Tooltip title="删除配置">
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteConfig(record.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ---- Filter Definitions ----

  const extensionFilterDefs: FilterDefinition[] = [
    {
      key: 'spiType',
      label: 'SPI 类型',
      options: [
        { label: '全部', value: 'all' },
        ...Object.entries(spiTypeLabelMap).map(([k, v]) => ({ label: v, value: k })),
      ],
    },
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '全部', value: 'all' },
        { label: '活跃', value: 'active' },
        { label: '未激活', value: 'inactive' },
        { label: '已废弃', value: 'deprecated' },
        { label: '实验性', value: 'experimental' },
      ],
    },
  ];

  const pluginFilterDefs: FilterDefinition[] = [
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '全部', value: 'all' },
        { label: '已启用', value: 'enabled' },
        { label: '已禁用', value: 'disabled' },
        { label: '异常', value: 'error' },
      ],
    },
  ];

  // ---- Fallback Strategies ----

  const fallbackStrategies = [
    { label: '拒绝请求 (reject)', value: 'reject' },
    { label: '使用默认实现 (default)', value: 'default' },
    { label: '加入队列 (queue)', value: 'queue' },
    { label: '重试 (retry)', value: 'retry' },
    { label: '跳过 (skip)', value: 'skip' },
    { label: '回滚 (rollback)', value: 'rollback' },
    { label: '记录日志 (log)', value: 'log' },
    { label: '降级 (fallback)', value: 'fallback' },
  ];

  // ---- Tab Content ----

  const renderTabContent = () => {
    switch (activeTab) {
      case 'extensions':
        return (
          <Table
            columns={extensionColumns}
            dataSource={filteredExtensionPoints}
            loading={loading}
            rowKey="id"
            size="middle"
            striped
          />
        );
      case 'plugins':
        return (
          <Table
            columns={pluginColumns}
            dataSource={filteredPlugins}
            loading={loading}
            rowKey="id"
            size="middle"
            striped
          />
        );
      case 'config':
        return (
          <>
            <div style={{ marginBottom: spacing[4] }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingConfig(null);
                  configForm.resetFields();
                  setConfigModalVisible(true);
                }}
              >
                添加 SPI 配置
              </Button>
            </div>
            <Table
              columns={configColumns}
              dataSource={spiConfigs}
              loading={loading}
              rowKey="id"
              size="middle"
              striped
            />
          </>
        );
      default:
        return null;
    }
  };

  const renderFilterBar = () => {
    switch (activeTab) {
      case 'extensions':
        return (
          <SearchFilterBar
            onSearch={setSearchQuery}
            onFilter={setFilters}
            filters={extensionFilterDefs}
            searchPlaceholder="搜索扩展点名称、描述或接口..."
          />
        );
      case 'plugins':
        return (
          <SearchFilterBar
            onSearch={setSearchQuery}
            onFilter={setFilters}
            filters={pluginFilterDefs}
            searchPlaceholder="搜索插件名称或扩展点..."
          />
        );
      default:
        return null;
    }
  };

  // ---- Render ----

  return (
    <div style={{ padding: 0 }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing[6],
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <ExperimentOutlined style={{ marginRight: spacing[3], color: colors.purple[500] }} />
            Plugin SPI
          </Title>
          <Text type="secondary">插件扩展点管理</Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            loadData();
            loadStats();
          }}
          loading={loading}
        >
          刷新
        </Button>
      </div>

      {/* Mock Data Warning */}
      {usingMockData && (
        <Alert
          message="使用模拟数据"
          description="Plugin SPI 后端 API 暂未接入，当前显示的是模拟数据。"
          type="warning"
          showIcon
          closable
          style={{ marginBottom: spacing[4] }}
          onClose={() => setUsingMockData(false)}
        />
      )}

      {/* Stats Cards */}
      {stats && (
        <Row gutter={spacing[4]} style={{ marginBottom: spacing[6] }}>
          <Col span={6}>
            <MetricCard
              title="扩展点总数"
              value={stats.totalExtensionPoints}
              icon={<ApiOutlined style={{ fontSize: 20, color: colors.purple[500] }} />}
              color={colors.purple[500]}
            />
          </Col>
          <Col span={6}>
            <MetricCard
              title="活跃扩展点"
              value={stats.activePoints}
              icon={<CheckCircleOutlined style={{ fontSize: 20, color: colors.success[500] }} />}
              color={colors.success[500]}
            />
          </Col>
          <Col span={6}>
            <MetricCard
              title="插件注册总数"
              value={stats.totalRegistrations}
              icon={<LinkOutlined style={{ fontSize: 20, color: colors.primary[500] }} />}
              color={colors.primary[500]}
            />
          </Col>
          <Col span={6}>
            <MetricCard
              title="已启用插件"
              value={stats.enabledPlugins}
              icon={<SafetyOutlined style={{ fontSize: 20, color: colors.warning[500] }} />}
              color={colors.warning[500]}
            />
          </Col>
        </Row>
      )}

      {/* Main Card with Tabs */}
      <Card>
        <div style={{ marginBottom: spacing[4] }}>
          {renderFilterBar()}
        </div>

        <div style={{ display: 'flex', gap: spacing[2], marginBottom: spacing[4] }}>
          <Button
            type={activeTab === 'extensions' ? 'primary' : 'default'}
            onClick={() => {
              setActiveTab('extensions');
              setSearchQuery('');
              setFilters({});
            }}
          >
            <ApiOutlined /> 扩展点列表
          </Button>
          <Button
            type={activeTab === 'plugins' ? 'primary' : 'default'}
            onClick={() => {
              setActiveTab('plugins');
              setSearchQuery('');
              setFilters({});
            }}
          >
            <LinkOutlined /> 插件注册列表
          </Button>
          <Button
            type={activeTab === 'config' ? 'primary' : 'default'}
            onClick={() => {
              setActiveTab('config');
              setSearchQuery('');
              setFilters({});
            }}
          >
            <SettingOutlined /> SPI 配置
          </Button>
        </div>

        {renderTabContent()}
      </Card>

      {/* SPI Config Modal */}
      <Modal
        title={editingConfig ? '编辑 SPI 配置' : '添加 SPI 配置'}
        open={configModalVisible}
        onCancel={() => {
          setConfigModalVisible(false);
          setEditingConfig(null);
        }}
        onOk={handleSaveConfig}
        confirmLoading={submitting}
        width={520}
        destroyOnClose
      >
        <Form form={configForm} layout="vertical">
          <Form.Item
            name="spiType"
            label="SPI 类型"
            rules={[{ required: true, message: '请选择 SPI 类型' }]}
          >
            <Select>
              {Object.entries(spiTypeLabelMap).map(([k, v]) => (
                <Select.Option key={k} value={k}>{v}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="enabled"
            label="启用状态"
            valuePropName="checked"
            initialValue={true}
          >
            <Select>
              <Select.Option value={true}>已启用</Select.Option>
              <Select.Option value={false}>已禁用</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="maxPlugins"
            label="最大插件数"
            rules={[{ required: true, message: '请输入最大插件数' }]}
            initialValue={10}
          >
            <Input type="number" min={1} />
          </Form.Item>
          <Form.Item
            name="timeout"
            label="超时时间 (毫秒)"
            rules={[{ required: true, message: '请输入超时时间' }]}
            initialValue={5000}
          >
            <Input type="number" min={100} step={100} />
          </Form.Item>
          <Form.Item
            name="fallbackStrategy"
            label="回退策略"
            rules={[{ required: true, message: '请选择回退策略' }]}
            initialValue="reject"
          >
            <Select>
              {fallbackStrategies.map((s) => (
                <Select.Option key={s.value} value={s.value}>{s.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PluginSPIPage;
