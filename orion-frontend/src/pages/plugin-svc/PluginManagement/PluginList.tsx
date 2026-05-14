/**
 * PluginList Component
 * Plugin table with columns, filtering, and summary metrics
 */
import React, { useMemo } from 'react';
import { Typography, Button, Space, Tag, Badge, Modal, message } from 'antd';
import {
  SettingOutlined,
  CloudDownloadOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  AppstoreOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import MetricCard from '@/components/MetricCard';
import { colors, spacing } from '@/tokens';
import {
  activatePlugin,
  deactivatePlugin,
  uninstallPlugin,
  type PluginHealthStatus,
} from '@/api/plugins';
import {
  type ApiPlugin,
  categoryLabels,
  healthStatusLabels,
  mapPluginTypeToCategory,
} from './types';
import { healthConfig } from './constants';
import dayjs from 'dayjs';

const { Text } = Typography;

// ============================================================================
// Props
// ============================================================================

interface PluginListProps {
  plugins: ApiPlugin[];
  loading: boolean;
  onRefresh: () => void;
  onConfigure: (plugin: ApiPlugin) => void;
  onExecuteTask: (plugin: ApiPlugin) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: Record<string, string | string[] | undefined>;
  onFilterChange: (filters: Record<string, string | string[] | undefined>) => void;
}

// ============================================================================
// Component
// ============================================================================

const PluginList: React.FC<PluginListProps> = ({
  plugins,
  loading,
  onRefresh,
  onConfigure,
  onExecuteTask,
  searchQuery,
  onSearchChange,
  filters,
  onFilterChange,
}) => {
  // Summary metrics
  const totalCount = plugins.length;
  const enabledCount = plugins.filter((p) => p.state === 'ACTIVE').length;
  const disabledCount = plugins.filter((p) => p.state !== 'ACTIVE').length;
  const updatesAvailableCount = plugins.filter((p) => p.latestVersion).length;

  // Filter plugins
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
        ]
          .join(' ')
          .toLowerCase();
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
        const pluginStatus = plugin.state === 'ACTIVE' ? 'enabled' : 'disabled';
        if (pluginStatus !== statusFilter) return false;
      }

      return true;
    });
  }, [searchQuery, filters, plugins]);

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
          onRefresh();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : `${action}失败`;
          message.error(`${action}失败：${msg}`);
        }
      },
    });
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
          const { installPlugin } = await import('@/api/plugins');
          await installPlugin(plugin.id, { version: plugin.latestVersion });
          message.success(`插件 ${plugin.name} 更新成功`);
          onRefresh();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '更新失败';
          message.error(`更新失败：${msg}`);
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
          onRefresh();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '删除失败';
          message.error(`删除失败：${msg}`);
        }
      },
    });
  };

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

  // Table columns
  const columns: TableColumn<ApiPlugin>[] = [
    {
      key: 'name',
      title: '插件名称',
      dataIndex: 'name',
      width: 200,
      sortable: true,
      render: (value: unknown) => (
        <Space>
          <AppstoreOutlined style={{ color: colors.primary[500] }} />
          <Text strong>{String(value)}</Text>
        </Space>
      ),
    },
    {
      key: 'version',
      title: '版本',
      dataIndex: 'version',
      width: 140,
      sortable: true,
      render: (value: unknown, record: ApiPlugin) => (
        <Space>
          <Tag>v{String(value)}</Tag>
          {record.latestVersion && (
            <Badge count="新" style={{ backgroundColor: colors.primary[500] }} />
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
          <Badge status={isActive ? 'success' : 'default'} text={isActive ? '已启用' : '已禁用'} />
        );
      },
    },
    {
      key: 'category',
      title: '分类',
      dataIndex: 'category',
      width: 100,
      render: (value: unknown, record: ApiPlugin) => {
        const category = (value as string) || mapPluginTypeToCategory(record.type);
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
      sortable: true,
      render: (value: unknown) => (
        <Space>
          <ClockCircleOutlined style={{ color: colors.neutral[500] }} />
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
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
            <Text style={{ color: config.color, fontSize: spacing[3] }}>
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
      render: (_: unknown, record: ApiPlugin) => (
        <Space size="small" wrap>
          <Button
            type="link"
            size="small"
            onClick={() => handleToggleStatus(record)}
            data-testid={`toggle-plugin-${record.id}`}
          >
            {record.state === 'ACTIVE' ? '禁用' : '启用'}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<SettingOutlined />}
            onClick={() => onConfigure(record)}
            data-testid={`configure-plugin-${record.id}`}
          >
            配置
          </Button>
          <Button
            type="link"
            size="small"
            icon={<CloudDownloadOutlined />}
            onClick={() => onExecuteTask(record)}
            data-testid={`execute-plugin-${record.id}`}
          >
            执行
          </Button>
          {record.latestVersion && (
            <Button
              type="link"
              size="small"
              icon={<CloudDownloadOutlined />}
              onClick={() => handleUpdate(record)}
              data-testid={`update-plugin-${record.id}`}
            >
              更新
            </Button>
          )}
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            data-testid={`delete-plugin-${record.id}`}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div data-testid="plugin-management-page">
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
          color={colors.primary[500]}
          footer="已安装的全部插件"
        />
        <MetricCard
          title="已启用"
          value={enabledCount}
          icon={<CheckCircleOutlined />}
          color={colors.success[500]}
          footer="当前运行中的插件"
        />
        <MetricCard
          title="已禁用"
          value={disabledCount}
          icon={<CloseCircleOutlined />}
          color={colors.neutral[500]}
          footer="已停止的插件"
        />
        <MetricCard
          title="可更新"
          value={updatesAvailableCount}
          icon={<CloudDownloadOutlined />}
          color={colors.purple[500]}
          footer="有新版本可用的插件"
        />
      </div>

      {/* Search and filter bar */}
      <div style={{ marginBottom: 16 }}>
        <SearchFilterBar
          onSearch={onSearchChange}
          onFilter={onFilterChange}
          filters={filterDefs}
          searchPlaceholder="搜索插件名称、描述、作者..."
        />
      </div>

      {/* Plugin table */}
      <Table
        columns={columns}
        dataSource={filteredPlugins}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
        data-testid="plugin-table"
      />
    </div>
  );
};

export default PluginList;
