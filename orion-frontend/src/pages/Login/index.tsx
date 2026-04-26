import React from 'react';
import { Form, Input, Button, Card, message, Typography } from 'antd';
import { spacing } from '@/tokens';
import { colors } from '@/tokens/colors';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const { Title } = Typography;

interface LoginFormData {
  username: string;
  password: string;
}

const Login: React.FC = () => {
  const location = useLocation();
  const { login, isLoading } = useAuth();
  const [form] = Form.useForm<LoginFormData>();

  const handleSubmit = async (values: LoginFormData) => {
    const result = await login(values);

    if (result.success) {
      message.success('登录成功');

      // 获取来源页面
      const from = location.state?.from?.pathname || '/dashboard';

      // 强制刷新以确保状态同步
      setTimeout(() => {
        window.location.href = from;
      }, 100);
    } else {
      console.error('[Login] Login failed:', result.error);
      message.error('登录失败，请检查用户名和密码');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${colors.primary[500]} 0%, ${colors.purple[500]} 100%)`,
      }}
    >
      <Card
        style={{
          width: 400,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2}>Orion Platform</Title>
          <Typography.Text type="secondary">欢迎登录</Typography.Text>
        </div>

        <Form
          form={form}
          name="login"
          onFinish={handleSubmit}
          autoComplete="off"
          size="large"
          initialValues={{
            username: 'admin',
            password: 'admin123',
          }}
        >
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" autoComplete="username" />
          </Form.Item>

          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={isLoading} block size="large">
              登录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Typography.Text type="secondary" style={{ fontSize: spacing[3] }}>
            默认账号：admin / admin123
          </Typography.Text>
        </div>
      </Card>
    </div>
  );
};

export default Login;
