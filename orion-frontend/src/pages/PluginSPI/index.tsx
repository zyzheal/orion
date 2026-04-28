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
import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Button, Form, message, Alert, Row, Col } from 'antd';
import {
  ReloadOutlined,
  ApiOutlined,
  LinkOutlined,
  CheckCircleOutlined,
  ExperimentOutlined,
  SettingOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import MetricCard from '@/components/MetricCard';
import { colors, spacing } from '@/tokens';
import ExtensionPointList from './ExtensionPointList';
import PluginRegistry from './PluginRegistry';
import SPIConfig from './SPIConfig';
import {
  type SPIExtensionPoint,
  type PluginRegistration,
  type SPIConfig as SPIConfigType,
  type SPIStats,
  MOCK_STATS,
  MOCK_EXTENSION_POINTS,
  MOCK_PLUGIN_REGISTRATIONS,
  MOCK_SPI_CONFIGS,
} from './types';

const { Title, Text } = Typography;

// ============================================================================
// Main Component
// ============================================================================

const PluginSPIPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [extensionPoints, setExtensionPoints] = useState<SPIExtensionPoint[]>([]);
  const [pluginRegistrations, setPluginRegistrations] = useState<PluginRegistration[]>([]);
  const [spiConfigs, setSpiConfigs] = useState<SPIConfigType[]>([]);
  const [stats, setStats] = useState<SPIStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [activeTab, setActiveTab] = useState<'extensions' | 'plugins' | 'config'>('extensions');
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SPIConfigType | null>(null);
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

  const openEditConfig = useCallback(
    (config: SPIConfigType) => {
      setEditingConfig(config);
      configForm.setFieldsValue({
        spiType: config.spiType,
        enabled: config.enabled,
        maxPlugins: config.maxPlugins,
        timeout: config.timeout,
        fallbackStrategy: config.fallbackStrategy,
      });
      setConfigModalVisible(true);
    },
    [configForm]
  );

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
      message.success(`插件 "${record.pluginName}" 已${newStatus === 'enabled' ? '启用' : '禁用'}`);
    } catch {
      message.error('状态更新失败');
    }
  };

  // ---- Tab Switching ----

  const handleTabChange = (tab: 'extensions' | 'plugins' | 'config') => {
    setActiveTab(tab);
    setSearchQuery('');
    setFilters({});
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
      <div style={{ display: 'flex', gap: spacing[2], marginBottom: spacing[4] }}>
        <Button
          type={activeTab === 'extensions' ? 'primary' : 'default'}
          onClick={() => handleTabChange('extensions')}
        >
          <ApiOutlined /> 扩展点列表
        </Button>
        <Button
          type={activeTab === 'plugins' ? 'primary' : 'default'}
          onClick={() => handleTabChange('plugins')}
        >
          <LinkOutlined /> 插件注册列表
        </Button>
        <Button
          type={activeTab === 'config' ? 'primary' : 'default'}
          onClick={() => handleTabChange('config')}
        >
          <SettingOutlined /> SPI 配置
        </Button>
      </div>

      {/* Tab Content */}
      {activeTab === 'extensions' && (
        <ExtensionPointList
          extensionPoints={extensionPoints}
          loading={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filters={filters}
          onFilterChange={setFilters}
        />
      )}
      {activeTab === 'plugins' && (
        <PluginRegistry
          pluginRegistrations={pluginRegistrations}
          loading={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filters={filters}
          onFilterChange={setFilters}
          onTogglePlugin={handleTogglePlugin}
        />
      )}
      {activeTab === 'config' && (
        <SPIConfig
          spiConfigs={spiConfigs}
          loading={loading}
          configModalVisible={configModalVisible}
          editingConfig={editingConfig}
          submitting={submitting}
          configForm={configForm}
          onOpenAddConfig={() => {
            setEditingConfig(null);
            configForm.resetFields();
            setConfigModalVisible(true);
          }}
          onOpenEditConfig={openEditConfig}
          onCloseConfigModal={() => {
            setConfigModalVisible(false);
            setEditingConfig(null);
          }}
          onSaveConfig={handleSaveConfig}
          onDeleteConfig={handleDeleteConfig}
        />
      )}
    </div>
  );
};

export default PluginSPIPage;
