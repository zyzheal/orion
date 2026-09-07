/**
 * DataQualityFix table column builders
 * 抽取自 index.tsx (P2-9 Phase 146)
 */
import { Button, Space, Tag, Tooltip, Typography } from 'antd';
import { CloseCircleOutlined, EyeOutlined, PlayCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { PROBLEM_TYPE_CONFIG, SEVERITY_CONFIG, STATUS_CONFIG } from './constants';
import type { QualityIssue } from './types';

const { Text } = Typography;

export function buildIssueColumns(): ColumnsType<QualityIssue> {
  return [
    {
      title: '问题 ID',
      dataIndex: 'id',
      key: 'id',
      width: 90,
      render: (val: string) => <Text strong>{val}</Text>,
    },
    {
      title: '数据表/字段',
      dataIndex: 'tableField',
      key: 'tableField',
      width: 160,
      render: (val: string) => <code>{val}</code>,
    },
    {
      title: '问题类型',
      dataIndex: 'problemType',
      key: 'problemType',
      width: 90,
      render: (val: import('./types').ProblemType) => <Tag color={PROBLEM_TYPE_CONFIG[val].color}>{PROBLEM_TYPE_CONFIG[val].label}</Tag>,
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 90,
      render: (val: import('./types').Severity) => <Tag color={SEVERITY_CONFIG[val].color}>{SEVERITY_CONFIG[val].label}</Tag>,
    },
    {
      title: '影响行数',
      dataIndex: 'affectedRows',
      key: 'affectedRows',
      width: 90,
      render: (val: number) => <Text>{val.toLocaleString()}</Text>,
    },
    {
      title: '发现时间',
      dataIndex: 'discoveredAt',
      key: 'discoveredAt',
      width: 150,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (val: import('./types').Status) => <Tag color={STATUS_CONFIG[val].color}>{STATUS_CONFIG[val].label}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, record?: QualityIssue) =>
        record ? (
          <Space size="small">
            <Tooltip title="修复建议功能开发中">
              <Button type="link" size="small" icon={<EyeOutlined />} disabled>
                查看建议
              </Button>
            </Tooltip>
            <Tooltip title="自动修复功能开发中">
              <Button type="link" size="small" danger icon={<PlayCircleOutlined />} disabled>
                执行修复
              </Button>
            </Tooltip>
            <Tooltip title="忽略功能开发中">
              <Button type="link" size="small" icon={<CloseCircleOutlined />} disabled>
                忽略
              </Button>
            </Tooltip>
          </Space>
        ) : null,
    },
  ];
}

export function buildRepairHistoryColumns(): ColumnsType<import('./types').RepairHistory> {
  return [
    { title: '时间', dataIndex: 'time', key: 'time', width: 180 },
    { title: '问题', dataIndex: 'issue', key: 'issue' },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 100 },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      width: 100,
      render: (val: string) => (val === 'success' ? <Tag color="success">成功</Tag> : <Tag color="error">失败</Tag>),
    },
  ];
}
