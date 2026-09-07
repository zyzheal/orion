/**
 * TestReport columns
 * 抽取自 index.tsx (P2-9 Phase 191)
 */
import { Space, Tag, Typography } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';
import type { TestReport, TestCase } from '@/api/testReports';
import { statusColor, statusIcon } from './constants';

const { Text } = Typography;

export interface BuildCaseColumnsDeps {
  // reserved for future onRowClick etc.
}

export const buildCaseColumns = (_deps: BuildCaseColumnsDeps = {}) => [
  {
    title: '状态',
    dataIndex: 'status',
    width: 80,
    render: (v: string) => (
      <Tag color={statusColor[v]}>
        {statusIcon[v]} {v}
      </Tag>
    ),
  },
  {
    title: '用例名称',
    dataIndex: 'name',
    render: (v: string, r: TestCase) => (
      <Space direction="vertical" size={0}>
        <Text strong>{v}</Text>
        {r.className && (
          <Text type="secondary" style={{ fontSize: spacing[2] }}>
            {r.className}
          </Text>
        )}
      </Space>
    ),
  },
  {
    title: '耗时',
    dataIndex: 'duration',
    width: 100,
    render: (v: number) => `${(v / 1000).toFixed(2)}s`,
  },
  {
    title: '失败信息',
    dataIndex: 'failureMessage',
    render: (v: string) => (v ? <Text type="danger">{v}</Text> : '-'),
  },
];

export interface BuildReportColumnsDeps {
  onSelectReport: (r: TestReport) => void;
}

export const buildReportColumns = (deps: BuildReportColumnsDeps) => [
  {
    title: '报告名称',
    dataIndex: 'suiteName',
    render: (v: string, r: TestReport) => (
      <Space direction="vertical" size={0}>
        <Text
          strong
          style={{ cursor: 'pointer', color: colors.primary[500] }}
          onClick={() => deps.onSelectReport(r)}
        >
          <FileTextOutlined /> {v}
        </Text>
        <Text type="secondary" style={{ fontSize: spacing[2] }}>
          {r.format.toUpperCase()} · {dayjs(r.createdAt).format('YYYY-MM-DD HH:mm:ss')}
        </Text>
      </Space>
    ),
  },
  {
    title: '总计',
    dataIndex: 'totalTests',
    width: 80,
    align: 'center' as const,
  },
  {
    title: '通过',
    dataIndex: 'passedTests',
    width: 80,
    align: 'center' as const,
    render: (v: number) => <Tag color="green">{v}</Tag>,
  },
  {
    title: '失败',
    dataIndex: 'failedTests',
    width: 80,
    align: 'center' as const,
    render: (v: number) => (v > 0 ? <Tag color="red">{v}</Tag> : <Tag color="green">0</Tag>),
  },
  {
    title: '跳过',
    dataIndex: 'skippedTests',
    width: 80,
    align: 'center' as const,
    render: (v: number) => (v > 0 ? <Tag color="orange">{v}</Tag> : <Tag>0</Tag>),
  },
  {
    title: '耗时',
    dataIndex: 'duration',
    width: 100,
    render: (v: number) => `${(v / 1000).toFixed(1)}s`,
  },
];
