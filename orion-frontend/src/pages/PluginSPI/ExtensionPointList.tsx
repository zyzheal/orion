/**
 * ExtensionPointList Component
 * Extension point table with columns, filtering, and search
 */
import React, { useMemo } from 'react';
import { Typography, Space, Tag } from 'antd';
const { Text } = Typography;
import { ApiOutlined, LinkOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { colors } from '@/tokens';
import {
  type SPIExtensionPoint,
  statusColorMap,
  statusLabelMap,
  spiTypeLabelMap,
} from './types';
import dayjs from 'dayjs';

// ============================================================================
// Props
// ============================================================================

interface ExtensionPointListProps {
  extensionPoints: SPIExtensionPoint[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: Record<string, string | string[] | undefined>;
  onFilterChange: (filters: Record<string, string | string[] | undefined>) => void;
}

// ============================================================================
// Component
// ============================================================================

const ExtensionPointList: React.FC<ExtensionPointListProps> = ({
  extensionPoints,
  loading,
  searchQuery,
  onSearchChange,
  filters,
  onFilterChange,
}) => {
  // Filtered extension points
  const filteredExtensionPoints = useMemo(() => {
    return extensionPoints.filter((ep) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !ep.name.toLowerCase().includes(q) &&
          !ep.description.toLowerCase().includes(q) &&
          !ep.interfaceName.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (filters.spiType && filters.spiType !== 'all' && ep.spiType !== filters.spiType) return false;
      if (filters.status && filters.status !== 'all' && ep.status !== filters.status) return false;
      return true;
    });
  }, [searchQuery, filters, extensionPoints]);

  // Filter definitions
  const filterDefs: FilterDefinition[] = [
    {
      key: 'spiType',
      label: 'SPI 类型',
      options: [
        { label: '全部', value: 'all' },
        ...Object.entries(spiTypeLabelMap).map(([k, v]) => ({ label: v, value: k })),
      ],
    },
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '全部', value: 'all' },
        { label: '活跃', value: 'active' },
        { label: '未激活', value: 'inactive' },
        { label: '已废弃', value: 'deprecated' },
        { label: '实验性', value: 'experimental' },
      ],
    },
  ];

  // Table columns
  const columns: TableColumn<SPIExtensionPoint>[] = [
    {
      key: 'name',
      title: '扩展点',
      dataIndex: 'name',
      width: 200,
      sortable: true,
      render: (value: unknown, record: SPIExtensionPoint) => (
        <Space direction="vertical" size={0}>
          <Text strong>
            <ApiOutlined style={{ marginRight: 4, color: colors.primary[500] }} />
            {String(value)}
          </Text>
          <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>
            {record.interfaceName}
          </Text>
        </Space>
      ),
    },
    {
      key: 'description',
      title: '描述',
      width: 250,
      render: (_: unknown, record: SPIExtensionPoint) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {record.description}
        </Text>
      ),
    },
    {
      key: 'spiType',
      title: 'SPI 类型',
      width: 120,
      render: (_: unknown, record: SPIExtensionPoint) => (
        <Tag color="purple">
          {spiTypeLabelMap[record.spiType] || record.spiType}
        </Tag>
      ),
    },
    {
      key: 'registeredPlugins',
      title: '已注册插件',
      dataIndex: 'registeredPlugins',
      width: 110,
      sortable: true,
      render: (value: unknown) => (
        <Tag icon={<LinkOutlined />}>{String(value)} 个</Tag>
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: 100,
      render: (_: unknown, record: SPIExtensionPoint) => (
        <Tag color={statusColorMap[record.status]}>{statusLabelMap[record.status]}</Tag>
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
      key: 'lastUpdated',
      title: '最后更新',
      dataIndex: 'lastUpdated',
      width: 140,
      sortable: true,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(String(value)).fromNow()}
        </Text>
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
          searchPlaceholder="搜索扩展点名称、描述或接口..."
        />
      </div>
      <Table
        columns={columns}
        dataSource={filteredExtensionPoints}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
      />
    </>
  );
};

export default ExtensionPointList;
