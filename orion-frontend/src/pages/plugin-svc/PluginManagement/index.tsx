/**
 * PluginManagement Page
 * - Summary cards (Total, Enabled, Disabled, Updates Available)
 * - Search and filter bar (by category, status)
 * - Plugin table with name, version, status, category, author, install date, actions
 * - Plugin detail drawer (metadata, config form, permissions, health status)
 * - Install plugin modal (name, version, source, install button)
 * - Execute plugin task modal (taskId, pipelineRunId, stageId, config, env, timeout)
 */
import React, { useState, useEffect } from 'react';
import { Typography, Button, Space, message } from 'antd';
import { PlusOutlined, ReloadOutlined, AppstoreOutlined } from '@ant-design/icons';
import {
  getInstalledPlugins,
  getPlugin,
  configurePlugin,
  type PluginExecutionResult,
} from '@/api/plugins';
import { spacing } from '@/tokens';
import PluginList from './PluginList';
import PluginDetailDrawer from './PluginDetail';
import PluginCreateModal from './PluginCreateModal';
import PluginLifecycleModal from './PluginLifecycle';
import { type ApiPlugin, type PluginConfig } from './types';
import { colors } from '@/tokens';

const { Title, Text } = Typography;

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
      setPlugins(response.data || []);
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes('401') || err.message.includes('403')) {
          message.error('权限不足，请重新登录或联系管理员');
        } else {
          message.error(`加载插件列表失败：${err.message}`);
        }
      } else {
        message.error('加载插件列表失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle open plugin detail drawer
  const handleConfigure = async (plugin: ApiPlugin) => {
    setSelectedPlugin(plugin);
    setDetailDrawerOpen(true);

    // Refresh plugin details
    try {
      const response = await getPlugin(plugin.id);
      setSelectedPlugin(response.data as ApiPlugin);
    } catch (err: unknown) {
      if (err instanceof Error) {
        message.error(`加载插件详情失败：${err.message}`);
      } else {
        message.error('加载插件详情失败，请稍后重试');
      }
    }
  };

  // Handle open execute task modal
  const handleExecuteTask = (plugin: ApiPlugin) => {
    setSelectedPlugin(plugin);
    setExecuteModalOpen(true);
  };

  // Handle execute task success
  const handleExecuteSuccess = (result: PluginExecutionResult) => {
    setExecuteModalOpen(false);
    setSelectedPlugin(null);
    message.success(`任务执行完成：${result.status}`);
  };

  // Handle save plugin config
  const handleSaveConfig = async (config: PluginConfig) => {
    if (!selectedPlugin) return;

    try {
      await configurePlugin(selectedPlugin.id, { config });
      message.success('配置保存成功');
      // Refresh plugin details
      const response = await getPlugin(selectedPlugin.id);
      setSelectedPlugin(response.data as ApiPlugin);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存配置失败';
      message.error(`保存配置失败：${msg}`);
    }
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

  return (
    <div style={{ padding: 0 }} data-testid="plugin-management-page">
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing[5],
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <AppstoreOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            插件管理
          </Title>
          <Text type="secondary">共 {plugins.length} 个插件</Text>
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

      {/* Plugin list with summary cards, filters, and table */}
      <PluginList
        plugins={plugins}
        loading={loading}
        onRefresh={handleRefresh}
        onConfigure={handleConfigure}
        onExecuteTask={handleExecuteTask}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filters={filters}
        onFilterChange={setFilters}
      />

      {/* Install plugin modal */}
      <PluginCreateModal
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
      <PluginLifecycleModal
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
