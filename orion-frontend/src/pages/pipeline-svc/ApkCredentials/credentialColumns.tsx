/**
 * ApkCredentials table columns
 * 抽取自 index.tsx (P2-9 Phase 137)
 */
import { Space, Tag, Button } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { TableColumn } from '@/components/Table';
import type { CredentialRecord, EditingCredential } from './types';
import { getMarketName } from './constants';

dayjs.extend(relativeTime);

interface CredentialColumnsDeps {
  openEditModal: (record: EditingCredential) => void;
  handleDelete: (id: string, market: string) => void;
}

export const buildCredentialColumns = ({
  openEditModal,
  handleDelete,
}: CredentialColumnsDeps): TableColumn<CredentialRecord>[] => [
  {
    key: 'market',
    title: '应用市场',
    dataIndex: 'market',
    render: (v: unknown) => <Tag color="blue">{getMarketName(String(v))}</Tag>,
  },
  {
    key: 'name',
    title: '凭证名称',
    dataIndex: 'name',
    render: (v: unknown) => <code>{String(v)}</code>,
  },
  {
    key: 'description',
    title: '描述',
    dataIndex: 'description',
  },
  {
    key: 'updatedAt',
    title: '更新时间',
    dataIndex: 'updatedAt',
    render: (v: unknown) => dayjs(String(v)).fromNow(),
  },
  {
    key: 'action',
    title: '操作',
    width: 160,
    render: (_: unknown, record?: CredentialRecord) =>
      record ? (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            编辑
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id, record.market)}
          >
            删除
          </Button>
        </Space>
      ) : null,
  },
];
