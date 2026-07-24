import { useState, useEffect } from 'react';
import {
  Card,
  Col,
  Row,
  Typography,
  Space,
  Avatar,
  Tag,
  Descriptions,
  List,
  message,
  Spin,
  Button,
  Tabs,
  Empty,
  Modal,
  Form,
  Input,
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  HistoryOutlined,
  EditOutlined,
  MailOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { userApi, UserProfile as UserProfileType, UserActivity, UserTeam } from '@/api/user';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

const ROLE_COLORS: Record<string, string> = {
  admin: 'red',
  developer: 'blue',
  viewer: 'green',
  operator: 'orange',
};

export default function UserProfilePage() {
  const [profile, setProfile] = useState<UserProfileType | null>(null);
  const [teams, setTeams] = useState<UserTeam[]>([]);
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editVisible, setEditVisible] = useState(false);
  const [form] = Form.useForm();

  // Use current user ID (in real app this would come from auth context)
  const userId = 'current';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profileRes, teamsRes, activitiesRes] = await Promise.allSettled([
        userApi.getProfile(userId),
        userApi.getTeams(userId),
        userApi.getActivities(userId),
      ]);

      if (profileRes.status === 'fulfilled') {
        const data = (profileRes.value as any)?.data || profileRes.value;
        setProfile(data as UserProfileType);
      }
      if (teamsRes.status === 'fulfilled') {
        const data = (teamsRes.value as any)?.data || teamsRes.value;
        setTeams(Array.isArray(data) ? data : []);
      }
      if (activitiesRes.status === 'fulfilled') {
        const data = (activitiesRes.value as any)?.data || activitiesRes.value;
        setActivities(Array.isArray(data) ? data : []);
      }
    } catch {
      message.error('加载用户信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    if (profile) {
      form.setFieldsValue({
        username: profile.username,
        email: profile.email,
        phone: profile.phone,
      });
    }
    setEditVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await userApi.updateProfile(userId, values);
      message.success('更新成功');
      setEditVisible(false);
      loadData();
    } catch {
      message.error('更新失败');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: spacing.lg, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.md }}>
        <UserOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        个人中心
      </Title>

      <Row gutter={[16, 16]}>
        {/* Profile Card */}
        <Col xs={24} md={8}>
          <Card>
            <div style={{ textAlign: 'center', marginBottom: spacing.lg }}>
              <Avatar size={80} icon={<UserOutlined />} src={profile?.avatar} />
              <Title level={4} style={{ marginTop: spacing[3], marginBottom: 4 }}>
                {profile?.username || '未知用户'}
              </Title>
              <Tag color={ROLE_COLORS[profile?.role || ''] || 'default'}>
                {profile?.role || '未知角色'}
              </Tag>
            </div>

            <Descriptions column={1} size="small">
              <Descriptions.Item label={<><MailOutlined /> 邮箱</>}>
                {profile?.email || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={<><PhoneOutlined /> 手机</>}>
                {profile?.phone || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={profile?.status === 'active' ? 'green' : 'red'}>
                  {profile?.status === 'active' ? '活跃' : '未激活'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="注册时间">
                {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('zh-CN') : '-'}
              </Descriptions.Item>
            </Descriptions>

            <Button
              type="primary"
              icon={<EditOutlined />}
              block
              style={{ marginTop: spacing.md }}
              onClick={handleEdit}
            >
              编辑资料
            </Button>
          </Card>
        </Col>

        {/* Detail Tabs */}
        <Col xs={24} md={16}>
          <Card>
            <Tabs
              items={[
                {
                  key: 'teams',
                  label: (
                    <span>
                      <TeamOutlined /> 所属团队
                    </span>
                  ),
                  children: teams.length > 0 ? (
                    <List
                      dataSource={teams}
                      renderItem={(team) => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={<Avatar icon={<TeamOutlined />} />}
                            title={team.name}
                            description={`角色: ${team.role}`}
                          />
                        </List.Item>
                      )}
                    />
                  ) : (
                    <Empty description="暂无团队信息" />
                  ),
                },
                {
                  key: 'activities',
                  label: (
                    <span>
                      <HistoryOutlined /> 最近活动
                    </span>
                  ),
                  children: activities.length > 0 ? (
                    <List
                      dataSource={activities.slice(0, 10)}
                      renderItem={(activity) => (
                        <List.Item>
                          <List.Item.Meta
                            title={activity.action}
                            description={
                              <Space>
                                {activity.resourceType && <Tag>{activity.resourceType}</Tag>}
                                <Text type="secondary">
                                  {new Date(activity.createdAt).toLocaleString('zh-CN')}
                                </Text>
                              </Space>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  ) : (
                    <Empty description="暂无活动记录" />
                  ),
                },
                {
                  key: 'permissions',
                  label: (
                    <span>
                      <SafetyCertificateOutlined /> 权限
                    </span>
                  ),
                  children: profile?.permissions && profile.permissions.length > 0 ? (
                    <List
                      dataSource={profile.permissions}
                      renderItem={(perm) => (
                        <List.Item>
                          <List.Item.Meta
                            title={perm.resource}
                            description={
                              <Space>
                                {perm.actions.map((a) => (
                                  <Tag key={a} color="blue">{a}</Tag>
                                ))}
                              </Space>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  ) : (
                    <Empty description="暂无权限信息" />
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* Edit Modal */}
      <Modal
        title="编辑个人资料"
        open={editVisible}
        onOk={handleSave}
        onCancel={() => setEditVisible(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item label="邮箱" name="email" rules={[{ type: 'email', message: '请输入有效邮箱' }]}>
            <Input prefix={<MailOutlined />} />
          </Form.Item>
          <Form.Item label="手机" name="phone">
            <Input prefix={<PhoneOutlined />} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
