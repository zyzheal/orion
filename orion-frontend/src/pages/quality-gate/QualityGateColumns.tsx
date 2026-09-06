/**
 * QualityGateColumns.tsx - 质量门禁表格列定义
 * 抽取自 quality-gate/QualityGatePage.tsx (P2-9 Phase 77)
 */
import { Typography, Button, Tag } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  severityColorMap,
  severityLabelMap,
  violationStatusColorMap,
  violationStatusLabelMap,
  categoryColorMap,
} from './constants';
import type { PolicyDefinition, PolicyViolation } from '@/api/policies';

const { Text } = Typography;

interface UsePolicyColumnsParams {
  openPolicyDetail: (p: PolicyDefinition) => void;
}

export const makePolicyColumns = ({
  openPolicyDetail,
}: UsePolicyColumnsParams): ColumnsType<PolicyDefinition> => [
  {
    title: '策略名称',
    dataIndex: 'name',
    key: 'name',
    width: 200,
    render: (v: string, record) => (
      <Text strong style={{ cursor: 'pointer' }} onClick={() => openPolicyDetail(record)}>
        {v}
      </Text>
    ),
  },
  {
    title: '分类',
    dataIndex: 'category',
    key: 'category',
    width: 100,
    render: (v: string) => <Tag color={categoryColorMap[v] || 'default'}>{v}</Tag>,
  },
  {
    title: '严重级别',
    dataIndex: 'severity',
    key: 'severity',
    width: 100,
    render: (v: string) => (
      <Tag color={severityColorMap[v] || 'default'}>{severityLabelMap[v] || v}</Tag>
    ),
  },
  {
    title: '状态',
    dataIndex: 'enabled',
    key: 'enabled',
    width: 80,
    render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '启用' : '禁用'}</Tag>,
  },
  {
    title: 'Rego 路径',
    dataIndex: 'regoPath',
    key: 'regoPath',
    ellipsis: true,
    render: (v: string) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {v}
      </Text>
    ),
  },
  {
    title: '更新时间',
    dataIndex: 'updatedAt',
    key: 'updatedAt',
    width: 160,
    render: (v: string) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {dayjs(v).format('YYYY-MM-DD HH:mm')}
      </Text>
    ),
  },
];

interface UseViolationColumnsParams {
  openWaiveModal: (v: PolicyViolation) => void;
}

export const makeViolationColumns = ({
  openWaiveModal,
}: UseViolationColumnsParams): ColumnsType<PolicyViolation> => [
  {
    title: '策略',
    dataIndex: 'policyName',
    key: 'policyName',
    width: 160,
    render: (v: string) => <Text>{v || '-'}</Text>,
  },
  {
    title: '严重级别',
    dataIndex: 'severity',
    key: 'severity',
    width: 100,
    render: (v: string) => (
      <Tag color={severityColorMap[v] || 'default'}>{severityLabelMap[v] || v}</Tag>
    ),
  },
  {
    title: '消息',
    dataIndex: 'message',
    key: 'message',
    ellipsis: true,
  },
  {
    title: '资源',
    dataIndex: 'resourceId',
    key: 'resourceId',
    width: 160,
    render: (v: string) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {v || '-'}
      </Text>
    ),
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (v: string) => (
      <Tag color={violationStatusColorMap[v] || 'default'}>{violationStatusLabelMap[v] || v}</Tag>
    ),
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 160,
    render: (v: string) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {dayjs(v).format('YYYY-MM-DD HH:mm')}
      </Text>
    ),
  },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    render: (_, record) =>
      record.status === 'open' ? (
        <Button
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => openWaiveModal(record)}
        >
          申请豁免
        </Button>
      ) : null,
  },
];
