/**
 * EnvProfiles columns
 * 抽取自 index.tsx (P2-9 Phase 178)
 */
import { Button, Space, Tag, Typography } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { EnvProfile } from '@/api/env-profiles';
import { ENV_COLOR } from './constants';

const { Text } = Typography;

export interface EnvColumnsDeps {
  handleEdit: (record: EnvProfile) => void;
  handleDelete: (record: EnvProfile) => void;
  handleViewEnvironments: (record: EnvProfile) => void | Promise<void>;
  handleResolveOpen: (record: EnvProfile) => void;
  envLoading: boolean;
  selectedProfileId: string | null;
}

export function buildEnvColumns(deps: EnvColumnsDeps): ColumnsType<EnvProfile> {
  const { handleEdit, handleDelete, handleViewEnvironments, handleResolveOpen, envLoading, selectedProfileId } = deps;

  return [
    {
      title: 'Name',
      dataIndex: 'name',
      width: 180,
      render: (v: string, r: EnvProfile) => (
        <Space direction="vertical" size={0}>
          <Text strong>{v}</Text>
          <Tag color={ENV_COLOR[r.environment] || 'default'}>{r.environment}</Tag>
        </Space>
      ),
    },
    {
      title: 'Variables',
      dataIndex: 'variables',
      ellipsis: true,
      render: (v: Record<string, string>) => {
        const keys = Object.keys(v);
        return keys.length > 0
          ? `${keys.length} keys: ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}`
          : '-';
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      width: 250,
      render: (_: unknown, r: EnvProfile) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>
            编辑
          </Button>
          <Button type="link" size="small" onClick={() => handleResolveOpen(r)}>
            解析变量
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => handleViewEnvironments(r)}
            loading={envLoading && selectedProfileId === r.id}
          >
            环境列表
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(r)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];
}
