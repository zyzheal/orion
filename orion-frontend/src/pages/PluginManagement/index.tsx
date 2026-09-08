/**
 * PluginManagement Page
 * - Summary cards (Total, Enabled, Disabled, Updates Available)
 * - Search and filter bar (by category, status)
 * - Plugin table with name, version, status, category, author, install date, actions
 * - Plugin detail drawer (metadata, config form, permissions, health status)
 * - Install plugin modal (name, version, source, install button)
 * - Execute plugin task modal (taskId, pipelineRunId, stageId, config, env, timeout)
 *
 * Phase 249 拆分:
 * - usePluginManagementState.ts: state + useQuery + handlers
 * - Components/PageHeader.tsx: 标题 + 刷新 + 安装插件
 * - Components/Modals.tsx: Install/Draft/Lifecycle Modals 组合
 */
import PluginList from './PluginList';
import { usePluginManagementState } from './usePluginManagementState';
import { PageHeader } from './Components/PageHeader';
import { Modals } from './Components/Modals';

const PluginManagement: React.FC = () => {
  const {
    plugins,
    loading,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    installModalOpen,
    setInstallModalOpen,
    detailDrawerOpen,
    setDetailDrawerOpen,
    executeModalOpen,
    setExecuteModalOpen,
    selectedPlugin,
    setSelectedPlugin,
    reloadPlugins,
    handleConfigure,
    handleExecuteTask,
    handleExecuteSuccess,
    handleSaveConfig,
    handleInstallSuccess,
  } = usePluginManagementState();

  return (
    <div style={{ padding: 0 }} data-testid="plugin-management-page">
      <PageHeader
        pluginCount={plugins.length}
        loading={loading}
        onRefresh={() => reloadPlugins()}
        onInstall={() => setInstallModalOpen(true)}
      />

      <PluginList
        plugins={plugins}
        loading={loading}
        onRefresh={() => reloadPlugins()}
        onConfigure={handleConfigure}
        onExecuteTask={handleExecuteTask}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filters={filters}
        onFilterChange={setFilters}
      />

      <Modals
        installModalOpen={installModalOpen}
        setInstallModalOpen={setInstallModalOpen}
        detailDrawerOpen={detailDrawerOpen}
        setDetailDrawerOpen={setDetailDrawerOpen}
        executeModalOpen={executeModalOpen}
        setExecuteModalOpen={setExecuteModalOpen}
        selectedPlugin={selectedPlugin}
        setSelectedPlugin={setSelectedPlugin}
        handleInstallSuccess={handleInstallSuccess}
        handleSaveConfig={handleSaveConfig}
        handleExecuteSuccess={handleExecuteSuccess}
      />
    </div>
  );
};

export default PluginManagement;
