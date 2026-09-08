/**
 * Plugin SPI (Service Provider Interface) Page
 * 插件扩展点管理
 *
 * 拆分自 index.tsx (P2-9 Phase 213)
 * - usePluginSPIState.ts: state + useQuery + mappers + handlers
 * - Components/PageHeader.tsx: title + refresh
 * - Components/StatsRow.tsx: 4 MetricCards
 * - Components/TabSwitcher.tsx: 3 tab buttons
 * - index.tsx: composition
 */
import { usePluginSPIState } from './usePluginSPIState';
import { PageHeader } from './Components/PageHeader';
import { StatsRow } from './Components/StatsRow';
import { TabSwitcher } from './Components/TabSwitcher';
import ExtensionPointList from './ExtensionPointList';
import PluginRegistry from './PluginRegistry';
import SPIConfig from './SPIConfig';

const PluginSPIPage = () => {
  const {
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    activeTab,
    configModalVisible,
    setConfigModalVisible,
    editingConfig,
    setEditingConfig,
    submitting,
    configForm,
    extensionPoints,
    pluginRegistrations,
    spiConfigs,
    stats,
    loading,
    loadData,
    openEditConfig,
    handleSaveConfig,
    handleDeleteConfig,
    handleTogglePlugin,
    handleTabChange,
  } = usePluginSPIState();

  return (
    <div style={{ padding: 0 }}>
      <PageHeader loading={loading} onRefresh={loadData} />

      {stats && <StatsRow stats={stats} />}

      <TabSwitcher activeTab={activeTab} onChange={handleTabChange} />

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
