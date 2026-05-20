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
import { Typography, Button, Form, message, Row, Col } from 'antd';
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
  getSPIStats,
  getExtensionPoints,
  getPluginRegistrations,
  getSPIConfigs,
  createSPIConfig,
  updateSPIConfig,
  deleteSPIConfig,
  toggleRegistration,
  type SPIStats as APISPIStats,
  type SPIExtensionPoint as APISPIExtensionPoint,
  type PluginRegistration as APIPluginRegistration,
  type SPIConfig as APISPIConfig,
} from '@/api/plugin-spi';
import {
  type SPIExtensionPoint,
  type PluginRegistration,
  type SPIConfig as SPIConfigType,
  type SPIStats,
} from './types';

const { Title, Text } = Typography;

/** Map API SPIExtensionPoint to UI shape */
function mapApiExtensionPoint(p: APISPIExtensionPoint): SPIExtensionPoint {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    spiType: p.id, // Use id as placeholder, real mapping depends on backend
    registeredPlugins: p.registrationCount,
    status: p.enabled ? 'active' : 'inactive',
    interfaceName: p.interface,
    version: '1.0.0',
    lastUpdated: p.createdAt,
  };
}

/** Map API PluginRegistration to UI shape */
function mapApiRegistration(r: APIPluginRegistration | any): PluginRegistration {
  return {
    id: r.id || r.pluginName || '',
    pluginName: r.pluginName || r.name || '',
    spiPoint: r.extensionPointName || r.spiPoint || r.capabilities?.[0] || 'Unknown',
    provider: r.author || r.provider || '',
    priority: r.priority || 0,
    status: r.status || (r.enabled ? 'enabled' : 'disabled'),
    version: r.version || r.manifest?.version || '1.0.0',
    registeredAt: r.createdAt || r.enabledAt || new Date().toISOString(),
  };
}

/** Map API SPIConfig to UI shape */
function mapApiSPIConfig(c: APISPIConfig): SPIConfigType {
  return {
    id: c.id,
    spiType: c.key,
    enabled: true,
    maxPlugins: 10,
    timeout: 5000,
    fallbackStrategy: 'default',
  };
}

/** Map API stats to UI stats */
function mapApiStats(s: APISPIStats | any): SPIStats {
  return {
    totalExtensionPoints: s.totalExtensionPoints || s.totalPlugins || 0,
    activePoints: s.activePoints || s.enabledPlugins || 0,
    totalRegistrations: s.totalRegistrations || s.totalPlugins || 0,
    enabledPlugins: s.enabledPlugins || 0,
  };
}

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
  const [submitting, setSubmitting] = useState(false);
  const [configForm] = Form.useForm();

  // ---- Data Loading ----

  const loadData = async () => {
    setLoading(true);
    try {
      const [extRes, regRes, cfgRes] = await Promise.all([
        getExtensionPoints(),
        getPluginRegistrations(),
        getSPIConfigs(),
      ]);
      const extPoints = extRes.data.data?.extensionPoints || extRes.data.data?.data?.extensionPoints || [];
      const regs = regRes.data.data?.registrations || regRes.data.data?.data?.registrations || [];
      const cfgs = cfgRes.data.data?.configs || cfgRes.data.data?.data?.configs || [];
      setExtensionPoints(extPoints.map(mapApiExtensionPoint));
      setPluginRegistrations(regs.map(mapApiRegistration));
      setSpiConfigs(cfgs.map(mapApiSPIConfig));
    } catch (error: unknown) {
      message.error(`加载 SPI 数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await getSPIStats();
      const statsData = response.data.data?.stats || response.data.data || {};
      setStats(mapApiStats(statsData));
    } catch (error: unknown) {
      message.error(`加载统计信息失败: ${(error as Error).message}`);
    }
  };

  useEffect(() => {
    loadData();
    loadStats();
  }, []);

  // ---- Actions ----

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

  const handleSaveConfig = async () => {
    try {
      const values = await configForm.validateFields();
      setSubmitting(true);
      if (editingConfig) {
        await updateSPIConfig(editingConfig.id, {
          key: values.spiType || editingConfig.id,
          value: String(values.maxPlugins || ''),
          description: `SPI config for ${values.spiType}`,
          category: values.spiType || 'general',
          encrypted: false,
        });
        message.success('SPI 配置已更新');
      } else {
        await createSPIConfig({
          key: values.spiType || 'new-config',
          value: String(values.maxPlugins || ''),
          description: 'New SPI config',
          category: values.spiType || 'general',
          encrypted: false,
        });
        message.success('SPI 配置已添加');
      }
      setConfigModalVisible(false);
      configForm.resetFields();
      setEditingConfig(null);
      loadData();
    } catch (error: unknown) {
      if (!(error instanceof Error && error.name === 'ValidationError')) {
        message.error(`保存配置失败：${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfig = async (id: string) => {
    try {
      await deleteSPIConfig(id);
      message.success('配置已删除');
      loadData();
    } catch (error: unknown) {
      message.error(`删除配置失败：${(error as Error).message}`);
    }
  };

  const handleTogglePlugin = async (record: PluginRegistration) => {
    const newEnabled = record.status === 'enabled' ? 'disabled' : 'enabled';
    try {
      await toggleRegistration(record.id, newEnabled === 'enabled');
      setPluginRegistrations((prev) =>
        prev.map((p) => (p.id === record.id ? { ...p, status: newEnabled } : p))
      );
      message.success(
        `插件 "${record.pluginName}" 已${newEnabled === 'enabled' ? '启用' : '禁用'}`
      );
    } catch (error: unknown) {
      message.error(`状态更新失败：${(error as Error).message}`);
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
