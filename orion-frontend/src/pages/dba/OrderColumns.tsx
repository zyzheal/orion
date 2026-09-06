/**
 * OrderColumns.tsx - buildOrderColumns (含 Popconfirm/审批/执行/查看)
 * 抽取自 DbaPage.tsx (P2-9 Phase 42)
 */
import { Space, Typography, Tag, Button, Popconfirm } from 'antd';
import {
  DatabaseOutlined,
  CheckOutlined,
  CloseOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import type { TableColumn } from '@/components/Table';
import type { SqlOrder } from '@/api/dba';
import { colors } from '@/tokens/colors';
import { sqlTypeColorMap, sqlTypeLabelMap, orderStatusColorMap, orderStatusLabelMap } from './constants';

const { Text } = Typography;

export interface OrderColumnsDeps {
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onExecute: (id: string) => void;
  onView: (id: string) => void;
}

export const buildOrderColumns = ({
  onApprove,
  onReject,
  onExecute,
  onView,
}: OrderColumnsDeps): TableColumn<SqlOrder>[] => [
  {
    key: 'id',
    title: '工单ID',
    dataIndex: 'id',
    width: 120,
    render: (v: unknown) => <Text code>{String(v).slice(0, 8)}</Text>,
  },
  {
    key: 'database',
    title: '数据库',
    dataIndex: 'database',
    width: 140,
    render: (v: unknown) => (
      <Space>
        <DatabaseOutlined style={{ color: colors.primary[500] }} />
        <Text>{String(v)}</Text>
      </Space>
    ),
  },
  {
    key: 'sql',
    title: 'SQL',
    dataIndex: 'sql',
    ellipsis: true,
    render: (v: unknown) => (
      <Text code style={{ fontSize: 12 }}>
        {String(v).slice(0, 60)}
        {String(v).length > 60 ? '...' : ''}
      </Text>
    ),
  },
  {
    key: 'type',
    title: '类型',
    dataIndex: 'type',
    width: 80,
    render: (v: unknown) => (
      <Tag color={sqlTypeColorMap[v as SqlOrder['type']]}>
        {sqlTypeLabelMap[v as SqlOrder['type']]}
      </Tag>
    ),
  },
  {
    key: 'status',
    title: '状态',
    dataIndex: 'status',
    width: 100,
    render: (v: unknown) => (
      <Tag color={orderStatusColorMap[v as SqlOrder['status']]}>
        {orderStatusLabelMap[v as SqlOrder['status']]}
      </Tag>
    ),
  },
  {
    key: 'createdAt',
    title: '创建时间',
    dataIndex: 'createdAt',
    width: 160,
    render: (v: unknown) => <Text type="secondary">{String(v)}</Text>,
  },
  {
    key: 'actions',
    title: '操作',
    width: 200,
    render: (_: unknown, record: SqlOrder) => (
      <Space size="small">
        {record.status === 'pending' && (
          <>
            <Button
              type="link"
              size="small"
              style={{ color: colors.success[500] }}
              icon={<CheckOutlined />}
              onClick={() => onApprove(record.id)}
            >
              审批
            </Button>
            <Popconfirm title="确认拒绝此工单？" onConfirm={() => onReject(record.id)}>
              <Button type="link" size="small" danger icon={<CloseOutlined />}>
                拒绝
              </Button>
            </Popconfirm>
          </>
        )}
        {record.status === 'approved' && (
          <Button
            type="link"
            size="small"
            style={{ color: colors.primary[500] }}
            icon={<PlayCircleOutlined />}
            onClick={() => onExecute(record.id)}
          >
            执行
          </Button>
        )}
        {record.status === 'completed' || record.status === 'failed' ? (
          <Button type="link" size="small" onClick={() => onView(record.id)}>
            查看结果
          </Button>
        ) : null}
      </Space>
    ),
  },
];
