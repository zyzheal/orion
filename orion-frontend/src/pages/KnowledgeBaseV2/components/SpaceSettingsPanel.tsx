/**
 * SpaceSettingsPanel — Space-level settings: members, roles, share links
 *
 * Features:
 *  - Member management with role-based access control
 *  - Four roles: owner | editor | commenter | viewer
 *  - User search for adding new members
 *  - Share link generation with configurable permissions and expiry
 *  - Share link listing and revocation
 *  - Owner protection (cannot remove/change owner)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  Tabs,
  Table,
  Space,
  Button,
  Select,
  Tag,
  message,
  Popconfirm,
  Input,
  Tooltip,
  Spin,
  DatePicker,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TabsProps } from 'antd/es/tabs';
import {
  SettingOutlined,
  UserAddOutlined,
  LinkOutlined,
  UserDeleteOutlined,
  CopyOutlined,
  DeleteOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import {
  listSpacePermissions,
  updateSpacePermission,
  removeSpacePermission,
  addSpaceMember,
  createShareLink,
  listShareLinks,
  revokeShareLink,
  searchUsers,
  type SpacePermission,
  type SpaceShareLink,
  type PermissionRole,
  type UserSearchResult,
} from '@/api/pandawiki';
import dayjs from 'dayjs';

interface SpaceSettingsPanelProps {
  open: boolean;
  onCancel: () => void;
  spaceId: string;
  spaceName: string;
}

const ROLE_CONFIG: Record<PermissionRole, { label: string; color: string; description: string }> = {
  owner: { label: 'Owner', color: 'red', description: 'Full control' },
  editor: { label: 'Editor', color: 'blue', description: 'Read/Write' },
  commenter: { label: 'Commenter', color: 'cyan', description: 'Read/Comment' },
  viewer: { label: 'Viewer', color: 'default', description: 'Read only' },
};

const SpaceSettingsPanel: React.FC<SpaceSettingsPanelProps> = ({
  open,
  onCancel,
  spaceId,
  spaceName,
}) => {
  // ─── Members tab state ──────────────────────────────────────
  const [members, setMembers] = useState<SpacePermission[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [userSearching, setUserSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [selectedRole, setSelectedRole] = useState<PermissionRole>('viewer');
  const [addMemberLoading, setAddMemberLoading] = useState(false);

  // ─── Share Links tab state ──────────────────────────────────
  const [activeTabKey, setActiveTabKey] = useState('members');
  const [shareLinks, setShareLinks] = useState<SpaceShareLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareRole, setShareRole] = useState<PermissionRole>('viewer');
  const [shareExpiry, setShareExpiry] = useState<dayjs.Dayjs | null>(null);
  const [shareCreating, setShareCreating] = useState(false);

  // ─── Load data ──────────────────────────────────────────────
  const searchCounterRef = useRef(0);

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const res = await listSpacePermissions(spaceId);
      const data = res.data as SpacePermission[] | { permissions?: SpacePermission[]; members?: SpacePermission[] };
      const list = Array.isArray(data) ? data : (data.permissions ?? data.members ?? []) as SpacePermission[];
      setMembers(list);
    } catch (error: unknown) {
      console.error('[SpaceSettings] Failed to load members:', error);
      message.error('加载成员列表失败');
    } finally {
      setMembersLoading(false);
    }
  }, [spaceId]);

  const loadShareLinks = useCallback(async () => {
    setLinksLoading(true);
    try {
      const res = await listShareLinks(spaceId);
      const data = res.data as SpaceShareLink[] | { links?: SpaceShareLink[]; shareLinks?: SpaceShareLink[] };
      const list = Array.isArray(data) ? data : (data.links ?? data.shareLinks ?? []) as SpaceShareLink[];
      setShareLinks(list);
    } catch (error: unknown) {
      console.error('[SpaceSettings] Failed to load share links:', error);
      message.error('加载分享链接失败');
    } finally {
      setLinksLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    if (open) {
      loadMembers();
      loadShareLinks();
    } else {
      // Reset sub-modal states to prevent stale state on next open
      setActiveTabKey('members');
      setShowAddMember(false);
      setShareModalVisible(false);
      setSelectedUser(null);
      setUserResults([]);
      setSearchQuery('');
      setSelectedRole('viewer');
    }
  }, [open, loadMembers, loadShareLinks]);

  // ─── Member operations ──────────────────────────────────────

  const handleSearchUsers = async () => {
    if (!searchQuery.trim()) {
      setUserResults([]);
      return;
    }
    setSelectedUser(null);
    setUserSearching(true);
    const counter = ++searchCounterRef.current;
    try {
      const res = await searchUsers(searchQuery);
      if (counter !== searchCounterRef.current) return; // Stale result, skip
      setUserResults(Array.isArray(res.data) ? res.data : (res.data as any)?.users ?? []);
    } catch {
      if (counter !== searchCounterRef.current) return;
      setUserResults([]);
    } finally {
      if (counter === searchCounterRef.current) {
        setUserSearching(false);
      }
    }
  };

  const handleAddMember = async () => {
    if (!selectedUser) {
      message.warning('请选择用户');
      return;
    }
    setAddMemberLoading(true);
    try {
      await addSpaceMember(spaceId, { userId: selectedUser.id, role: selectedRole });
      message.success(`已将 ${selectedUser.name} 添加为 ${ROLE_CONFIG[selectedRole].label}`);
      setSelectedUser(null);
      setSelectedRole('viewer');
      setSearchQuery('');
      setUserResults([]);
      setShowAddMember(false);
      loadMembers();
    } catch (error: unknown) {
      message.error(`添加失败: ${(error as Error).message}`);
    } finally {
      setAddMemberLoading(false);
    }
  };

  const handleUpdateRole = async (permissionId: string, newRole: PermissionRole) => {
    try {
      await updateSpacePermission(spaceId, permissionId, { role: newRole });
      message.success('权限已更新');
      loadMembers();
    } catch (error: unknown) {
      message.error(`更新失败: ${(error as Error).message}`);
    }
  };

  const handleRemoveMember = async (permissionId: string, userName: string) => {
    try {
      await removeSpacePermission(spaceId, permissionId);
      message.success(`已移除 ${userName}`);
      loadMembers();
    } catch (error: unknown) {
      message.error(`移除失败: ${(error as Error).message}`);
    }
  };

  // ─── Share link operations ──────────────────────────────────

  const handleCreateShareLink = async () => {
    setShareCreating(true);
    try {
      const data: { role: PermissionRole; expiresAt?: string } = { role: shareRole };
      if (shareExpiry) data.expiresAt = shareExpiry.toISOString();
      await createShareLink(spaceId, data);
      message.success('分享链接已创建');
      setShareModalVisible(false);
      setShareExpiry(null);
      setShareRole('viewer');
      loadShareLinks();
    } catch (error: unknown) {
      message.error(`创建失败: ${(error as Error).message}`);
    } finally {
      setShareCreating(false);
    }
  };

  const handleRevokeShareLink = async (shareLinkId: string) => {
    try {
      await revokeShareLink(spaceId, shareLinkId);
      message.success('分享链接已撤销');
      loadShareLinks();
    } catch (error: unknown) {
      message.error(`撤销失败: ${(error as Error).message}`);
    }
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      message.success('链接已复制到剪贴板');
    }).catch(() => {
      message.warning('请手动复制链接');
    });
  };

  // ─── Member table columns ───────────────────────────────────

  const memberColumns: ColumnsType<SpacePermission> = [
    {
      title: '用户',
      dataIndex: 'userName',
      key: 'userName',
      render: (name: string, record: SpacePermission) => (
        <Space>
          <Tag color={ROLE_CONFIG[record.role].color} style={{ fontSize: 11 }}>{ROLE_CONFIG[record.role].label}</Tag>
          <span>{name}</span>
          {record.userEmail && <span style={{ color: '#8c8c8c', fontSize: 12 }}>({record.userEmail})</span>}
        </Space>
      ),
    },
    {
      title: '权限',
      dataIndex: 'role',
      key: 'role',
      width: 160,
      render: (role: PermissionRole, record: SpacePermission) => {
        if (role === 'owner') return <Tag color="red">Owner</Tag>;
        return (
          <Select
            size="small"
            value={role}
            style={{ width: 120 }}
            onChange={(v) => handleUpdateRole(record.id, v as PermissionRole)}
            options={(['editor', 'commenter', 'viewer'] as PermissionRole []).map((r) => ({
              label: ROLE_CONFIG[r].label,
              value: r,
            }))}
          />
        );
      },
    },
    {
      title: '授予时间',
      dataIndex: 'grantedAt',
      key: 'grantedAt',
      width: 140,
      render: (date: string) => {
        const d = new Date(date);
        return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: unknown, record: SpacePermission) => {
        if (record.role === 'owner') {
          return <Tooltip title="Owner 不可移除"><span style={{ color: '#d9d9d9' }}>—</span></Tooltip>;
        }
        return (
          <Popconfirm
            title={`确认移除 ${record.userName}？`}
            onConfirm={() => handleRemoveMember(record.id, record.userName)}
          >
            <Button
              type="text"
              danger
              size="small"
              icon={<UserDeleteOutlined />}
            />
          </Popconfirm>
        );
      },
    },
  ];

  // ─── Share links table columns ──────────────────────────────

  const linkColumns: ColumnsType<SpaceShareLink> = [
    {
      title: '链接',
      dataIndex: 'url',
      key: 'url',
      render: (url: string) => (
        <Space>
          <span style={{ fontSize: 12, wordBreak: 'break-all' }}>{url}</span>
          <Tooltip title="复制链接">
            <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => handleCopyLink(url)} />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '权限',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role: PermissionRole) => <Tag color={ROLE_CONFIG[role].color}>{ROLE_CONFIG[role].label}</Tag>,
    },
    {
      title: '有效期',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      width: 160,
      render: (expiresAt?: string) => {
        if (!expiresAt) return <Tag color="default">永不过期</Tag>;
        const d = new Date(expiresAt);
        return <span>{d.toLocaleDateString('zh-CN')}</span>;
      },
    },
    {
      title: '创建人',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 100,
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: unknown, record: SpaceShareLink) => (
        <Popconfirm
          title="确认撤销此分享链接？"
          onConfirm={() => handleRevokeShareLink(record.id)}
        >
          <Button type="text" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const tabItems: TabsProps['items'] = [
    {
      key: 'members',
      label: (
        <Space>
          <UserAddOutlined />
          成员管理
          <Tag>{members.length}</Tag>
        </Space>
      ),
      children: (
        <div>
          <div style={{ marginBottom: 12 }}>
            <Button type="primary" icon={<UserAddOutlined />} onClick={() => setShowAddMember(true)}>
              添加成员
            </Button>
          </div>
          <Spin spinning={membersLoading}>
            <Table
              columns={memberColumns}
              dataSource={members}
              rowKey="id"
              size="small"
              pagination={false}
            />
          </Spin>
        </div>
      ),
    },
    {
      key: 'share',
      label: (
        <Space>
          <LinkOutlined />
          分享链接
          <Tag>{shareLinks.length}</Tag>
        </Space>
      ),
      children: (
        <div>
          <div style={{ marginBottom: 12 }}>
            <Button type="primary" icon={<LinkOutlined />} onClick={() => setShareModalVisible(true)}>
              生成分享链接
            </Button>
          </div>
          <Spin spinning={linksLoading}>
            <Table
              columns={linkColumns}
              dataSource={shareLinks}
              rowKey="id"
              size="small"
              pagination={false}
            />
          </Spin>
        </div>
      ),
    },
  ];

  return (
    <>
      <Modal
        title={
          <Space>
            <SettingOutlined style={{ color: colors.primary[500] }} />
            {spaceName} - 空间设置
          </Space>
        }
        open={open}
        onCancel={onCancel}
        width={720}
        footer={[
          <Button key="close" onClick={onCancel}>
            关闭
          </Button>,
        ]}
      >
        <Tabs activeKey={activeTabKey} onChange={setActiveTabKey} items={tabItems} />

        {/* Add Member Sub-Modal */}
        <Modal
          title="添加成员"
          open={showAddMember}
          onCancel={() => { setShowAddMember(false); setSelectedUser(null); setSearchQuery(''); setUserResults([]); }}
          onOk={handleAddMember}
          confirmLoading={addMemberLoading}
          okText="添加"
          width={480}
        >
          <div style={{ marginTop: 8 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#595959' }}>
              搜索用户 <span style={{ color: '#8c8c8c' }}>(输入用户名或邮箱)</span>
            </label>
            <Input.Search
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onSearch={handleSearchUsers}
              placeholder="搜索用户..."
              loading={userSearching}
              allowClear
              style={{ marginBottom: 8 }}
            />
            {userResults.length > 0 && (
              <div
                style={{
                  maxHeight: 150,
                  overflow: 'auto',
                  border: '1px solid #f0f0f0',
                  borderRadius: 4,
                  marginBottom: 12,
                }}
              >
                {userResults.map((user) => (
                  <div
                    key={user.id}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      backgroundColor: selectedUser?.id === user.id ? '#e6f7ff' : 'transparent',
                      borderBottom: '1px solid #f0f0f0',
                    }}
                    onClick={() => setSelectedUser(user)}
                  >
                    <Space>
                      <span style={{ fontWeight: 500 }}>{user.name}</span>
                      {user.email && <span style={{ color: '#8c8c8c', fontSize: 12 }}>({user.email})</span>}
                    </Space>
                  </div>
                ))}
              </div>
            )}
            <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#595959' }}>选择权限</label>
            <Select
              value={selectedRole}
              onChange={(v) => setSelectedRole(v as PermissionRole)}
              style={{ width: '100%' }}
              options={Object.entries(ROLE_CONFIG).map(([key, cfg]) => ({
                label: `${cfg.label} - ${cfg.description}`,
                value: key,
              }))}
            />
            {selectedUser && (
              <Typography.Text style={{ marginTop: 8, display: 'block', fontSize: 12, color: colors.success[500] }}>
                已选择: {selectedUser.name}，将赋予 <strong>{ROLE_CONFIG[selectedRole].label}</strong> 权限
              </Typography.Text>
            )}
          </div>
        </Modal>

        {/* Create Share Link Modal */}
        <Modal
          title={
            <Space>
              <KeyOutlined />
              生成分享链接
            </Space>
          }
          open={shareModalVisible}
          onCancel={() => setShareModalVisible(false)}
          onOk={handleCreateShareLink}
          confirmLoading={shareCreating}
          okText="生成"
          width={440}
        >
          <div style={{ marginTop: 8 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>分享权限</label>
            <Select
              value={shareRole}
              onChange={(v) => setShareRole(v as PermissionRole)}
              style={{ width: '100%', marginBottom: 12 }}
              options={Object.entries(ROLE_CONFIG).filter(([k]) => k !== 'owner').map(([key, cfg]) => ({
                label: `${cfg.label} - ${cfg.description}`,
                value: key,
              }))}
            />
            <label style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>过期时间（可选）</label>
            <DatePicker
              value={shareExpiry}
              onChange={setShareExpiry}
              style={{ width: '100%' }}
              allowClear
              placeholder="选择过期日期（留空则永不过期）"
              disabledDate={(date) => date && date.isBefore(dayjs(), 'day')}
            />
          </div>
        </Modal>
      </Modal>
    </>
  );
};

export default SpaceSettingsPanel;
