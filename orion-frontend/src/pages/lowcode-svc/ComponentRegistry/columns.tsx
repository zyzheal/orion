/**
 * ComponentRegistry table columns
 * 抽取自 index.tsx (P2-9 Phase 194)
 */
import { Button, Space, Tag } from 'antd';
import { CodeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { ComponentRegistry } from '@/api/lowcode';
import { getCategoryLabel } from './constants';

interface ColumnDeps {
  onViewDetail: (comp: ComponentRegistry) => void;
}

export const buildColumns = (deps: ColumnDeps): ColumnsType<ComponentRegistry> => [
  {
    title: '组件名',
    dataIndex: 'name',
    key: 'name',
    width: 160,
    render: (v: string) => <Tag>{v}</Tag>,
  },
  { title: '显示名', dataIndex: 'displayName', key: 'displayName' },
  {
    title: '分类',
    dataIndex: 'category',
    key: 'category',
    width: 100,
    render: (v: string) => <Tag color="blue">{getCategoryLabel(v)}</Tag>,
  },
  { title: '版本', dataIndex: 'version', key: 'version', width: 80 },
  {
    title: '内置',
    dataIndex: 'isBuiltin',
    key: 'isBuiltin',
    width: 70,
    render: (v: boolean) => (v ? <Tag color="green">是</Tag> : <Tag>否</Tag>),
  },
  {
    title: '图标',
    dataIndex: 'icon',
    key: 'icon',
    width: 80,
    render: (v: string) => (v ? <span>{v}</span> : '-'),
  },
  {
    title: '注册时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 160,
    render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
  },
  {
    title: '操作',
    key: 'action',
    width: 120,
    render: (_: unknown, record: ComponentRegistry) => (
      <Space>
        <Button
          size="small"
          type="link"
          icon={<CodeOutlined />}
          onClick={() => deps.onViewDetail(record)}
        >
          详情
        </Button>
      </Space>
    ),
  },
];
