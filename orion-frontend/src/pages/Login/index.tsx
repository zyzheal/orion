import React, { useState, useEffect } from 'react';
import { Form, Input, Button, message, Typography } from 'antd';
import {
  UserOutlined,
  LockOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  SafetyOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getEnabledSsoProviders } from '@/api/auth';
import { colors } from '@/tokens';

const { Title, Text } = Typography;

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

// 左侧装饰特性列表
const features = [
  { icon: <RocketOutlined />, title: '智能流水线', desc: 'AI 驱动的 CI/CD 自动化' },
  { icon: <SafetyOutlined />, title: '安全治理', desc: '全链路安全策略与合规' },
  { icon: <ThunderboltOutlined />, title: '效能洞察', desc: '研发效能度量与分析' },
  { icon: <CheckCircleOutlined />, title: '自愈系统', desc: '自动化故障检测与恢复' },
];

// 左侧背景装饰图形
const DecorativeCircles: React.FC = () => (
  <svg
    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    viewBox="0 0 600 800"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="450" cy="120" r="200" fill="rgba(255,255,255,0.03)" />
    <circle cx="500" cy="650" r="180" fill="rgba(255,255,255,0.02)" />
    <circle cx="100" cy="500" r="150" fill="rgba(255,255,255,0.025)" />
    <circle cx="350" cy="400" r="300" fill="rgba(255,255,255,0.015)" />
    <line x1="0" y1="200" x2="600" y2="200" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
    <line x1="0" y1="400" x2="600" y2="400" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
    <line x1="0" y1="600" x2="600" y2="600" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
  </svg>
);

const Login: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const [form] = Form.useForm<LoginFormData>();
  const [_ssoProviders, setSsoProviders] = useState<SsoProvider[]>([]);
  const [_loadingProviders, setLoadingProviders] = useState(false);

  // Phase 3.8.3: 动态获取可用 SSO 提供商
  useEffect(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('token_expires_at');

    // 获取启用的 SSO 提供商
    setLoadingProviders(true);
    getEnabledSsoProviders()
      .then((providers) => {
        if (Array.isArray(providers) && providers.length > 0) {
          setSsoProviders(providers);
        }
      })
      .catch(() => {
        // 静默失败，不影响本地登录
      })
      .finally(() => {
        setLoadingProviders(false);
      });
  }, []);

  const handleSubmit = async (values: LoginFormData) => {
    const result = await login(values);
    if (result.success) {
      message.success('登录成功');
      const from = (location.state as { from?: { pathname?: string } })?.from?.pathname ?? '/dashboard';
      navigate(from, { replace: true });
    } else {
      if (result.error && typeof result.error === 'object' && 'message' in result.error) {
        message.error(`登录失败：${(result.error as Error).message}`);
      } else {
        message.error('登录失败，请检查用户名和密码');
      }
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
      {/* ===== 左侧品牌展示区 ===== */}
      <div
        style={{
          flex: '0 0 480px',
          background: `linear-gradient(160deg, ${colors.primary[700]} 0%, ${colors.primary[900]} 40%, ${colors.primary[900]} 100%)`,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px 40px',
        }}
      >
        <DecorativeCircles />

        {/* 顶部 Logo */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/logo.svg" alt="Orion" style={{ width: 40, height: 40 }} />
            <span style={{ fontSize: 22, fontWeight: 700, color: colors.neutral[0], letterSpacing: '0.5px' }}>
              Orion Platform
            </span>
          </div>
        </div>

        {/* 中间内容 */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Title
            level={1}
            style={{
              color: colors.neutral[0],
              fontSize: 36,
              fontWeight: 700,
              lineHeight: 1.3,
              marginBottom: 16,
              letterSpacing: '-0.5px',
            }}
          >
            让工具链
            <br />
            变得更聪明
          </Title>
          <Text
            style={{
              color: 'rgba(255,255,255,0.65)',
              fontSize: 15,
              lineHeight: 1.8,
              display: 'block',
              marginBottom: 40,
            }}
          >
            Orion 不替代现有工具链，而是通过 AI 能力
            <br />
            让 Tekton、Knative、Prometheus 和 K8s 协同工作
          </Text>

          {/* 特性列表 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {features.map((f, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 18px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.06)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  transition: 'all 0.3s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateX(0)';
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    color: colors.primary[300],
                    flexShrink: 0,
                  }}
                >
                  {f.icon}
                </div>
                <div>
                  <div style={{ color: colors.neutral[0], fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{f.title}</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 底部版权 */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
            Orion Platform ©{new Date().getFullYear()} · AI-Driven DevOps
          </Text>
        </div>
      </div>

      {/* ===== 右侧登录表单区 ===== */}
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
        {/* 背景装饰 */}
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

        <div
          style={{
            width: '100%',
            maxWidth: 420,
            padding: '0 40px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* 表单头部 */}
          <div style={{ marginBottom: 40 }}>
            <Title
              level={2}
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: colors.light.text.primary,
                marginBottom: 8,
                letterSpacing: '-0.3px',
              }}
            >
              欢迎回来
            </Title>
            <Text style={{ fontSize: 15, color: colors.light.text.tertiary }}>
              登录你的 Orion 账户以继续使用平台
            </Text>
          </div>

          {/* 登录表单 */}
          <Form
            form={form}
            name="login"
            onFinish={handleSubmit}
            autoComplete="off"
            size="large"
            layout="vertical"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
              style={{ marginBottom: 24 }}
            >
              <div>
                <Text style={{ fontSize: 13, fontWeight: 500, color: colors.light.text.secondary, marginBottom: 8, display: 'block' }}>
                  用户名
                </Text>
                <Input
                  prefix={<UserOutlined style={{ color: colors.light.text.disabled }} />}
                  placeholder="请输入用户名"
                  autoComplete="username"
                  style={{
                    height: 48,
                    borderRadius: 10,
                    border: `1px solid ${colors.light.border.default}`,
                    fontSize: 14,
                  }}
                />
              </div>
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
              style={{ marginBottom: 32 }}
            >
              <div>
                <Text style={{ fontSize: 13, fontWeight: 500, color: colors.light.text.secondary, marginBottom: 8, display: 'block' }}>
                  密码
                </Text>
                <Input.Password
                  prefix={<LockOutlined style={{ color: colors.light.text.disabled }} />}
                  placeholder="请输入密码"
                  autoComplete="current-password"
                  style={{
                    height: 48,
                    borderRadius: 10,
                    border: `1px solid ${colors.light.border.default}`,
                    fontSize: 14,
                  }}
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
                style={{
                  height: 48,
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 600,
                  background: `linear-gradient(135deg, ${colors.primary[500]} 0%, ${colors.primary[600]} 100%)`,
                  border: 'none',
                  boxShadow: `0 4px 14px ${colors.primary[300]}40`,
                }}
              >
                登 录
              </Button>
            </Form.Item>
          </Form>

          {/* 底部提示 */}
          <div style={{ marginTop: 32, textAlign: 'center' }}>
            <Text style={{ fontSize: 12, color: colors.light.text.disabled }}>
              如遇登录问题，请联系平台管理员
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
