/**
 * UserSettings - 个人设置页面 (主入口)
 *
 * P2-9 Phase 101 refactor: 已抽取
 *   - useUserSettingsState (state + handlers)
 *   - buildTokenColumns (columns.tsx)
 *   - ProfileTab / SecurityTab / NotificationTab / OAuthTab / TokensTab (Components/)
 *   - constants.ts (interfaces + constants)
 */
import React from 'react';
import { Tabs, Typography } from 'antd';
import {
  UserOutlined,
  LockOutlined,
  BellOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { spacing } from '@/tokens';
import { useUserSettingsState } from './useUserSettingsState';
import { ProfileTab } from './Components/ProfileTab';
import { SecurityTab } from './Components/SecurityTab';
import { NotificationTab } from './Components/NotificationTab';
import { OAuthTab } from './Components/OAuthTab';
import { TokensTab } from './Components/TokensTab';

const { Title } = Typography;

export const UserSettingsPage: React.FC = () => {
  const state = useUserSettingsState();

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
        <ProfileTab
          form={state.form}
          user={state.user}
          loading={state.profileLoading}
          onFinish={state.handleProfileUpdate}
        />
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
        <SecurityTab
          form={state.passwordForm}
          loading={state.passwordLoading}
          onFinish={state.handlePasswordChange}
        />
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
        <NotificationTab
          form={state.notificationForm}
          loading={state.notificationLoading}
          onFinish={state.handleNotificationSave}
        />
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
        <OAuthTab oauthBindings={state.oauthBindings} onBind={state.handleOAuthBind} />
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
        <TokensTab
          tokens={state.tokens}
          loading={state.tokenLoading}
          onCreate={state.handleCreateToken}
          onDelete={state.handleDeleteToken}
        />
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <Title level={3} style={{ marginBottom: spacing.lg }}>
        个人设置
      </Title>
      <Tabs
        activeKey={state.activeTab}
        onChange={state.setActiveTab}
        items={tabItems}
        style={{ marginTop: spacing.md }}
      />
    </div>
  );
};

export default UserSettingsPage;
