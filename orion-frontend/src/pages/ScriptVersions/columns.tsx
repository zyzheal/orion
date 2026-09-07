/**
 * ScriptVersions columns
 * 抽取自 index.tsx (P2-9 Phase 187)
 */
import { Button, Space, Typography } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import type { ScriptVersion } from '@/api/script-versions';
import dayjs from 'dayjs';

const { Text } = Typography;

interface BuildColumnsDeps {
  onDelete: (record: ScriptVersion) => void;
}

export const buildVersionColumns = (deps: BuildColumnsDeps) => [
  {
    title: 'Version',
    dataIndex: 'version',
    width: 120,
    render: (v: string) => (
      <Text strong code>
        {v}
      </Text>
    ),
  },
  {
    title: 'Content Hash',
    dataIndex: 'contentHash',
    width: 80,
    render: (v: string) => (
      <Text code style={{ fontSize: 11 }}>
        {v.slice(0, 8)}
      </Text>
    ),
  },
  {
    title: 'Change Description',
    dataIndex: 'changeDescription',
    ellipsis: true,
  },
  {
    title: 'Created By',
    dataIndex: 'createdBy',
    width: 120,
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    width: 160,
    render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
  },
  {
    title: '操作',
    width: 120,
    render: (_: unknown, r: ScriptVersion) => (
      <Space size="small">
        <Button
          type="link"
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => deps.onDelete(r)}
        >
          删除
        </Button>
      </Space>
    ),
  },
];
