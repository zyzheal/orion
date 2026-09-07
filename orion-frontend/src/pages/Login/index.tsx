/**
 * Login Page
 * 组件化重构 (P2-9 Phase 179): 425→85 行
 */
import React, { useEffect, useState } from 'react';
import { Form, message } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useIntl } from '@/i18n';
import { getEnabledSsoProviders } from '@/api/auth';
import { colors } from '@/tokens';
import { BrandPanel } from './Components/BrandPanel';
import { LoginForm } from './Components/LoginForm';

interface LoginFormData {
  username: string;
  password: string;
}

interface SsoProvider {
  name: string;
  type: string;
  display_name: string;
  display_icon?: string;
}

const Login: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const { t } = useIntl();
  const [form] = Form.useForm<LoginFormData>();
  const [_ssoProviders, setSsoProviders] = useState<SsoProvider[]>([]);
  const [_loadingProviders, setLoadingProviders] = useState(false);

  useEffect(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('token_expires_at');

    setLoadingProviders(true);
    getEnabledSsoProviders()
      .then((providers) => {
        if (Array.isArray(providers) && providers.length > 0) {
          setSsoProviders(providers);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingProviders(false));
  }, []);

  const handleSubmit = async (values: LoginFormData) => {
    const result = await login(values);
    if (result.success) {
      message.success(t('login.loginSuccess'));
      const from =
        (location.state as { from?: { pathname?: string } })?.from?.pathname ?? '/dashboard';
      navigate(from, { replace: true });
    } else {
      if (result.error && typeof result.error === 'object' && 'message' in result.error) {
        message.error(`${t('login.loginFailed')}：${(result.error as Error).message}`);
      } else {
        message.error(t('login.loginFailed'));
      }
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <BrandPanel />

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: colors.neutral[50],
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -100,
            right: -100,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${colors.primary[50]} 0%, transparent 70%)`,
            opacity: 0.6,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -80,
            left: -80,
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${colors.purple[50]} 0%, transparent 70%)`,
            opacity: 0.4,
          }}
        />

        <LoginForm form={form} isLoading={isLoading} onSubmit={handleSubmit} />
      </div>
    </div>
  );
};

export default Login;
