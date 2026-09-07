/**
 * Login LoginForm (right side)
 * 抽取自 index.tsx (P2-9 Phase 179)
 */
import React from 'react';
import { Form, Input, Button, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { colors, spacing, themeVars } from '@/tokens';
import { useIntl } from '@/i18n';

const { Title, Text } = Typography;

interface LoginFormValues {
  username: string;
  password: string;
}

interface LoginFormProps {
  form: React.FormInstance<LoginFormValues>;
  isLoading: boolean;
  onSubmit: (values: LoginFormValues) => void;
}

export const LoginForm = ({ form, isLoading, onSubmit }: LoginFormProps): React.ReactElement => {
  const { t } = useIntl();

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 420,
        padding: '0 40px',
        position: 'relative',
        zIndex: 1,
      }}
    >
      <div style={{ marginBottom: 40 }}>
        <Title
          level={2}
          style={TITLE_STYLE}
        >
          {t('login.welcome')}
        </Title>
        <Text style={SUBTITLE_STYLE}>{t('login.subtitle')}</Text>
      </div>

      <Form
        form={form}
        name="login"
        onFinish={onSubmit}
        autoComplete="off"
        size="large"
        layout="vertical"
      >
        <Form.Item
          name="username"
          rules={[{ required: true, message: t('login.usernameRequired') }]}
          style={{ marginBottom: spacing.lg }}
        >
          <div>
            <Text style={LABEL_STYLE}>用户名</Text>
            <Input
              prefix={<UserOutlined style={{ color: themeVars.textDisabled }} />}
              placeholder={t('login.username')}
              autoComplete="username"
              style={INPUT_STYLE}
            />
          </div>
        </Form.Item>

        <Form.Item
          name="password"
          rules={[{ required: true, message: t('login.passwordRequired') }]}
          style={{ marginBottom: spacing.xl }}
        >
          <div>
            <Text style={LABEL_STYLE}>密码</Text>
            <Input.Password
              prefix={<LockOutlined style={{ color: themeVars.textDisabled }} />}
              placeholder={t('login.password')}
              autoComplete="current-password"
              style={INPUT_STYLE}
            />
          </div>
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={isLoading}
            block
            size="large"
            style={SUBMIT_BTN_STYLE}
          >
            {isLoading ? t('login.signingIn') : t('login.signIn')}
          </Button>
        </Form.Item>
      </Form>

      <div style={{ marginTop: 32, textAlign: 'center' }}>
        <Text style={{ fontSize: 12, color: themeVars.textDisabled }}>
          {t('login.loginFailed')}
        </Text>
      </div>
    </div>
  );
};

const TITLE_STYLE: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  color: themeVars.textPrimary,
  marginBottom: spacing.sm,
  letterSpacing: '-0.3px',
};

const SUBTITLE_STYLE: React.CSSProperties = {
  fontSize: 15,
  color: themeVars.textTertiary,
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: themeVars.textSecondary,
  marginBottom: spacing.sm,
  display: 'block',
};

const INPUT_STYLE: React.CSSProperties = {
  height: 48,
  borderRadius: 10,
  border: `1px solid ${themeVars.borderDefault}`,
  fontSize: 14,
};

const SUBMIT_BTN_STYLE: React.CSSProperties = {
  height: 48,
  borderRadius: 10,
  fontSize: 15,
  fontWeight: 600,
  background: `linear-gradient(135deg, ${colors.primary[500]} 0%, ${colors.primary[600]} 100%)`,
  border: 'none',
  boxShadow: `0 4px 14px ${colors.primary[300]}40`,
};
