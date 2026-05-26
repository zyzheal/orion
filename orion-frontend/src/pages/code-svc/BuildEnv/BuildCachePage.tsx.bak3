/**
 * Build Cache Page
 * Two tabs: Cache Configs and Cache Entries, with CRUD and cleanup actions.
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Tabs,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Popconfirm,
  message,
} from 'antd';
import { spacing } from '@/tokens';
import { ReloadOutlined, DeleteOutlined, ThunderboltOutlined, DatabaseOutlined,} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import {
  getBuildCacheConfigs,
  createBuildCacheConfig,
  updateBuildCacheConfig,
  deleteBuildCacheConfig,
  getBuildCacheEntries,
  deleteBuildCacheEntry,
  cleanupExpiredCache,
  clearCacheConfig,
  type BuildCacheConfig,
  type BuildCacheEntry,
  type BuildCacheConfigInput,
} from '@/api/build-env';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const BuildCachePage: React.FC = () => {
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [configs, setConfigs] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<BuildCacheConfig | null>(null);
  const [form] = Form.useForm<BuildCacheConfigInput>();

  const loadConfigs = async () => {
    setLoadingConfigs(true);
    try {
      const response = await getBuildCacheConfigs();
      const apiData = response.data.data;
      setConfigs(Array.isArray(apiData) ? apiData : []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载缓存配置失败：${error.message}`);
      } else {
        message.error('加载缓存配置失败，请稍后重试');
      }
    } finally {
      setLoadingConfigs(false);
    }
  };

  const loadEntries = async () => {
    setLoadingEntries(true);
    try {
      const response = await getBuildCacheEntries();
      const apiData = response.data.data;
      setEntries(Array.isArray(apiData) ? apiData : []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载缓存条目失败：${error.message}`);
      } else {
        message.error('加载缓存条目失败，请稍后重试');
      }
    } finally {
      setLoadingEntries(false);
    }
  };

  useEffect(() => {
    loadConfigs();
    loadEntries();
  }, []);

  const handleSaveConfig = async () => {
    try {
      const values = await form.validateFields();
      if (editingConfig) {
        await updateBuildCacheConfig(editingConfig.id, values);
        message.success('Cache config updated');
      } else {
        await createBuildCacheConfig(values);
        message.success('Cache config created');
      }
      setConfigModalOpen(false);
      setEditingConfig(null);
      form.resetFields();
      loadConfigs();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (err.errorFields) return;
      if (error instanceof Error) {
        message.error(`保存缓存配置失败：${error.message}`);
      } else {
        message.error('保存缓存配置失败，请稍后重试');
      }
    }
  };

  const handleDeleteConfig = async (id: string) => {
    try {
      await deleteBuildCacheConfig(id);
      message.success('Cache config deleted');
      loadConfigs();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除缓存配置失败：${error.message}`);
      } else {
        message.error('删除缓存配置失败，请稍后重试');
      }
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteBuildCacheEntry(id);
      message.success('Cache entry deleted');
      loadEntries();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除缓存条目失败：${error.message}`);
      } else {
        message.error('删除缓存条目失败，请稍后重试');
      }
    }
  };

  const handleCleanupExpired = async () => {
    try {
      await cleanupExpiredCache();
      message.success('Expired cache cleaned up');
      loadConfigs();
      loadEntries();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`清理缓存失败：${error.message}`);
      } else {
        message.error('清理缓存失败，请稍后重试');
      }
    }
  };

  const handleClearConfig = async (id: string) => {
    try {
      await clearCacheConfig(id);
      message.success('Cache config cleared');
      loadEntries();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`清除缓存配置失败：${error.message}`);
      } else {
        message.error('清除缓存配置失败，请稍后重试');
      }
    }
  };

  const openCreateConfigModal = () => {
    setEditingConfig(null);
    form.resetFields();
    form.setFieldValue('enabled', true);
    form.setFieldValue('strategy', 'volume');
    form.setFieldValue('paths', []);
    setConfigModalOpen(true);
  };

  const openEditConfigModal = (config: BuildCacheConfig) => {
    setEditingConfig(config);
    form.setFieldsValue({
      name: config.name,
      pipeline: config.pipeline,
      stage: config.stage,
      strategy: config.strategy,
      paths: config.paths,
      ttlDays: config.ttlDays,
      enabled: config.enabled,
    });
    setConfigModalOpen(true);
  };

  const configColumns: TableColumn<BuildCacheConfig>[] = [
    {
      key: 'name',
      title: 'Name',
      dataIndex: 'name',
      width: 180,
      sortable: true,
      render: (value) => <Text strong>{String(value)}</Text>,
    },
    {
      key: 'pipeline',
      title: 'Pipeline',
      dataIndex: 'pipeline',
      width: 160,
      render: (value) => (
        <Text code style={{ fontSize: spacing[3] }}>
          {String(value)}
        </Text>
      ),
    },
    {
      key: 'stage',
      title: 'Stage',
      dataIndex: 'stage',
      width: 120,
      render: (value) => <Text>{String(value)}</Text>,
    },
    {
      key: 'strategy',
      title: 'Strategy',
      dataIndex: 'strategy',
      width: 120,
      render: (value) => {
        const colorMap: Record<string, string> = {
          volume: 'blue',
          s3: 'orange',
          registry: 'purple',
        };
        return <Tag color={colorMap[String(value)] || 'default'}>{String(value)}</Tag>;
      },
    },
    {
      key: 'paths',
      title: 'Paths',
      dataIndex: 'paths',
      width: 250,
      render: (value) => {
        const paths = value as string[];
        return (
          <Space wrap size={4}>
            {paths.slice(0, 3).map((p, i) => (
              <Tag key={i} style={{ margin: 0 }}>
                {p}
              </Tag>
            ))}
            {paths.length > 3 && <Tag>+{paths.length - 3}</Tag>}
          </Space>
        );
      },
    },
    {
      key: 'ttlDays',
      title: 'TTL (days)',
      dataIndex: 'ttlDays',
      width: 100,
      render: (value) => <Text>{String(value)}d</Text>,
    },
    {
      key: 'enabled',
      title: 'Enabled',
      dataIndex: 'enabled',
      width: 100,
      render: (value) => (
        <StatusBadge
          status={value ? 'success' : 'cancelled'}
          label={value ? 'Yes' : 'No'}
          size="small"
          showDot={false}
        />
      ),
    },
    {
      key: 'actions',
      title: 'Actions',
      width: 200,
      render: (_: unknown, record: BuildCacheConfig) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => openEditConfigModal(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Clear this cache config?"
            onConfirm={() => handleClearConfig(record.id)}
            okText="Clear"
            cancelText="Cancel"
          >
            <Button type="link" size="small" icon={<ThunderboltOutlined />}>
              Clear
            </Button>
          </Popconfirm>
          <Popconfirm
            title="Delete this cache config?"
            description="This will also remove all associated cache entries."
            onConfirm={() => handleDeleteConfig(record.id)}
            okText="Delete"
            cancelText="Cancel"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const entryColumns: TableColumn<BuildCacheEntry>[] = [
    {
      key: 'key',
      title: 'Cache Key',
      dataIndex: 'key',
      width: 300,
      sortable: true,
      render: (value) => (
        <Text code style={{ fontSize: spacing[3] }}>
          {String(value)}
        </Text>
      ),
    },
    {
      key: 'configId',
      title: 'Config ID',
      dataIndex: 'configId',
      width: 140,
      render: (value) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {String(value)}
        </Text>
      ),
    },
    {
      key: 'size',
      title: 'Size',
      dataIndex: 'size',
      width: 120,
      sortable: true,
      render: (value) => {
        const bytes = Number(value);
        if (bytes >= 1024 * 1024) return <Text>{(bytes / (1024 * 1024)).toFixed(1)} MB</Text>;
        if (bytes >= 1024) return <Text>{(bytes / 1024).toFixed(1)} KB</Text>;
        return <Text>{bytes} B</Text>;
      },
    },
    {
      key: 'createdAt',
      title: 'Created',
      dataIndex: 'createdAt',
      width: 140,
      sortable: true,
      render: (value) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(String(value)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'lastAccessedAt',
      title: 'Last Accessed',
      dataIndex: 'lastAccessedAt',
      width: 140,
      sortable: true,
      render: (value) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(String(value)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: 'Actions',
      width: 100,
      render: (_: unknown, record: BuildCacheEntry) => (
        <Popconfirm
          title="Delete this cache entry?"
          onConfirm={() => handleDeleteEntry(record.id)}
          okText="Delete"
          cancelText="Cancel"
        >
          <Button type="link" size="small" danger>
            Delete
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'configs',
      label: `Cache Configs (${configs.length})`,
      children: (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={loadConfigs}
                loading={loadingConfigs}
                size="small"
              >
                Refresh
              </Button>
              <Button icon={<ThunderboltOutlined />} onClick={handleCleanupExpired} size="small">
                Cleanup Expired
              </Button>
            </Space>
          </div>
          <Table
            columns={configColumns}
            dataSource={configs}
            loading={loadingConfigs}
            rowKey="id"
            size="middle"
            striped
          />
        </div>
      ),
    },
    {
      key: 'entries',
      label: `Cache Entries (${entries.length})`,
      children: (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={loadEntries}
                loading={loadingEntries}
                size="small"
              >
                Refresh
              </Button>
              <Button icon={<ThunderboltOutlined />} onClick={handleCleanupExpired} size="small">
                Cleanup Expired
              </Button>
            </Space>
          </div>
          <Table
            columns={entryColumns}
            dataSource={entries}
            loading={loadingEntries}
            rowKey="id"
            size="middle"
            striped
          />
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <DatabaseOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            Build Cache
          </Title>
          <Text type="secondary">Manage cache configurations and cached build artifacts</Text>
        </div>
        <Button type="primary" onClick={openCreateConfigModal}>
          Add Config
        </Button>
      </div>

      <Tabs items={tabItems} defaultActiveKey="configs" />

      <Modal
        title={editingConfig ? 'Edit Cache Config' : 'Add Cache Config'}
        open={configModalOpen}
        onOk={handleSaveConfig}
        onCancel={() => {
          setConfigModalOpen(false);
          setEditingConfig(null);
          form.resetFields();
        }}
        okText={editingConfig ? 'Update' : 'Create'}
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter a name' }]}
          >
            <Input placeholder="e.g. node-modules-cache" />
          </Form.Item>
          <Form.Item
            name="pipeline"
            label="Pipeline"
            rules={[{ required: true, message: 'Please enter a pipeline' }]}
          >
            <Input placeholder="e.g. build-pipeline" />
          </Form.Item>
          <Form.Item
            name="stage"
            label="Stage"
            rules={[{ required: true, message: 'Please enter a stage' }]}
          >
            <Input placeholder="e.g. build" />
          </Form.Item>
          <Form.Item name="strategy" label="Strategy" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="volume">Volume</Select.Option>
              <Select.Option value="s3">S3</Select.Option>
              <Select.Option value="registry">Registry</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="paths"
            label="Paths"
            rules={[{ required: true, message: 'Please enter paths' }]}
          >
            <Select mode="tags" placeholder="Enter cache paths (e.g., node_modules/, .cache/)" />
          </Form.Item>
          <Form.Item
            name="ttlDays"
            label="TTL (days)"
            rules={[{ required: true, message: 'Please enter TTL' }]}
          >
            <Input type="number" min={1} />
          </Form.Item>
          <Form.Item name="enabled" label="Enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BuildCachePage;
