/**
 * Multi-Cloud Advanced Page - Column Definitions
 * 多云进阶管理 - Table 列定义抽取
 *
 * 从 MultiCloudAdvancedPage.tsx 拆分而来。
 * 使用工厂函数模式，未来可扩展接收 handler 参数而不破坏现有调用。
 */

import type { ColumnsType } from 'antd/es/table';
import { Tag, Space, Typography, Badge as AntBadge } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import type { ComplianceCheckResult } from '@/api/multi-cloud';
import {
  PROVIDER_TAG_COLOR_MAP,
  SEVERITY_COLOR_MAP,
  SEVERITY_ICON_FACTORIES,
  CATEGORY_LABEL_MAP,
} from './MultiCloudAdvancedConfig';

const { Text } = Typography;

/**
 * 云账号列工厂
 *
 * 目前无 handler 依赖，保留 factory 签名以便未来扩展
 * （例如后续加入 "删除 / 查看凭证" 等操作列）。
 */
export const buildAccountColumns = (
  _handlers?: { onDelete?: (id: string) => void },
): ColumnsType<any> => [
  {
    title: 'Name',
    dataIndex: 'account_name',
    key: 'account_name',
    render: (v: string, r: any) => v || r.name || '-',
  },
  {
    title: 'Provider',
    key: 'provider',
    render: (_: unknown, r: any) => {
      const p = r.provider_id || r.credential_type || r.provider || 'unknown';
      return <Tag color={PROVIDER_TAG_COLOR_MAP[p] || 'default'}>{p.toUpperCase()}</Tag>;
    },
  },
  { title: 'Region', dataIndex: 'region', key: 'region' },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status: string) => (
      <AntBadge
        status={status === 'active' ? 'success' : status === 'error' ? 'error' : 'default'}
        text={status}
      />
    ),
  },
  {
    title: 'Created',
    dataIndex: 'created_at',
    key: 'created_at',
    render: (d: string) => (d ? new Date(d).toLocaleString() : '-'),
  },
];

/** 云资源列工厂 */
export const buildResourceColumns = (
  _handlers?: { onDelete?: (id: string) => void },
): ColumnsType<any> => [
  {
    title: 'Name',
    dataIndex: 'resource_name',
    key: 'resource_name',
    render: (v: string, r: any) => v || r.name || '-',
  },
  {
    title: 'Type',
    dataIndex: 'resource_type',
    key: 'resource_type',
    render: (t: string) => <Tag color="blue">{t}</Tag>,
  },
  { title: 'Region', dataIndex: 'region', key: 'region' },
  {
    title: 'Status',
    dataIndex: 'state',
    key: 'state',
    render: (s: string) => (
      <Tag color={s === 'running' || s === 'active' ? 'green' : 'default'}>{s}</Tag>
    ),
  },
  {
    title: 'Tags',
    dataIndex: 'tags',
    key: 'tags',
    render: (tags: Record<string, string>) =>
      tags
        ? Object.entries(tags)
            .slice(0, 3)
            .map(([k, v]) => (
              <Tag key={String(k)}>
                {k}={v}
              </Tag>
            ))
        : '-',
  },
];

/** 合规检查结果列工厂 */
export const buildComplianceColumns = (
  _handlers?: { onRemediate?: (ruleId: string) => void },
): ColumnsType<ComplianceCheckResult> => [
  {
    title: '状态',
    key: 'status',
    width: 60,
    render: (_: unknown, record: ComplianceCheckResult) =>
      record.passed ? (
        <CheckCircleOutlined style={{ color: colors.success[500], fontSize: 18 }} />
      ) : (
        <CloseCircleOutlined style={{ color: colors.error[500], fontSize: 18 }} />
      ),
  },
  {
    title: '规则',
    dataIndex: 'ruleName',
    key: 'ruleName',
    render: (v: string, record: ComplianceCheckResult) => (
      <div>
        <Text strong>{v}</Text>
        <br />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {record.ruleId}
        </Text>
      </div>
    ),
  },
  {
    title: '类别',
    dataIndex: 'category',
    key: 'category',
    width: 80,
    render: (v: string) => <Tag>{CATEGORY_LABEL_MAP[v] || v}</Tag>,
  },
  {
    title: '严重程度',
    dataIndex: 'severity',
    key: 'severity',
    width: 100,
    render: (v: string) => {
      const iconFactory = SEVERITY_ICON_FACTORIES[v];
      return (
        <Space>
          {iconFactory ? iconFactory() : null}
          <Tag color={SEVERITY_COLOR_MAP[v]}>{v}</Tag>
        </Space>
      );
    },
  },
  {
    title: '详情',
    dataIndex: 'details',
    key: 'details',
    ellipsis: true,
  },
  {
    title: '修复建议',
    dataIndex: 'remediation',
    key: 'remediation',
    ellipsis: true,
    render: (v: string) => v || '-',
  },
];

/** 调度决策备选方案列（原内联，现抽取） */
export const buildScheduleAlternativeColumns = (): ColumnsType<any> => [
  {
    title: '厂商',
    dataIndex: 'provider',
    render: (v: string) => <Tag>{v.toUpperCase()}</Tag>,
  },
  { title: '区域', dataIndex: 'region' },
  {
    title: '预估费用',
    dataIndex: 'cost',
    render: (v: number) => `$${v.toFixed(2)}`,
  },
];
