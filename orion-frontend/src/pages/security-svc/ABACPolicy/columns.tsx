/**
 * ABACPolicy columns
 * 抽取自 index.tsx (P2-9 Phase 202)
 */
import { Button, Space, Switch, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  EditOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import type { AbacPolicy } from '@/api/abac-policy';
import { colors } from '@/tokens';

interface Props {
  onOpenDetail: (policy: AbacPolicy) => void;
  onToggle: (id: string) => void;
  onEdit: (policy: AbacPolicy) => void;
  onDelete: (id: string) => void;
}

export function buildColumns({ onOpenDetail, onToggle, onEdit, onDelete }: Props): ColumnsType<AbacPolicy> {
  return [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (val: string, record: AbacPolicy) => (
        <Space>
          <span>{val}</span>
          <InfoCircleOutlined
            onClick={() => onOpenDetail(record)}
            style={{ cursor: 'pointer', color: colors.primary[500] }}
          />
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '资源类型',
      dataIndex: 'resourceType',
      key: 'resourceType',
      width: 120,
      render: (val: string | string[]) => (
        <Tag color="blue">{Array.isArray(val) ? val.join(', ') : val}</Tag>
      ),
    },
    {
      title: '操作类型',
      dataIndex: 'actionType',
      key: 'actionType',
      width: 120,
      render: (val: string | string[]) => (
        <Tag>{Array.isArray(val) ? val.join(', ') : val}</Tag>
      ),
    },
    {
      title: '效果',
      dataIndex: 'effect',
      key: 'effect',
      width: 80,
      render: (val: string) => (
        <Tag color={val === 'allow' ? 'green' : 'red'}>{val === 'allow' ? '允许' : '拒绝'}</Tag>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      sorter: (a, b) => (a.priority || 0) - (b.priority || 0),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (val: boolean, record: AbacPolicy) => (
        <Switch
          checked={val}
          onChange={() => onToggle(record.id)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: AbacPolicy) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => onEdit(record)}>
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onDelete(record.id)}
            disabled={record.id.startsWith('system-')}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];
}
