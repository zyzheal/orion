/**
 * FormDesigner table column builders
 * 抽取自 index.tsx (P2-9 Phase 161)
 */
import { Space, Switch, Tag, Tooltip, Button } from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { TableColumn } from '@/components/Table';
import { STATUS_MAP } from './constants';

interface ActionColumnDeps {
  activeTab: 'forms' | 'conditions';
  onEdit: (record: any) => void;
  onDelete: (id: string) => void;
  onPreview: (schema: Record<string, any>) => void;
}

export const buildFormColumns = (): TableColumn<unknown>[] => [
  { title: '名称', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: '版本', dataIndex: 'version', key: 'version', width: 80 },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (_: unknown, record: unknown) => {
      const r = record as Record<string, unknown>;
      const v = r.status as string;
      return <Tag color={STATUS_MAP[v]?.color}>{STATUS_MAP[v]?.label || v}</Tag>;
    },
  },
  {
    title: '更新日期',
    dataIndex: 'updatedAt',
    key: 'updatedAt',
    render: (_: unknown, record: unknown) => {
      const r = record as Record<string, unknown>;
      const v = r.updatedAt as string;
      return <>{v ? new Date(v).toLocaleDateString('zh-CN') : '-'}</>;
    },
  },
];

export const buildConditionColumns = (): TableColumn<unknown>[] => [
  { title: '名称', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: '条件', dataIndex: 'condition', key: 'condition', ellipsis: true },
  {
    title: '启用',
    dataIndex: 'enabled',
    key: 'enabled',
    render: (_: unknown, record: unknown) => (
      <Switch checked={(record as Record<string, unknown>).enabled as boolean} disabled size="small" />
    ),
  },
];

export const buildActionColumn = (deps: ActionColumnDeps): TableColumn<unknown> => ({
  title: '操作',
  key: 'action',
  width: 220,
  render: (_: any, record: any) => (
    <Space>
      {deps.activeTab === 'forms' && (
        <Tooltip title="预览 Schema">
          <Button
            type="link"
            icon=<EyeOutlined />}
            onClick={() => deps.onPreview(record.schema)}
          />
        </Tooltip>
      )}
      <Tooltip title="编辑">
        <Button type="link" icon=<EditOutlined />} onClick={() => deps.onEdit(record)} />
      </Tooltip>
      <Tooltip title="删除">
        <Button
          type="link"
          danger
          icon=<DeleteOutlined />}
          onClick={() => deps.onDelete(record.id)}
        />
      </Tooltip>
    </Space>
  ),
});
