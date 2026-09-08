/**
 * I18nManagement table columns
 * 抽取自 index.tsx (P2-9 Phase 197)
 */
import { Button, Popconfirm, Space, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { I18nLocale } from '@/api/i18n';

const { Text } = Typography;

export const buildLocaleColumns: () => ColumnsType<I18nLocale> = () => [
  {
    title: '语言代码',
    dataIndex: 'code',
    key: 'code',
    render: (text: string) => <Tag color="blue">{text}</Tag>,
  },
  {
    title: '名称',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: '状态',
    dataIndex: 'enabled',
    key: 'enabled',
    render: (enabled: boolean) => (
      <Tag color={enabled ? 'green' : 'default'}>{enabled ? '启用' : '禁用'}</Tag>
    ),
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
  },
];

export interface TranslationRow {
  key: string;
  value: string;
}

export const buildTranslationColumns = (deps: {
  onEdit: (key: string, value: string) => void;
  onDelete: (key: string) => void;
}): ColumnsType<TranslationRow> => [
  {
    title: 'Key',
    dataIndex: 'key',
    key: 'key',
    render: (text: string) => <Text code>{text}</Text>,
  },
  {
    title: 'Value',
    dataIndex: 'value',
    key: 'value',
  },
  {
    title: '操作',
    key: 'actions',
    render: (_: unknown, record: TranslationRow) => (
      <Space>
        <Button
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => deps.onEdit(record.key, record.value)}
        >
          编辑
        </Button>
        <Popconfirm title="确认删除？" onConfirm={() => deps.onDelete(record.key)}>
          <Button type="link" danger icon={<DeleteOutlined />} size="small">
            删除
          </Button>
        </Popconfirm>
      </Space>
    ),
  },
];
