/**
 * DetailItems.tsx - 用户详情抽屉内容
 * 抽取自 UserManagement/index.tsx (P2-9 Phase 97)
 */
import React from 'react';
import { Descriptions, Tag, Space } from 'antd';
import dayjs from 'dayjs';
import type { User } from '@/api/users';
import { roleColorMap, roleLabelMap, statusColorMap, statusLabelMap } from '../constants';

interface DetailItemsProps {
  selectedUser: User | null;
}

export const DetailItems: React.FC<DetailItemsProps> = ({ selectedUser }) => {
  if (!selectedUser) return null;
  const u = selectedUser;
  return (
    <Descriptions column={2} bordered size="small">
      <Descriptions.Item label="用户名">{u.username}</Descriptions.Item>
      <Descriptions.Item label="显示名称">{u.name || '-'}</Descriptions.Item>
      <Descriptions.Item label="邮箱">{u.email || '-'}</Descriptions.Item>
      <Descriptions.Item label="角色">
        <Tag color={roleColorMap[u.role] || 'default'}>{roleLabelMap[u.role] || u.role}</Tag>
      </Descriptions.Item>
      <Descriptions.Item label="状态">
        <Tag color={statusColorMap[u.status] || 'default'}>
          {statusLabelMap[u.status] || u.status}
        </Tag>
      </Descriptions.Item>
      <Descriptions.Item label="创建者">{u.created_by || '-'}</Descriptions.Item>
      <Descriptions.Item label="最后登录">
        {u.last_login_at ? dayjs(u.last_login_at).format('YYYY-MM-DD HH:mm:ss') : '从未登录'}
      </Descriptions.Item>
      <Descriptions.Item label="登录IP">{u.last_login_ip || '-'}</Descriptions.Item>
      <Descriptions.Item label="创建时间">
        {dayjs(u.created_at).format('YYYY-MM-DD HH:mm:ss')}
      </Descriptions.Item>
      <Descriptions.Item label="更新时间">
        {dayjs(u.updated_at).format('YYYY-MM-DD HH:mm:ss')}
      </Descriptions.Item>
      {u.settings && Object.keys(u.settings).length > 0 && (
        <Descriptions.Item label="用户设置" span={2}>
          <Space wrap>
            {Object.entries(u.settings).map(([k, v]) => (
              <Tag key={String(k)}>
                {k}: {String(v)}
              </Tag>
            ))}
          </Space>
        </Descriptions.Item>
      )}
    </Descriptions>
  );
};
