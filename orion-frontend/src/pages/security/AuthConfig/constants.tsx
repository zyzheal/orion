/**
 * AuthConfig constants
 * 抽取自 index.tsx (P2-9 Phase 203)
 */
import React from 'react';
import {
  GlobalOutlined,
  KeyOutlined,
  LockOutlined,
  UserSwitchOutlined,
  BellOutlined,
} from '@ant-design/icons';
import type { ProviderStatus, ProviderType } from './types';

export const TYPE_CONFIG: Record<
  ProviderType,
  { label: string; color: string; icon: React.ReactNode }
> = {
  oauth2: { label: 'OAuth2', color: 'blue', icon: <GlobalOutlined /> },
  oidc: { label: 'OIDC', color: 'purple', icon: <KeyOutlined /> },
  sso_saml: { label: 'SAML SSO', color: 'cyan', icon: <UserSwitchOutlined /> },
  ldap: { label: 'LDAP', color: 'green', icon: <LockOutlined /> },
  mfa: { label: 'MFA', color: 'orange', icon: <BellOutlined /> },
};

export const STATUS_CONFIG: Record<ProviderStatus, { label: string; color: string }> = {
  active: { label: '活跃', color: 'success' },
  inactive: { label: '未启用', color: 'default' },
  error: { label: '错误', color: 'error' },
};

export const TYPE_OPTIONS = [
  { value: 'oauth2', label: 'OAuth2' },
  { value: 'oidc', label: 'OIDC' },
  { value: 'sso_saml', label: 'SAML SSO' },
  { value: 'ldap', label: 'LDAP' },
  { value: 'mfa', label: 'MFA' },
];
