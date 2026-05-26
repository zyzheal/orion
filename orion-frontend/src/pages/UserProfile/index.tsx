/**
 * User Profile Page
 * 个人中心页面
 * 展示用户基本信息、团队、权限和操作日志
 */

import React, { useEffect, useState } from 'react';
import {
  Card,
  Avatar,
  Tag,
  Timeline,
  Spin,
  Row,
  Col,
  Button,
  Typography,
  Space,
  Empty,
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  SafetyOutlined,
  HistoryOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  userApi,
  type UserProfile,
  type UserActivity,
  type UserTeam,
  type UserPermission,
} from '@/api/user';
import { colors } from '@/tokens/colors';
import { componentRadius, radius } from '@/tokens/radius';
import { spacing, componentSpacing } from '@/tokens/spacing';

// API 响应包装接口
interface ApiResponse<T> { data?: T; data?: T[] }
interface NestedApiResponse<T> { data?: { data?: T } }

const { Title, Text } = Typography;

/**
 * 卡片阴影 token
 */
const cardShadow = '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)';

/**
 * 操作类型映射到颜色
 */
const getActivityColor = (action: string): string => {
  const actionLower = action.toLowerCase();
  if (actionLower.includes('create') || actionLower.includes('新增')) {
    return colors.success[500];
  }
  if (
    actionLower.includes('update') ||
    actionLower.includes('修改') ||
    actionLower.includes('编辑')
  ) {
    return colors.warning[500];
  }
  if (actionLower.includes('delete') || actionLower.includes('删除')) {
    return colors.error[500];
  }
  if (actionLower.includes('login') || actionLower.includes('登录')) {
    return colors.primary[500];
  }
  if (actionLower.includes('view') || actionLower.includes('查看')) {
    return colors.info[500];
  }
  return colors.neutral[500];
};

/**
 * 角色标签颜色映射
 */
const getRoleColor = (role: string): string => {
  const roleLower = role.toLowerCase();
  if (roleLower.includes('admin') || roleLower.includes('管理员')) {
    return 'blue';
  }
  if (roleLower.includes('owner') || roleLower.includes('所有者')) {
    return 'purple';
  }
  if (roleLower.includes('developer') || roleLower.includes('开发')) {
    return 'green';
  }
  if (roleLower.includes('viewer') || roleLower.includes('查看')) {
    return 'default';
  }
  return 'default';
};

/**
 * 状态标签颜色映射
 */
const getStatusColor = (status: string): string => {
  const statusLower = status.toLowerCase();
  if (statusLower === 'active' || statusLower === '正常') {
    return colors.success[500];
  }
  if (statusLower === 'inactive' || statusLower === '禁用') {
    return colors.error[500];
  }
  return colors.neutral[500];
};

export const UserProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [teams, setTeams] = useState<UserTeam[]>([]);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // 并行请求所有数据
        const [profileRes, activitiesRes, teamsRes, permissionsRes] = await Promise.all([
          userApi.getProfile(user.id).catch(() => null),
          userApi.getActivities(user.id).catch(() => []),
          userApi.getTeams(user.id).catch(() => []),
          userApi.getPermissions(user.id).catch(() => []),
        ]);

        if (profileRes) setProfile((profileRes as NestedApiResponse<UserProfile>)?.data?.data || (profileRes as ApiResponse<UserProfile>)?.data || profileRes);
        if (activitiesRes) setActivities((activitiesRes as NestedApiResponse<UserActivity[]>)?.data?.data || (activitiesRes as ApiResponse<UserActivity[]>)?.data || []);
        if (teamsRes) setTeams((teamsRes as NestedApiResponse<UserTeam[]>)?.data?.data || (teamsRes as ApiResponse<UserTeam[]>)?.data || []);
        if (permissionsRes) setPermissions((permissionsRes as NestedApiResponse<UserPermission[]>)?.data?.data || (permissionsRes as ApiResponse<UserPermission[]>)?.data || []);
      } catch (error) {
        console.error('Failed to fetch user profile data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.id]);

  const handleEditProfile = () => {
    navigate('/settings');
  };

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}
      >
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  // 头像渐变背景
  const avatarGradient = `linear-gradient(135deg, ${colors.primary[500]} 0%, ${colors.purple[500]} 100%)`;

  return (
    <div style={{ padding: spacing.lg, maxWidth: 1200, margin: '0 auto' }}>
      {/* 顶部信息栏 - 用户基本信息卡片 */}
      <Card
        style={{
          borderRadius: componentRadius.card,
          boxShadow: cardShadow,
          marginBottom: spacing.lg,
        }}
        bodyStyle={{ padding: componentSpacing.cardPadding.lg }}
      >
        <Row align="middle" gutter={spacing.lg}>
          <Col>
            {profile?.avatar ? (
              <Avatar src={profile.avatar} size={80} style={{ borderRadius: radius.xs }} />
            ) : (
              <Avatar
                size={80}
                style={{
                  background: avatarGradient,
                  fontSize: 32,
                }}
                icon={<UserOutlined />}
              />
            )}
          </Col>
          <Col flex={1}>
            <Space direction="vertical" size={spacing.xs}>
              <Space align="center">
                <Title level={2} style={{ marginBottom: 8 }}>
                  <UserOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
                  {profile?.username || user?.username || '未设置用户名'}
                </Title>
                <Tag color={getRoleColor(profile?.role || user?.role || '')}>
                  {profile?.role || user?.role || '用户'}
                </Tag>
                <Tag
                  style={{
                    backgroundColor: `${getStatusColor(profile?.status || 'active')}20`,
                    color: getStatusColor(profile?.status || 'active'),
                    border: `1px solid ${getStatusColor(profile?.status || 'active')}`,
                  }}
                >
                  {profile?.status === 'active' ? '正常' : profile?.status || '正常'}
                </Tag>
              </Space>
              <Text type="secondary">{profile?.email || user?.email || '未设置邮箱'}</Text>
              {profile?.phone && <Text type="secondary">手机: {profile.phone}</Text>}
            </Space>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={handleEditProfile}
              style={{
                borderRadius: componentRadius.button.md,
                backgroundColor: colors.primary[500],
              }}
            >
              编辑资料
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 团队模块和权限模块 - 并排显示 */}
      <Row gutter={spacing.lg} style={{ marginBottom: spacing.lg }}>
        {/* 左侧 - 所属团队 */}
        <Col xs={24} md={12}>
          <Card
            style={{
              borderRadius: componentRadius.card,
              boxShadow: cardShadow,
              height: '100%',
            }}
            bodyStyle={{ padding: componentSpacing.cardPadding.lg }}
          >
            <Space align="center" style={{ marginBottom: spacing.md }}>
              <TeamOutlined style={{ fontSize: 18, color: colors.primary[500] }} />
              <Title level={5} style={{ margin: 0 }}>
                所属团队
              </Title>
            </Space>
            {teams.length > 0 ? (
              <Space direction="vertical" style={{ width: '100%' }} size={spacing.sm}>
                {teams.map((team) => (
                  <div
                    key={team.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: `${spacing.sm}px ${spacing.md}px`,
                      backgroundColor: colors.light.bg.secondary,
                      borderRadius: componentRadius.tag,
                    }}
                  >
                    <Text strong>{team.name}</Text>
                    <Tag color={getRoleColor(team.role)}>{team.role}</Tag>
                  </div>
                ))}
              </Space>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无团队"
                style={{ padding: spacing.xl }}
              />
            )}
          </Card>
        </Col>

        {/* 右侧 - 权限矩阵 */}
        <Col xs={24} md={12}>
          <Card
            style={{
              borderRadius: componentRadius.card,
              boxShadow: cardShadow,
              height: '100%',
            }}
            bodyStyle={{ padding: componentSpacing.cardPadding.lg }}
          >
            <Space align="center" style={{ marginBottom: spacing.md }}>
              <SafetyOutlined style={{ fontSize: 18, color: colors.purple[500] }} />
              <Title level={5} style={{ margin: 0 }}>
                权限矩阵
              </Title>
            </Space>
            {permissions.length > 0 ? (
              <Space direction="vertical" style={{ width: '100%' }} size={spacing.sm}>
                {permissions.map((perm, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: `${spacing.sm}px ${spacing.md}px`,
                      backgroundColor: colors.light.bg.secondary,
                      borderRadius: componentRadius.tag,
                    }}
                  >
                    <Text strong>{perm.resource}</Text>
                    <Space size={spacing.xs}>
                      {perm.actions.map((action) => (
                        <Tag
                          key={action}
                          color="blue"
                          style={{ borderRadius: componentRadius.tag }}
                        >
                          {action}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                ))}
              </Space>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无权限"
                style={{ padding: spacing.xl }}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 底部 - 操作日志时间线 */}
      <Card
        style={{
          borderRadius: componentRadius.card,
          boxShadow: cardShadow,
        }}
        bodyStyle={{ padding: componentSpacing.cardPadding.lg }}
      >
        <Space align="center" style={{ marginBottom: spacing.md }}>
          <HistoryOutlined style={{ fontSize: 18, color: colors.info[500] }} />
          <Title level={5} style={{ margin: 0 }}>
            操作日志
          </Title>
        </Space>
        {activities.length > 0 ? (
          <Timeline
            style={{ paddingTop: spacing.sm }}
            items={activities.map((activity) => ({
              color: getActivityColor(activity.action),
              children: (
                <div style={{ paddingBottom: spacing.xs }}>
                  <Space>
                    <Tag
                      style={{
                        backgroundColor: `${getActivityColor(activity.action)}20`,
                        color: getActivityColor(activity.action),
                        border: 'none',
                      }}
                    >
                      {activity.action}
                    </Tag>
                    {activity.resourceType && (
                      <Text type="secondary">[{activity.resourceType}]</Text>
                    )}
                  </Space>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {formatDate(activity.createdAt)}
                    </Text>
                  </div>
                </div>
              ),
            }))}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无操作日志"
            style={{ padding: spacing.xl }}
          />
        )}
      </Card>
    </div>
  );
};

export default UserProfilePage;
