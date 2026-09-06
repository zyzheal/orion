/**
 * CITypeDesignerColumns.tsx - CI Type Designer 表格列配置
 * 抽取自 CITypeDesigner/index.tsx (P2-9 Phase 52)
 * 3 useMemo 列 builder: useTypeColumns / useAttrColumns / useVersionColumns
 * + categoryOptions/categoryColorMap/attrTypeOptions 常量
 */
import { useMemo } from 'react';
import { Typography, Tag, Space, Button, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, CheckCircleOutlined, RollbackOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { CIType, CIAttribute, CITypeVersion } from '@/api/ci-types';

const { Text } = Typography;

// ============================================================================
// Constants
// ============================================================================

export const categoryOptions = [
  { label: '服务器', value: 'server' },
  { label: '网络设备', value: 'network' },
  { label: '数据库', value: 'database' },
  { label: '中间件', value: 'middleware' },
  { label: '应用', value: 'application' },
  { label: '存储', value: 'storage' },
  { label: '其他', value: 'other' },
];

export const categoryColorMap: Record<string, string> = {
  server: 'blue',
  network: 'cyan',
  database: 'purple',
  middleware: 'orange',
  application: 'green',
  storage: 'gold',
  other: 'default',
};

export const attrTypeOptions = [
  { label: '字符串 (string)', value: 'string' },
  { label: '数字 (number)', value: 'number' },
  { label: '布尔 (boolean)', value: 'boolean' },
  { label: '日期 (date)', value: 'date' },
  { label: '单选 (select)', value: 'select' },
  { label: '多选 (multiselect)', value: 'multiselect' },
  { label: 'JSON', value: 'json' },
];

// ============================================================================
// Handler Interfaces
// ============================================================================

export interface TypeColumnsHandlers {
  handleViewDetail: (record: CIType) => void;
  handleEditType: (record: CIType) => void;
  handleOpenValidate: (record: CIType) => void;
  handleDeleteType: (id: string) => void;
}

export interface AttrColumnsHandlers {
  handleEditAttr: (record: CIAttribute) => void;
  handleDeleteAttr: (record: CIAttribute) => void;
}

export interface VersionColumnsHandlers {
  handleRollback: (version: CITypeVersion) => void;
}

// ============================================================================
// Column Builders
// ============================================================================

export function useTypeColumns(h: TypeColumnsHandlers): ColumnsType<CIType> {
  return useMemo((): ColumnsType<CIType> => [
    {
      title: '类型名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record) => <a onClick={() => h.handleViewDetail(record)}>{text}</a>,
    },
    {
      title: '显示名称',
      dataIndex: 'displayName',
      key: 'displayName',
      render: (text: string | null) => text ?? '-',
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (cat: string | null) =>
        cat ? <Tag color={categoryColorMap[cat] ?? 'default'}>{cat}</Tag> : '-',
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      render: (v: number) => <Tag>v{v}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 160,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => h.handleEditType(record)}>
            编辑
          </Button>
          <Button
            type="link"
            icon={<CheckCircleOutlined />}
            onClick={() => h.handleOpenValidate(record)}
          >
            校验
          </Button>
          <Popconfirm title="确认删除此 CI 类型？" onConfirm={() => h.handleDeleteType(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ], [h]);
}

export function useAttrColumns(h: AttrColumnsHandlers): ColumnsType<CIAttribute> {
  return useMemo((): ColumnsType<CIAttribute> => [
    {
      title: '属性标识',
      dataIndex: 'attrKey',
      key: 'attrKey',
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: '显示名称',
      dataIndex: 'displayName',
      key: 'displayName',
      render: (text: string | null) => text ?? '-',
    },
    {
      title: '类型',
      dataIndex: 'attrType',
      key: 'attrType',
      render: (t: string) => <Tag>{t}</Tag>,
    },
    {
      title: '必填',
      dataIndex: 'required',
      key: 'required',
      width: 80,
      render: (v: boolean) => (v ? <Tag color="red">必填</Tag> : <Tag>可选</Tag>),
    },
    {
      title: '默认值',
      dataIndex: 'defaultValue',
      key: 'defaultValue',
      render: (text: string | null) => text ?? '-',
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 70,
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => h.handleEditAttr(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除此属性？" onConfirm={() => h.handleDeleteAttr(record)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ], [h]);
}

export function useVersionColumns(h: VersionColumnsHandlers): ColumnsType<CITypeVersion> {
  return useMemo((): ColumnsType<CITypeVersion> => [
    {
      title: '版本号',
      dataIndex: 'version',
      key: 'version',
      width: 100,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '快照内容',
      dataIndex: 'attributesSnapshot',
      key: 'attributesSnapshot',
      render: (snapshot: string) => {
        let parsed = snapshot;
        try {
          parsed = JSON.stringify(JSON.parse(snapshot || '[]'), null, 1);
        } catch {
          /* ignore */
        }
        return (
          <Text ellipsis style={{ maxWidth: 400, fontFamily: 'monospace', fontSize: 12 }}>
            {parsed}
          </Text>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Popconfirm
          title={`确认回滚到版本 ${record.version}？`}
          onConfirm={() => h.handleRollback(record)}
        >
          <Button type="link" icon={<RollbackOutlined />}>
            回滚
          </Button>
        </Popconfirm>
      ),
    },
  ], [h]);
}
