/**
 * PluginPicker Component
 *
 * Modal-based plugin selector with tabs for Built-in, Marketplace, Remote,
 * and Custom Script plugins. Supports search filtering and category grouping.
 */

import React, { useState, useEffect } from 'react';
import { Modal, Input, Tabs, Card, Tag, Button, Spin, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { getBuiltInPlugins, searchMarketplace } from '../../api/pluginApi';
import { colors } from '@/tokens';

const { Search } = Input;

interface PluginItem {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  tier: string;
  tags: string[];
}

export interface PluginPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (plugin: PluginItem) => void;
}

const SAMPLE_BUILTIN_PLUGINS: PluginItem[] = [
  { id: 'git/clone', name: 'git/clone', version: '1.0.0', description: 'Clone a git repository', category: 'SCM', tier: 'TIER_1', tags: ['git', 'scm'] },
  { id: 'npm/install', name: 'npm/install', version: '1.0.0', description: 'Install npm dependencies', category: 'Build', tier: 'TIER_1', tags: ['npm', 'build'] },
  { id: 'docker/build', name: 'docker/build', version: '1.0.0', description: 'Build Docker image', category: 'Build', tier: 'TIER_2', tags: ['docker', 'build'] },
];

const SAMPLE_MARKETPLACE_PLUGINS: PluginItem[] = [
  { id: 'sonar-scanner', name: 'sonar-scanner', version: '2.1.0', description: 'Code quality analysis', category: 'Security', tier: 'TIER_2', tags: ['security', 'quality'] },
  { id: 'terraform', name: 'terraform', version: '1.5.0', description: 'Infrastructure as Code', category: 'Deploy', tier: 'TIER_3', tags: ['iac', 'terraform'] },
];

const TIER_COLORS: Record<string, string> = {
  TIER_1: 'green',
  TIER_2: 'blue',
  TIER_3: 'orange',
};

export const PluginPicker: React.FC<PluginPickerProps> = ({
  open,
  onClose,
  onSelect,
}) => {
  const [loading, setLoading] = useState(false);
  const [builtinPlugins, setBuiltinPlugins] = useState<PluginItem[]>([]);
  const [marketplacePlugins, setMarketplacePlugins] = useState<PluginItem[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<PluginItem | null>(null);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (open) {
      loadPlugins();
    }
  }, [open]);

  const extractData = <T,>(response: unknown): T[] => {
    const axiosResp = response as { data?: { data?: T[] } };
    if (axiosResp.data?.data && Array.isArray(axiosResp.data)) {
      return axiosResp.data;
    }
    const direct = response as T[];
    return Array.isArray(direct) ? direct : [];
  };

  const loadPlugins = async () => {
    setLoading(true);
    try {
      const [builtinResp, marketplaceResp] = await Promise.all([
        getBuiltInPlugins(),
        searchMarketplace(''),
      ]);
      const builtin = extractData<PluginItem>(builtinResp);
      const marketplace = extractData<PluginItem>(marketplaceResp);
      if (builtin.length > 0) setBuiltinPlugins(builtin);
      else setBuiltinPlugins(SAMPLE_BUILTIN_PLUGINS);
      if (marketplace.length > 0) setMarketplacePlugins(marketplace);
      else setMarketplacePlugins(SAMPLE_MARKETPLACE_PLUGINS);
    } catch {
      message.warning('Using sample plugin data');
      setBuiltinPlugins(SAMPLE_BUILTIN_PLUGINS);
      setMarketplacePlugins(SAMPLE_MARKETPLACE_PLUGINS);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (plugin: PluginItem) => {
    setSelectedPlugin(plugin);
  };

  const handleAdd = () => {
    if (selectedPlugin) {
      onSelect(selectedPlugin);
      onClose();
    }
  };

  const filterPlugins = (plugins: PluginItem[]) =>
    plugins.filter(
      (p) =>
        p.name.toLowerCase().includes(searchText.toLowerCase()) ||
        p.description.toLowerCase().includes(searchText.toLowerCase()) ||
        p.tags.some((t) => t.toLowerCase().includes(searchText.toLowerCase()))
    );

  const groupByCategory = (plugins: PluginItem[]) =>
    plugins.reduce<Record<string, PluginItem[]>>((acc, p) => {
      (acc[p.category] ||= []).push(p);
      return acc;
    }, {});

  const renderPluginCard = (plugin: PluginItem) => (
    <Card
      key={plugin.id}
      size="small"
      hoverable
      onClick={() => handleSelect(plugin)}
      style={{
        border: selectedPlugin?.id === plugin.id ? '2px solid colors.primary[500]' : undefined,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <strong>{plugin.name}</strong>
          <div style={{ fontSize: 12, color: colors.neutral[600] }}>{plugin.description}</div>
        </div>
        <Tag color={TIER_COLORS[plugin.tier] || 'default'}>{plugin.tier}</Tag>
      </div>
    </Card>
  );

  const renderPluginGrid = (plugins: PluginItem[]) => {
    const filtered = filterPlugins(plugins);
    if (filtered.length === 0) {
      return <div style={{ color: colors.neutral[500], textAlign: 'center', padding: 24 }}>No plugins found</div>;
    }
    const grouped = groupByCategory(filtered);
    return Object.entries(grouped).map(([category, items]) => (
      <div key={category} style={{ marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 8px' }}>{category}</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {items.map(renderPluginCard)}
        </div>
      </div>
    ));
  };

  const tabsItems = [
    {
      key: 'builtin',
      label: 'Built-in',
      children: renderPluginGrid(builtinPlugins),
    },
    {
      key: 'marketplace',
      label: 'Marketplace',
      children: renderPluginGrid(marketplacePlugins),
    },
    {
      key: 'remote',
      label: 'Remote',
      children: <div style={{ padding: 24, textAlign: 'center', color: colors.neutral[500] }}>Remote plugin installation by URL (coming soon)</div>,
    },
    {
      key: 'custom',
      label: 'Custom Script',
      children: <div style={{ padding: 24, textAlign: 'center', color: colors.neutral[500] }}>Use Inline Script Editor to write custom scripts</div>,
    },
  ];

  return (
    <Modal
      title="Plugin Picker"
      open={open}
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Search
            placeholder="Search plugins..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
          />
          <div>
            <Button onClick={onClose} style={{ marginRight: 8 }}>
              Cancel
            </Button>
            <Button type="primary" onClick={handleAdd} disabled={!selectedPlugin}>
              Add to Pipeline
            </Button>
          </div>
        </div>
      }
      width={800}
    >
      <Spin spinning={loading}>
        <Tabs items={tabsItems} defaultActiveKey="builtin" />
      </Spin>
      {selectedPlugin && (
        <div style={{ marginTop: 16, padding: 12, background: colors.neutral[100], borderRadius: 4 }}>
          <strong>Selected: {selectedPlugin.name}</strong>
          <div>Version: {selectedPlugin.version}</div>
        </div>
      )}
    </Modal>
  );
};

export default PluginPicker;
