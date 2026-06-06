/**
 * UserSettings - 个人设置页面
 * 提供用户资料、安全、通知、第三方登录、API Token 管理
 */

import React, { useState, useEffect } from 'react';
import {
  Tabs,
  Form,
  Input,
  Button,
  Card,
  Switch,
  message,
  Avatar,
  Upload,
  Table,
  Row,
  Col,
  Select,
  Space,
  Typography,
  Divider,
  Popconfirm,
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  BellOutlined,
  GithubOutlined,
  GitlabOutlined,
  KeyOutlined,
  UploadOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/hooks/useAuth';
import { userApi, UserToken } from '@/api/user';
import { colors } from '@/tokens/colors';
import { radius } from '@/tokens/radius';
import { shadows } from '@/tokens/shadows';
import type { ColumnsType } from 'antd/es/table';
import { spacing } from '@/tokens';

// API 响应包装接口
interface ApiResponse<T> { data?: T }

const { Title, Text } = Typography;

interface ProfileFormValues {
  displayName?: string;
  phone?: string;
}

interface PasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface NotificationFormValues {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  webhookEnabled: boolean;
  webhookUrl?: string;
  notifyFrequency: string;
}

interface OAuthBinding {
  provider: string;
  bound: boolean;
  bindTime?: string;
}

export const UserSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);

  const [form] = Form.useForm<ProfileFormValues>();
  const [passwordForm] = Form.useForm<PasswordFormValues>();
  const [notificationForm] = Form.useForm<NotificationFormValues>();

  // Token 列表状态
  const [tokens, setTokens] = useState<UserToken[]>([]);
  // OAuth 绑定状态（暂时写死，后续可从后端获取）
  const oauthBindings: OAuthBinding[] = [
    { provider: 'github', bound: false },
    { provider: 'gitlab', bound: false },
  ];

  // 加载初始数据
  useEffect(() => {
    if (user?.id) {
      loadProfile();
      loadNotificationPreferences();
      loadTokens();
    }
  }, [user?.id]);

  // 加载用户资料
  const loadProfile = async () => {
    if (!user?.id) return;
    try {
      const response = await userApi.getProfile(user.id);
      // api.get 返回 AxiosResponse<ApiResponse<T>>，需要 .data.data 获取实际数据
      const profile = (response as any)?.data ?? response;
      form.setFieldsValue({
        displayName: (profile as any)?.username,
        phone: (profile as any)?.phone,
      });
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  // 加载通知偏好
  const loadNotificationPreferences = async () => {
    if (!user?.id) return;
    try {
      const response = await userApi.getNotificationPreferences(user.id);
      const prefs = (response as any)?.data ?? response;
      notificationForm.setFieldsValue({
        emailEnabled: (prefs as any)?.emailEnabled,
        inAppEnabled: (prefs as any)?.inAppEnabled,
        webhookEnabled: (prefs as any)?.webhookEnabled,
        webhookUrl: (prefs as any)?.webhookUrl,
        notifyFrequency: (prefs as any)?.notifyFrequency,
      });
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    }
  };

  // 加载 Token 列表
  const loadTokens = async () => {
    if (!user?.id) return;
    try {
      const response = await userApi.getTokens(user.id);
      const tokenList = (response as ApiResponse<UserToken[]>)?.data ?? (response as ApiResponse<UserToken[]>)?.data ?? response;
      setTokens((tokenList || []) as UserToken[]);
    } catch (error) {
      console.error('Failed to load tokens:', error);
    }
  };

  // 处理资料更新
  const handleProfileUpdate = async (values: ProfileFormValues) => {
    if (!user?.id) return;
    setProfileLoading(true);
    try {
      await userApi.updateProfile(user.id, {
        username: values.displayName,
        phone: values.phone,
      });
      message.success('基本资料保存成功');
    } catch (error) {
      message.error('保存失败，请重试');
    } finally {
      setProfileLoading(false);
    }
  };

  // 处理密码修改
  const handlePasswordChange = async (values: PasswordFormValues) => {
    if (!user?.id) return;
    setPasswordLoading(true);
    try {
      await userApi.changePassword(user.id, values.currentPassword, values.newPassword);
      message.success('密码修改成功');
      passwordForm.resetFields();
    } catch (error) {
      message.error('密码修改失败，请检查当前密码');
    } finally {
      setPasswordLoading(false);
    }
  };

  // 处理通知偏好保存
  const handleNotificationSave = async (values: NotificationFormValues) => {
    if (!user?.id) return;
    setNotificationLoading(true);
    try {
      await userApi.updateNotificationPreferences(user.id, {
        emailEnabled: values.emailEnabled,
        inAppEnabled: values.inAppEnabled,
        webhookEnabled: values.webhookEnabled,
        webhookUrl: values.webhookUrl,
        notifyFrequency: values.notifyFrequency,
      });
      message.success('通知偏好保存成功');
    } catch (error) {
      message.error('保存失败，请重试');
    } finally {
      setNotificationLoading(false);
    }
  };

  // 处理创建 Token
  const handleCreateToken = async () => {
    if (!user?.id) return;
    setTokenLoading(true);
    try {
      const name = `Token-${new Date().toLocaleString('zh-CN')}`;
      await userApi.createToken(user.id, name, 90);
      message.success('Token 创建成功');
      loadTokens();
    } catch (error) {
      message.error('Token 创建失败');
    } finally {
      setTokenLoading(false);
    }
  };

  // 处理删除 Token
  const handleDeleteToken = async (tokenId: string) => {
    if (!user?.id) return;
    try {
      await userApi.deleteToken(user.id, tokenId);
      message.success('Token 已删除');
      loadTokens();
    } catch (error) {
      message.error('Token 删除失败');
    }
  };

  // OAuth 绑定处理
  const handleOAuthBind = (provider: string) => {
    // TODO: 实现 OAuth 绑定流程
    message.info(`正在跳转到 ${provider} 授权页面...`);
  };

  // Token 表格列配置
  const tokenColumns: ColumnsType<UserToken> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '过期时间',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      render: (text?: string) =>
        text ? new Date(text).toLocaleString('zh-CN') : '永不过期',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Popconfirm
          title="确定要删除这个 Token 吗？"
          onConfirm={() => handleDeleteToken(record.id)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  // Tab 配置
  const tabItems = [
    {
      key: 'profile',
      label: (
        <span>
          <UserOutlined />
          基本资料
        </span>
      ),
      children: (
        <Card
          style={{
            borderRadius: radius.lg,
            boxShadow: shadows.card,
          }}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleProfileUpdate}
            initialValues={{
              displayName: user?.username || '',
              email: user?.email || '',
            }}
          >
            {/* 头像上传 */}
            <Form.Item label="头像">
              <Space align="center">
                <Avatar
                  size={80}
                  src={user?.avatar}
                  icon={<UserOutlined />}
                  style={{ borderRadius: radius.full }}
                />
                <Upload showUploadList={false}>
                  <Button icon={<UploadOutlined />}>更换头像</Button>
                </Upload>
              </Space>
            </Form.Item>

            <Form.Item
              name="displayName"
              label="显示名称"
              rules={[{ required: true, message: '请输入显示名称' }]}
            >
              <Input placeholder="请输入显示名称" />
            </Form.Item>

            <Form.Item name="email" label="邮箱">
              <Input disabled placeholder="邮箱不可修改" />
            </Form.Item>

            <Form.Item name="phone" label="手机号">
              <Input placeholder="请输入手机号" />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={profileLoading}
                style={{
                  backgroundColor: colors.primary[500],
                  borderColor: colors.primary[500],
                  borderRadius: radius.sm,
                }}
              >
                保存修改
              </Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'security',
      label: (
        <span>
          <LockOutlined />
          安全设置
        </span>
      ),
      children: (
        <Card
          style={{
            borderRadius: radius.lg,
            boxShadow: shadows.card,
          }}
        >
          <Form
            form={passwordForm}
            layout="vertical"
            onFinish={handlePasswordChange}
          >
            <Form.Item
              name="currentPassword"
              label="当前密码"
              rules={[{ required: true, message: '请输入当前密码' }]}
            >
              <Input.Password placeholder="请输入当前密码" />
            </Form.Item>

            <Form.Item
              name="newPassword"
              label="新密码"
              rules={[
                { required: true, message: '请输入新密码' },
                { min: 8, message: '密码至少需要8位' },
              ]}
            >
              <Input.Password placeholder="请输入新密码（至少8位）" />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              label="确认新密码"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: '请确认新密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  },
                }),
              ]}
            >
              <Input.Password placeholder="请再次输入新密码" />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={passwordLoading}
                style={{
                  backgroundColor: colors.primary[500],
                  borderColor: colors.primary[500],
                  borderRadius: radius.sm,
                }}
              >
                修改密码
              </Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'notifications',
      label: (
        <span>
          <BellOutlined />
          通知偏好
        </span>
      ),
      children: (
        <Card
          style={{
            borderRadius: radius.lg,
            boxShadow: shadows.card,
          }}
        >
          <Form
            form={notificationForm}
            layout="vertical"
            onFinish={handleNotificationSave}
          >
            <Form.Item name="emailEnabled" label="邮件通知" valuePropName="checked">
              <Switch />
            </Form.Item>

            <Form.Item name="inAppEnabled" label="站内信" valuePropName="checked">
              <Switch />
            </Form.Item>

            <Divider />

            <Form.Item name="webhookEnabled" label="Webhook 推送" valuePropName="checked">
              <Switch />
            </Form.Item>

            <Form.Item name="webhookUrl" label="Webhook URL">
              <Input
                placeholder="请输入 Webhook URL"
                disabled={!notificationForm.getFieldValue('webhookEnabled')}
              />
            </Form.Item>

            <Form.Item name="notifyFrequency" label="通知频率">
              <Select
                placeholder="请选择通知频率"
                options={[
                  { label: '实时', value: 'realtime' },
                  { label: '每日汇总', value: 'daily' },
                  { label: '每周汇总', value: 'weekly' },
                ]}
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={notificationLoading}
                style={{
                  backgroundColor: colors.primary[500],
                  borderColor: colors.primary[500],
                  borderRadius: radius.sm,
                }}
              >
                保存偏好
              </Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'oauth',
      label: (
        <span>
          <KeyOutlined />
          第三方登录
        </span>
      ),
      children: (
        <div style={{ maxWidth: 600 }}>
          <Row gutter={[16, 16]}>
            {oauthBindings.map((binding) => (
              <Col span={24} key={binding.provider}>
                <Card
                  style={{
                    borderRadius: radius.lg,
                    boxShadow: shadows.card,
                  }}
                >
                  <Row align="middle" justify="space-between">
                    <Col>
                      <Space>
                        {binding.provider === 'github' ? (
                          <GithubOutlined style={{ fontSize: 24 }} />
                        ) : (
                          <GitlabOutlined style={{ fontSize: 24 }} />
                        )}
                        <Text strong style={{ textTransform: 'capitalize' }}>
                          {binding.provider}
                        </Text>
                      </Space>
                    </Col>
                    <Col>
                      {binding.bound ? (
                        <Space>
                          <Text type="success">已绑定</Text>
                          <Button danger size="small">
                            解绑
                          </Button>
                        </Space>
                      ) : (
                        <Button
                          type="primary"
                          onClick={() => handleOAuthBind(binding.provider)}
                          style={{
                            backgroundColor: colors.primary[500],
                            borderColor: colors.primary[500],
                            borderRadius: radius.sm,
                          }}
                        >
                          绑定
                        </Button>
                      )}
                    </Col>
                  </Row>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      ),
    },
    {
      key: 'tokens',
      label: (
        <span>
          <KeyOutlined />
          API Token
        </span>
      ),
      children: (
        <Card
          style={{
            borderRadius: radius.lg,
            boxShadow: shadows.card,
          }}
        >
          <Space style={{ marginBottom: spacing.md }}>
            <Button
              type="primary"
              onClick={handleCreateToken}
              loading={tokenLoading}
              style={{
                backgroundColor: colors.primary[500],
                borderColor: colors.primary[500],
                borderRadius: radius.sm,
              }}
            >
              创建 Token
            </Button>
          </Space>
          <Table
            columns={tokenColumns}
            dataSource={tokens}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: '暂无 Token，请点击上方按钮创建' }}
          />
        </Card>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <Title level={3} style={{ marginBottom: spacing.lg }}>
        个人设置
      </Title>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        style={{ marginTop: spacing.md }}
      />
    </div>
  );
};

export default UserSettingsPage;