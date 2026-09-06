/**
 * CI 类型设计器 列定义
 * 抽取自 index.tsx (P2-9 Phase 106)
 */
import { Button, Space, Tag, Typography, Popconfirm } from 'antd';
const { Text } = Typography;
import {
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { CIType, CIAttribute, CITypeVersion } from '@/api/ci-types';
import { colors } from '@/tokens';
import { STATUS_COLORS } from './constants';

interface TypeColumnDeps {
  handleViewDetail: (record: CIType) => void;
  handleEdit: (record: CIType) => void;
  handleDelete: (id: string) => void;
}

export const buildCITypeColumns = (
  deps: TypeColumnDeps
): ColumnsType<CIType> => [
  {
    title: '名称',
    dataIndex: 'name',
    key: 'name',
    width: '15%',
    render: (text: string) => <Text strong>{text}</Text>,
  },
  {
    title: '显示名称',
    dataIndex: 'displayName',
    key: 'displayName',
    width: '15%',
    render: (val: string | null) => val || '-',
  },
  {
    title: '分类',
    dataIndex: 'category',
    key: 'category',
    width: '12%',
    render: (val: string | null) => (val ? <Tag>{val}</Tag> : '-'),
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: '10%',
    render: (status: string) => <Tag color={STATUS_COLORS[status] || 'default'}>{status}</Tag>,
  },
  {
    title: '版本',
    dataIndex: 'version',
    key: 'version',
    width: '8%',
  },
  {
    title: '启用',
    dataIndex: 'enabled',
    key: 'enabled',
    width: '8%',
    render: (enabled: boolean) =>
      enabled ? <Tag color="green">是</Tag> : <Tag color="default">否</Tag>,
  },
  {
    title: '更新时间',
    dataIndex: 'updatedAt',
    key: 'updatedAt',
    width: '16%',
    render: (val: string) => (val ? new Date(val).toLocaleString('zh-CN') : '-'),
  },
  {
    title: '操作',
    key: 'action',
    width: '16%',
    render: (_: unknown, record: CIType) => (
      <Space size="small">
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => deps.handleViewDetail(record)}
        >
          详情
        </Button>
        <Button
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => deps.handleEdit(record)}
        >
          编辑
        </Button>
        <Popconfirm
          title="确认删除此 CI 类型?"
          onConfirm={() => deps.handleDelete(record.id)}
          okText="确认"
          cancelText="取消"
        >
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      </Space>
    ),
  },
];

export const buildAttributeColumns = (): ColumnsType<CIAttribute> => [
  { title: '属性键', dataIndex: 'attrKey', key: 'attrKey', width: '18%' },
  { title: '名称', dataIndex: 'name', key: 'name', width: '18%' },
  {
    title: '类型',
    dataIndex: 'attrType',
    key: 'attrType',
    width: '12%',
    render: (val: string) => <Tag>{val}</Tag>,
  },
  {
    title: '必填',
    dataIndex: 'required',
    key: 'required',
    width: '8%',
    render: (val: boolean) =>
      val ? <CheckCircleOutlined style={{ color: colors.error[500] }} /> : '-',
  },
  {
    title: '默认值',
    dataIndex: 'defaultValue',
    key: 'defaultValue',
    width: '12%',
    render: (val: string | null) => val || '-',
  },
  { title: '排序', dataIndex: 'sortOrder', key: 'sortOrder', width: '8%' },
];

interface VersionColumnDeps {
  handleRollback: (versionId: string) => void;
}

export const buildVersionColumns = (
  deps: VersionColumnDeps
): ColumnsType<CITypeVersion> => [
  { title: '版本号', dataIndex: 'version', key: 'version', width: '20%' },
  {
    title: '变更摘要',
    dataIndex: 'changeSummary',
    key: 'changeSummary',
    width: '40%',
    render: (val: string | null) => val || '-',
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: '25%',
    render: (val: string) => (val ? new Date(val).toLocaleString('zh-CN') : '-'),
  },
  {
    title: '操作',
    key: 'action',
    width: '15%',
    render: (_: unknown, record: CITypeVersion) => (
      <Popconfirm
        title="确认回滚到此版本?此操作将覆盖当前属性配置"
        onConfirm={() => deps.handleRollback(record.id)}
        okText="确认回滚"
        cancelText="取消"
      >
        <Button type="link" size="small" icon={<HistoryOutlined />}>
          回滚
        </Button>
      </Popconfirm>
    ),
  },
];
