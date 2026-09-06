/**
 * useUserSettingsState.ts - UserSettings 状态钩子
 * 抽取自 UserSettings/index.tsx (P2-9 Phase 101)
 */
import { useState, useEffect } from 'react';
import { Form, message } from 'antd';
import { useAuth } from '@/hooks/useAuth';
import { userApi, UserProfile, UserToken, NotificationPreferences } from '@/api/user';
import {
  type ProfileFormValues,
  type PasswordFormValues,
  type NotificationFormValues,
  DEFAULT_OAUTH_BINDINGS,
} from './constants';

export const useUserSettingsState = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);

  const [form] = Form.useForm<ProfileFormValues>();
  const [passwordForm] = Form.useForm<PasswordFormValues>();
  const [notificationForm] = Form.useForm<NotificationFormValues>();

  const [tokens, setTokens] = useState<UserToken[]>([]);
  const oauthBindings = DEFAULT_OAUTH_BINDINGS;

  useEffect(() => {
    if (user?.id) {
      loadProfile();
      loadNotificationPreferences();
      loadTokens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadProfile = async () => {
    if (!user?.id) return;
    try {
      const response = await userApi.getProfile(user.id);
      const profile = (response.data as UserProfile) ?? {};
      form.setFieldsValue({
        displayName: profile.username,
        phone: profile.phone,
      });
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const loadNotificationPreferences = async () => {
    if (!user?.id) return;
    try {
      const response = await userApi.getNotificationPreferences(user.id);
      const prefs = response.data as NotificationPreferences;
      notificationForm.setFieldsValue({
        emailEnabled: prefs.emailEnabled,
        inAppEnabled: prefs.inAppEnabled,
        webhookEnabled: prefs.webhookEnabled,
        webhookUrl: prefs.webhookUrl,
        notifyFrequency: prefs.notifyFrequency,
      });
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    }
  };

  const loadTokens = async () => {
    if (!user?.id) return;
    try {
      const response = await userApi.getTokens(user.id);
      const tokenList = (response.data as UserToken[]) ?? [];
      setTokens(tokenList);
    } catch (error) {
      console.error('Failed to load tokens:', error);
    }
  };

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

  const handleOAuthBind = (provider: string) => {
    message.info(`正在跳转到 ${provider} 授权页面...`);
  };

  return {
    user,
    activeTab,
    setActiveTab,
    profileLoading,
    passwordLoading,
    notificationLoading,
    tokenLoading,
    form,
    passwordForm,
    notificationForm,
    tokens,
    setTokens,
    oauthBindings,
    loadProfile,
    loadNotificationPreferences,
    loadTokens,
    handleProfileUpdate,
    handlePasswordChange,
    handleNotificationSave,
    handleCreateToken,
    handleDeleteToken,
    handleOAuthBind,
  };
};

export type UserSettingsState = ReturnType<typeof useUserSettingsState>;
