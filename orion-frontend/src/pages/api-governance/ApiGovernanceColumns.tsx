/**
 * ApiGovernanceColumns.tsx - API Governance 表格列配置
 * 抽取自 ApiGovernancePage.tsx (P2-9 Phase 48)
 * 4 组列: contractColumns / ruleColumns / violationColumns / versionColumns
 */
import { Button, Space, Tag, Badge } from 'antd';
import {
  VerifiedOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import type { GovernanceContract } from '@/api/api-governance';
import type { ApiVersionType } from './useApiGovernanceState';

export interface BuildContractColumnsDeps {
  onSelectForVerify: (record: GovernanceContract) => void;
  onEvaluate: (contractId: string) => void;
}

export interface BuildVersionColumnsDeps {
  onDeprecate: (record: ApiVersionType) => void;
  onRetire: (versionId: string) => void;
}

export const buildContractColumns = ({
  onSelectForVerify,
  onEvaluate,
}: BuildContractColumnsDeps): any[] => [
  { title: 'Name', dataIndex: 'name', key: 'name' },
  { title: 'Version', dataIndex: 'version', key: 'version', width: 80 },
  {
    title: 'Spec Type',
    dataIndex: 'spec_type',
    key: 'spec_type',
    render: (type: unknown) => <Tag>{type as string}</Tag>,
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status: unknown) => (
      <Badge
        status={status === 'active' ? 'success' : status === 'draft' ? 'default' : 'error'}
        text={status as string}
      />
    ),
  },
  {
    title: 'Compliance',
    dataIndex: 'compliance_score',
    key: 'compliance_score',
    render: (score: unknown) => {
      const s = score as number;
      return <Tag color={s >= 90 ? 'green' : s >= 70 ? 'orange' : 'red'}>{s}%</Tag>;
    },
  },
  { title: 'Violations', dataIndex: 'violation_count', key: 'violation_count', width: 100 },
  {
    title: 'Updated',
    dataIndex: 'updated_at',
    key: 'updated_at',
    render: (d: unknown) => new Date(d as string).toLocaleString(),
  },
  {
    title: 'Actions',
    key: 'actions',
    render: (_: unknown, record: GovernanceContract) => (
      <Space>
        <Button size="small" icon={<VerifiedOutlined />} onClick={() => onSelectForVerify(record)}>
          Verify
        </Button>
        <Button size="small" onClick={() => onEvaluate(record.id)}>
          Evaluate
        </Button>
      </Space>
    ),
  },
];

export const buildRuleColumns = (): any[] => [
  { title: 'Name', dataIndex: 'name', key: 'name' },
  {
    title: 'Category',
    dataIndex: 'category',
    key: 'category',
    render: (cat: unknown) => <Tag>{cat as string}</Tag>,
  },
  {
    title: 'Severity',
    dataIndex: 'severity',
    key: 'severity',
    render: (sev: unknown) => (
      <Tag color={sev === 'error' ? 'red' : sev === 'warning' ? 'orange' : 'blue'}>
        {sev as string}
      </Tag>
    ),
  },
  {
    title: 'Enabled',
    dataIndex: 'enabled',
    key: 'enabled',
    render: (enabled: unknown) =>
      enabled ? (
        <CheckCircleOutlined style={{ color: colors.success[500] }} />
      ) : (
        <WarningOutlined style={{ color: colors.warning[500] }} />
      ),
  },
  {
    title: 'Created',
    dataIndex: 'created_at',
    key: 'created_at',
    render: (d: unknown) => new Date(d as string).toLocaleString(),
  },
];

export const buildViolationColumns = (): any[] => [
  { title: 'Rule', dataIndex: 'rule_name', key: 'rule_name' },
  {
    title: 'Contract',
    dataIndex: 'contract_id',
    key: 'contract_id',
    width: 100,
    render: (id: unknown) => (id as string).slice(0, 8),
  },
  {
    title: 'Severity',
    dataIndex: 'severity',
    key: 'severity',
    render: (sev: unknown) => (
      <Tag color={sev === 'error' ? 'red' : sev === 'warning' ? 'orange' : 'blue'}>
        {sev as string}
      </Tag>
    ),
  },
  { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: 'Location', dataIndex: 'location', key: 'location', width: 150 },
  {
    title: 'Resolved',
    dataIndex: 'resolved',
    key: 'resolved',
    render: (resolved: unknown) =>
      resolved ? (
        <CheckCircleOutlined style={{ color: colors.success[500] }} />
      ) : (
        <WarningOutlined style={{ color: colors.warning[500] }} />
      ),
  },
  {
    title: 'Created',
    dataIndex: 'created_at',
    key: 'created_at',
    render: (d: unknown) => new Date(d as string).toLocaleString(),
  },
];

export const buildVersionColumns = ({
  onDeprecate,
  onRetire,
}: BuildVersionColumnsDeps): any[] => [
  {
    title: 'Contract',
    dataIndex: 'contract_id',
    key: 'contract_id',
    width: 140,
    render: (id: unknown) => (id as string).slice(0, 12) + '...',
  },
  { title: 'Version', dataIndex: 'version', key: 'version', width: 100 },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (status: unknown) => (
      <Tag color={status === 'active' ? 'green' : status === 'deprecated' ? 'orange' : 'default'}>
        {status as string}
      </Tag>
    ),
  },
  {
    title: 'Created',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 160,
    render: (d: unknown) => new Date(d as string).toLocaleString(),
  },
  {
    title: 'Breaking Changes',
    dataIndex: 'breaking_changes',
    key: 'breaking_changes',
    width: 120,
    render: (v: unknown) => (v ? <Tag color="red">Yes</Tag> : <Tag>No</Tag>),
  },
  {
    title: 'Changelog',
    dataIndex: 'changelog',
    key: 'changelog',
    ellipsis: true,
    render: (v: unknown) => (v as string | null) || '-',
  },
  {
    title: 'Actions',
    key: 'actions',
    width: 160,
    render: (_: unknown, record: ApiVersionType) => (
      <Space>
        {record.status === 'active' && (
          <Button size="small" icon={<StopOutlined />} onClick={() => onDeprecate(record)}>
            Deprecate
          </Button>
        )}
        {record.status === 'deprecated' && (
          <Button size="small" danger onClick={() => onRetire(record.id)}>
            Retire
          </Button>
        )}
      </Space>
    ),
  },
];
