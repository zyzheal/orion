import { Button, Space, Tag } from 'antd';
import { DeleteOutlined, UserOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { ProjectMember } from '@/api/project-member';

const ROLE_COLOR: Record<string, string> = {
  admin: 'red',
  developer: 'blue',
  viewer: 'green',
  approver: 'orange',
};

export function buildColumns(onRemove: (userId: string) => void): ColumnsType<ProjectMember> {
  return [
    {
      title: '用户ID',
      dataIndex: 'user_id',
      key: 'user_id',
      render: (val) => (
        <Space>
          <UserOutlined />
          <span>{val}</span>
        </Space>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (val) => <Tag color={ROLE_COLOR[val] || 'default'}>{val}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: ProjectMember) => (
        <Button
          type="link"
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => onRemove(record.user_id)}
        >
          移除
        </Button>
      ),
    },
  ];
}
