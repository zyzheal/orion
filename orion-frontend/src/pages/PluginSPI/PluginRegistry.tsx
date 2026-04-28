/**
 * PluginRegistry Component
 * Plugin registration table with toggle enable/disable functionality
 */
import React, { useMemo } from 'react';
import { Typography, Space, Tag, Badge, Button, Tooltip } from 'antd';
import { BlockOutlined, CheckCircleOutlined, SafetyOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { colors } from '@/tokens';
import { type PluginRegistration, pluginStatusColorMap, pluginStatusLabelMap } from './types';
import dayjs from 'dayjs';

const { Text } = Typography;

// ============================================================================
// Props
// ============================================================================

interface PluginRegistryProps {
  pluginRegistrations: PluginRegistration[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: Record<string, string | string[] | undefined>;
  onFilterChange: (filters: Record<string, string | string[] | undefined>) => void;
  onTogglePlugin: (record: PluginRegistration) => void;
}

// ============================================================================
// Component
// ============================================================================

const PluginRegistry: React.FC<PluginRegistryProps> = ({
  pluginRegistrations,
  loading,
  searchQuery,
  onSearchChange,
  filters,
  onFilterChange,
  onTogglePlugin,
}) => {
  // Filtered plugin registrations
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

  // Filter definitions
  const filterDefs: FilterDefinition[] = [
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

  // Table columns
  const columns: TableColumn<PluginRegistration>[] = [
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
        <Text code style={{ fontSize: 12 }}>
          {String(value)}
        </Text>
      ),
    },
    {
      key: 'provider',
      title: '提供者',
      dataIndex: 'provider',
      width: 160,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {String(value)}
        </Text>
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
        <Tag color={pluginStatusColorMap[record.status]}>{pluginStatusLabelMap[record.status]}</Tag>
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
              icon={record.status === 'enabled' ? <BlockOutlined /> : <CheckCircleOutlined />}
              onClick={() => onTogglePlugin(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <SearchFilterBar
          onSearch={onSearchChange}
          onFilter={onFilterChange}
          filters={filterDefs}
          searchPlaceholder="搜索插件名称或扩展点..."
        />
      </div>
      <Table
        columns={columns}
        dataSource={filteredPlugins}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
      />
    </>
  );
};

export default PluginRegistry;
