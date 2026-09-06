/**
 * 多云管理页面 - 表格列定义
 *
 * 从 MultiCloudPage.tsx 中提取：
 * - makeAccountColumns  云账号列表列（依赖 handlers / syncing 状态，采用工厂函数模式）
 * - resourceColumns     云资源列表列（无状态依赖，静态导出）
 * - costColumns         跨云成本对比表格列（静态导出）
 */
import type { ColumnsType } from 'antd/es/table';
import { Button, Space, Tag, Badge, Tooltip, Typography } from 'antd';
import {
  SyncOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { CloudAccount, CloudResource, CostComparison } from '@/api/multi-cloud';
import { colors } from '@/tokens';
import {
  providerTypeColor,
  providerLabelMap,
  statusColorMap,
  statusLabelMap,
  resourceTypeColors,
  resourceStateBadgeMap,
} from './MultiCloudConfig';

const { Text } = Typography;

// ============================================================================
// 云账号列表列 (依赖 handlers / 状态，使用工厂函数模式)
// ============================================================================

export interface AccountColumnsDeps {
  /** 资源列表，用于统计每个账号下的资源数 */
  resources: CloudResource[];
  /** 当前正在同步的账号 ID (null 表示空闲) */
  syncing: string | null;
  handleSync: (accountId: string) => void;
  handleEdit: (record: CloudAccount) => void;
  handleDelete: (record: CloudAccount) => void;
}

/**
 * 创建云账号表格列
 */
export const makeAccountColumns = ({
  resources,
  syncing,
  handleSync,
  handleEdit,
  handleDelete,
}: AccountColumnsDeps): ColumnsType<CloudAccount> => [
  {
    title: '账号名称',
    dataIndex: 'account_name',
    key: 'account_name',
    width: 160,
    render: (v: string, record: CloudAccount) => v || record.account_name || '-',
  },
  {
    title: '云厂商',
    key: 'provider',
    width: 120,
    render: (_: unknown, record: CloudAccount) => {
      const provider = record.provider_id || record.credential_type || 'unknown';
      return (
        <Tag color={providerTypeColor[provider] || 'default'}>
          {providerLabelMap[provider] || provider}
        </Tag>
      );
    },
  },
  { title: '区域', dataIndex: 'region', key: 'region', width: 120 },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (v: string) => (
      <Tag color={statusColorMap[v] || 'default'}>{statusLabelMap[v] || v}</Tag>
    ),
  },
  {
    title: '资源数',
    key: 'resourceCount',
    width: 80,
    render: (_: unknown, record: CloudAccount) => {
      const accountId = record.account_id;
      return resources.filter((r) => r.account_id === accountId || r.account_id === accountId)
        .length;
    },
  },
  {
    title: '月度费用',
    key: 'cost',
    width: 100,
    render: (_: unknown, record: CloudAccount) => {
      const cost = record.current_spend ?? 0;
      return cost > 0 ? `$${cost.toFixed(2)}` : '-';
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 160,
    render: (_: unknown, record: CloudAccount) => (
      <Space>
        <Tooltip title="同步资源">
          <Button
            type="link"
            size="small"
            icon={<SyncOutlined spin={syncing === record.account_id} />}
            onClick={() => handleSync(record.account_id)}
            disabled={syncing !== null}
          />
        </Tooltip>
        <Tooltip title="编辑">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
        </Tooltip>
        <Tooltip title="删除">
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          />
        </Tooltip>
      </Space>
    ),
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 160,
    render: (v: string) => (v ? new Date(v).toLocaleString('zh-CN') : '-'),
  },
];

// ============================================================================
// 云资源列表列 (无状态依赖)
// ============================================================================

export const resourceColumns: ColumnsType<CloudResource> = [
  {
    title: '名称',
    dataIndex: 'resource_name',
    key: 'resource_name',
    width: 160,
    render: (v: string, r: CloudResource) => v || r.resource_name || '-',
  },
  {
    title: '类型',
    dataIndex: 'resource_type',
    key: 'resource_type',
    width: 120,
    render: (v: string) => <Tag color={resourceTypeColors[v] || 'default'}>{v}</Tag>,
  },
  { title: '区域', dataIndex: 'region', key: 'region', width: 120 },
  {
    title: '状态',
    dataIndex: 'state',
    key: 'state',
    width: 100,
    render: (v: string) => (
      <Badge status={resourceStateBadgeMap[v] || 'warning'} text={v} />
    ),
  },
  {
    title: '月度费用',
    dataIndex: 'monthly_cost',
    key: 'monthly_cost',
    width: 100,
    render: (v: number) => (v > 0 ? `$${v.toFixed(2)}` : '-'),
  },
  {
    title: '标签',
    key: 'tags',
    width: 160,
    render: (_: unknown, record: CloudResource) =>
      record.tags
        ? Object.entries(record.tags)
            .slice(0, 2)
            .map(([k, v]) => (
              <Tag key={String(k)}>
                {k}: {v}
              </Tag>
            ))
        : '-',
  },
];

// ============================================================================
// 跨云成本对比表格列
// ============================================================================

export const costColumns: ColumnsType<CostComparison> = [
  {
    title: '云厂商',
    dataIndex: 'provider',
    render: (v: string) => (
      <Tag color={providerTypeColor[v]}>{providerLabelMap[v] || v}</Tag>
    ),
  },
  {
    title: '计算费用',
    dataIndex: ['breakdown', 'compute'],
    render: (v: number) => `$${v?.toFixed(2) ?? 0}`,
  },
  {
    title: '存储费用',
    dataIndex: ['breakdown', 'storage'],
    render: (v: number) => `$${v?.toFixed(2) ?? 0}`,
  },
  {
    title: '带宽费用',
    dataIndex: ['breakdown', 'bandwidth'],
    render: (v: number) => `$${v?.toFixed(2) ?? 0}`,
  },
  {
    title: '月度总费用',
    dataIndex: 'estimatedMonthlyCost',
    render: (v: number) => (
      <Text strong style={{ color: colors.primary[500] }}>
        ${v?.toFixed(2)}
      </Text>
    ),
  },
];
