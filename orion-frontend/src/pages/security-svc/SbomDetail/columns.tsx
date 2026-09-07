/**
 * SBOM Detail table column builders
 * 抽取自 index.tsx (P2-9 Phase 154)
 */
import { Button, Tag, Typography } from 'antd';
import type { TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { SbomPackage, SbomVulnResult, SbomVulnDetail } from './types';

dayjs.extend(relativeTime);

const { Text } = Typography;

export const SEVERITY_COLOR_MAP: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'gold',
  low: 'default',
};

export function buildPackageColumns(): TableColumn<SbomPackage>[] {
  return [
    {
      title: '包名',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (value: unknown) => <Text strong>{String(value)}</Text>,
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 100,
      render: (value: unknown) => <Tag color="blue">{String(value)}</Tag>,
    },
    {
      title: '许可证',
      dataIndex: 'license',
      key: 'license',
      width: 120,
      render: (value: unknown) =>
        value ? <Tag>{String(value)}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: 'PURL',
      dataIndex: 'purl',
      key: 'purl',
      width: 250,
      render: (value: unknown) => (
        <Text code ellipsis style={{ maxWidth: 250 }}>
          {value ? String(value) : '-'}
        </Text>
      ),
    },
    {
      title: '供应商',
      dataIndex: 'supplier',
      key: 'supplier',
      width: 150,
      render: (value: unknown) => <Text type="secondary">{value ? String(value) : '-'}</Text>,
    },
  ];
}

interface VulnColumnDeps {
  handleViewVulnDetails: (resultId: string) => void;
}

export function buildVulnColumns(deps: VulnColumnDeps): TableColumn<SbomVulnResult>[] {
  const { handleViewVulnDetails } = deps;
  return [
    {
      title: '扫描器',
      dataIndex: 'scanner',
      key: 'scanner',
      width: 100,
      render: (value: unknown) => <Tag>{String(value)}</Tag>,
    },
    {
      title: '总计',
      dataIndex: 'totalVulns',
      key: 'totalVulns',
      width: 80,
      render: (value: unknown) => <Text>{String(value)}</Text>,
    },
    {
      title: '严重',
      dataIndex: 'criticalCount',
      key: 'criticalCount',
      width: 80,
      render: (value: unknown) => {
        const v = Number(value);
        return v > 0 ? (
          <Text style={{ color: colors.error[600] }}>{String(v)}</Text>
        ) : (
          <Text type="secondary">0</Text>
        );
      },
    },
    {
      title: '高危',
      dataIndex: 'highCount',
      key: 'highCount',
      width: 80,
      render: (value: unknown) => {
        const v = Number(value);
        return v > 0 ? (
          <Text style={{ color: colors.warning[500] }}>{String(v)}</Text>
        ) : (
          <Text type="secondary">0</Text>
        );
      },
    },
    {
      title: '中危',
      dataIndex: 'mediumCount',
      key: 'mediumCount',
      width: 80,
      render: (value: unknown) => <Text>{String(value)}</Text>,
    },
    {
      title: '低危',
      dataIndex: 'lowCount',
      key: 'lowCount',
      width: 80,
      render: (value: unknown) => <Text type="secondary">{String(value)}</Text>,
    },
    {
      title: '门禁',
      dataIndex: 'gatePassed',
      key: 'gatePassed',
      width: 100,
      render: (value: unknown) => (
        <StatusBadge status={value ? 'success' : 'failed'} size="small" />
      ),
    },
    {
      title: '扫描时间',
      dataIndex: 'scannedAt',
      key: 'scannedAt',
      width: 160,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(String(value)).fromNow()}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: SbomVulnResult) => (
        <Button type="link" size="small" onClick={() => handleViewVulnDetails(record.id)}>
          详情
        </Button>
      ),
    },
  ];
}

export function buildVulnDetailColumns(): TableColumn<SbomVulnDetail>[] {
  return [
    {
      title: 'CVE ID',
      dataIndex: 'cveId',
      key: 'cveId',
      width: 160,
      render: (value: unknown) => (
        <Text code style={{ color: colors.primary[500] }}>
          {String(value)}
        </Text>
      ),
    },
    {
      title: '严重级别',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (value: unknown) => (
        <Tag color={SEVERITY_COLOR_MAP[String(value)] || 'default'}>{String(value)}</Tag>
      ),
    },
    {
      title: 'CVSS',
      dataIndex: 'cvssScore',
      key: 'cvssScore',
      width: 80,
      render: (value: unknown) => (value ? String(value) : '-'),
    },
    {
      title: '受影响包',
      dataIndex: 'affectedPackage',
      key: 'affectedPackage',
      width: 180,
      render: (value: unknown) => <Text>{String(value)}</Text>,
    },
    {
      title: '修复版本',
      dataIndex: 'fixedVersion',
      key: 'fixedVersion',
      width: 120,
      render: (value: unknown) =>
        value ? <Tag color="green">{String(value)}</Tag> : <Text type="secondary">无</Text>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (value: unknown) => <Text type="secondary">{value ? String(value) : '-'}</Text>,
    },
  ];
}
