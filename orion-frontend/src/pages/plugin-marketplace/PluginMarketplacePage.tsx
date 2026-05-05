/**
 * Plugin Marketplace Page
 * Phase 3 - Browse, install, and manage plugins from the marketplace
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Tag,
  Space,
  Input,
  message,
  Typography,
  Tabs,
  Descriptions,
} from 'antd';
import {
  AppstoreOutlined,
  ReloadOutlined,
  DownloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  getAvailablePlugins,
  getInstalledPlugins,
  installPlugin,
  activatePlugin,
  deactivatePlugin,
  type Plugin,
} from '@/api/plugins';

const { Title, Text } = Typography;

const PluginMarketplacePage: React.FC = () => {
  const [availablePlugins, setAvailablePlugins] = useState<Plugin[]>([]);
  const [installedPlugins, setInstalledPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailPlugin, setDetailPlugin] = useState<Plugin | null>(null);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [availRes, instRes] = await Promise.all([
        getAvailablePlugins(),
        getInstalledPlugins(),
      ]);
      setAvailablePlugins((availRes.data as any) || []);
      setInstalledPlugins((instRes.data as any) || []);
    } catch {
      message.error('Failed to load plugin data');
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (pluginId: string) => {
    try {
      await installPlugin(pluginId, {});
      message.success('Plugin installed');
      loadData();
    } catch {
      message.error('Failed to install plugin');
    }
  };

  const handleToggle = async (pluginId: string, active: boolean) => {
    try {
      if (active) {
        await deactivatePlugin(pluginId);
      } else {
        await activatePlugin(pluginId);
      }
      message.success(active ? 'Plugin deactivated' : 'Plugin activated');
      loadData();
    } catch {
      message.error('Failed to toggle plugin');
    }
  };

  const filteredAvailable = availablePlugins.filter(
    (p) =>
      p.name.toLowerCase().includes(searchText.toLowerCase()) ||
      p.description.toLowerCase().includes(searchText.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(searchText.toLowerCase()))
  );

  const availableColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Tags',
      dataIndex: 'tags',
      key: 'tags',
      render: (v: string[]) => v.slice(0, 3).map((t) => <Tag key={t}>{t}</Tag>),
    },
    { title: 'Author', dataIndex: 'author', key: 'author' },
    { title: 'Version', dataIndex: 'version', key: 'version' },
    { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Plugin) => (
        <Space>
          <Button size="small" onClick={() => setDetailPlugin(record)}>Details</Button>
          <Button size="small" type="primary" icon={<DownloadOutlined />} onClick={() => handleInstall(record.id)}>
            Install
          </Button>
        </Space>
      ),
    },
  ];

  const installedColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Version', dataIndex: 'version', key: 'version' },
    {
      title: 'State',
      dataIndex: 'state',
      key: 'state',
      render: (v: string) => <Tag color={v === 'ACTIVE' ? 'green' : v === 'INSTALLED' ? 'blue' : 'default'}>{v}</Tag>,
    },
    { title: 'Installed At', dataIndex: 'installedAt', key: 'installedAt' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Plugin) => (
        <Space>
          <Button
            size="small"
            onClick={() => handleToggle(record.id, record.state === 'ACTIVE')}
          >
            {record.state === 'ACTIVE' ? 'Deactivate' : 'Activate'}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <AppstoreOutlined /> Plugin Marketplace
          </Title>
          <Text type="secondary">Browse and install plugins to extend platform capabilities</Text>
        </div>
        <Space>
          <Input
            placeholder="Search plugins..."
            prefix={<SearchOutlined />}
            style={{ width: 250 }}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            Refresh
          </Button>
        </Space>
      </div>

      <Card>
        <Tabs
          defaultActiveKey="available"
          items={[
            {
              key: 'available',
              label: `Available Plugins (${filteredAvailable.length})`,
              children: (
                <Table
                  columns={availableColumns}
                  dataSource={filteredAvailable}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
            {
              key: 'installed',
              label: `Installed (${installedPlugins.length})`,
              children: (
                <Table
                  columns={installedColumns}
                  dataSource={installedPlugins}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title={detailPlugin?.name}
        open={!!detailPlugin}
        onCancel={() => setDetailPlugin(null)}
        footer={
          detailPlugin ? (
            <Button type="primary" icon={<DownloadOutlined />} onClick={() => { handleInstall(detailPlugin.id); setDetailPlugin(null); }}>
              Install
            </Button>
          ) : null
        }
      >
        {detailPlugin && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Version">{detailPlugin.version}</Descriptions.Item>
            <Descriptions.Item label="Type">{detailPlugin.type}</Descriptions.Item>
            <Descriptions.Item label="Author">{detailPlugin.author}</Descriptions.Item>
            <Descriptions.Item label="Description">{detailPlugin.description}</Descriptions.Item>
            <Descriptions.Item label="Security Level">
              <Tag color={detailPlugin.securityLevel === 'HIGH' ? 'red' : detailPlugin.securityLevel === 'MEDIUM' ? 'orange' : 'green'}>
                {detailPlugin.securityLevel}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Tags">
              {detailPlugin.tags.map((t) => <Tag key={t}>{t}</Tag>)}
            </Descriptions.Item>
            <Descriptions.Item label="Permissions">
              {detailPlugin.permissions?.join(', ') || 'None'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default PluginMarketplacePage;
