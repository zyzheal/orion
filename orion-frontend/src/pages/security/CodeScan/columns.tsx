/**
 * CodeScan table column builders
 */
import { Button, Space, Tag, Typography } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { CATEGORY_CONFIG, SEVERITY_CONFIG, STATUS_CONFIG } from './constants';
import type { ScanRecord, VulnFinding } from './types';

const { Text } = Typography;

interface ScanColumnDeps {
  scanning: string | null;
  handleScan: (id: string) => void;
}

export function buildScanColumns(deps: ScanColumnDeps): ColumnsType<ScanRecord> {
  const { scanning, handleScan } = deps;
  return [
    {
      title: '扫描目标',
      dataIndex: 'target',
      key: 'target',
      render: (val: string) => <Text strong>{val}</Text>,
    },
    {
      title: '分支',
      dataIndex: 'branch',
      key: 'branch',
      width: 100,
      render: (val: string) => <Text code>{val}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (val: ScanRecord['status']) => (
        <Tag color={STATUS_CONFIG[val].color}>{STATUS_CONFIG[val].label}</Tag>
      ),
    },
    {
      title: '漏洞总数',
      dataIndex: 'totalVulns',
      key: 'totalVulns',
      width: 90,
      render: (val: number) => <Tag color={val > 0 ? 'error' : 'success'}>{val}</Tag>,
    },
    {
      title: 'C/H/M/L',
      key: 'breakdown',
      width: 120,
      render: (_: unknown, record: ScanRecord) => (
        <Space size="small">
          <Tag color="red">{record.critical}</Tag>
          <Tag color="orange">{record.high}</Tag>
          <Tag color="gold">{record.medium}</Tag>
          <Tag color="blue">{record.low}</Tag>
        </Space>
      ),
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 80,
      render: (val: number) => <Text>{val}s</Text>,
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      width: 160,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: ScanRecord) => (
        <Button
          size="small"
          type="primary"
          icon={<PlayCircleOutlined />}
          loading={scanning === record.id}
          disabled={record.status === 'running'}
          onClick={() => handleScan(record.id)}
        >
          重跑
        </Button>
      ),
    },
  ];
}

export function buildVulnColumns(): ColumnsType<VulnFinding> {
  return [
    {
      title: 'OWASP 分类',
      dataIndex: 'category',
      key: 'category',
      width: 140,
      render: (val: VulnFinding['category']) => {
        const cfg = CATEGORY_CONFIG[val];
        return <Tag color="error">{cfg.label} ({cfg.owasp})</Tag>;
      },
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 90,
      render: (val: VulnFinding['severity']) => (
        <Tag color={SEVERITY_CONFIG[val].color}>{SEVERITY_CONFIG[val].label}</Tag>
      ),
    },
    {
      title: '文件位置',
      key: 'location',
      width: 200,
      render: (_: unknown, record: VulnFinding) => (
        <Text code>{record.file}:{record.line}</Text>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '修复建议',
      dataIndex: 'fix',
      key: 'fix',
      ellipsis: true,
    },
  ];
}
