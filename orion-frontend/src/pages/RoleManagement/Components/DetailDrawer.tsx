/**
 * Role detail drawer (with permission groups + assigned users)
 * 抽取自 index.tsx (P2-9 Phase 165)
 */
import { Descriptions, Divider, Drawer, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { PERMISSION_GROUPS } from '@/api/roles';
import type { Role } from '@/api/roles';
import { spacing } from '@/tokens';
import { getPermissionColor } from '../constants';

const { Text } = Typography;

interface DetailDrawerProps {
  open: boolean;
  role: Role | null;
  onClose: () => void;
}

const renderPermissionGroup = (role: Role) => {
  return PERMISSION_GROUPS.map((group) => {
    const groupPerms = group.permissions.filter((p) => role.permissions.includes(p.value));
    if (groupPerms.length === 0) return null;
    return (
      <div key={group.group} style={{ marginBottom: spacing.md }}>
        <Text strong style={{ fontSize: 13 }}>
          {group.group}
        </Text>
        <div style={{ marginTop: spacing.sm }}>
          <Space wrap>
            {groupPerms.map((p) => (
              <Tag key={p.value} color={getPermissionColor(p.value)}>
                {p.label}
              </Tag>
            ))}
          </Space>
        </div>
      </div>
    );
  });
};

const renderAssignedUsers = () => {
  return <Text type="secondary">暂无关联用户</Text>;
};

export const DetailDrawer = ({ open, role, onClose }: DetailDrawerProps) => (
  <Drawer
    title={role ? role.name : '角色详情'}
    open={open}
    onClose={onClose}
    width={720}
    destroyOnClose
  >
    {role && (
      <>
        <Descriptions column={2} bordered size="small" style={{ marginBottom: spacing.lg }}>
          <Descriptions.Item label="角色名称">{role.name}</Descriptions.Item>
          <Descriptions.Item label="系统角色">
            {role.is_system ? <Tag color="gold">是</Tag> : <Tag>否</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="权限数量">
            {role.permissions.length} 项
          </Descriptions.Item>
          <Descriptions.Item label="关联用户">
            {role.user_count || 0} 位
          </Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>
            {role.description || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {role.created_at
              ? dayjs(role.created_at).format('YYYY-MM-DD HH:mm:ss')
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {role.updated_at
              ? dayjs(role.updated_at).format('YYYY-MM-DD HH:mm:ss')
              : '-'}
          </Descriptions.Item>
        </Descriptions>

        <Divider>权限列表</Divider>
        <div style={{ marginBottom: spacing.lg }}>
          {renderPermissionGroup(role)}
        </div>

        <Divider>关联用户</Divider>
        {renderAssignedUsers()}
      </>
    )}
  </Drawer>
);
