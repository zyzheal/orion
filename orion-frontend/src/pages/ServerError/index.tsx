/**
 * 500 - 服务器内部错误
 *
 * 增强功能：
 * - 重试按钮
 * - 错误信息展示
 * - 常用导航链接
 * - 设计规范样式
 */
import React, { useState } from 'react';
import { Result, Button, Space, Card, Typography, Descriptions } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  HomeOutlined,
  ProjectOutlined,
  AlertOutlined,
  SettingOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface ServerErrorProps {
  errorId?: string;
  message?: string;
}

const QUICK_LINKS = [
  { path: '/', label: '工作台', icon: <HomeOutlined /> },
  { path: '/pipelines', label: 'Pipeline', icon: <ProjectOutlined /> },
  { path: '/alerts', label: '告警中心', icon: <AlertOutlined /> },
  { path: '/tickets', label: '工单系统', icon: <SettingOutlined /> },
];

const ServerError: React.FC<ServerErrorProps> = ({
  errorId,
  message = '服务器遇到一个错误，无法完成您的请求。',
}) => {
  const navigate = useNavigate();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    // 刷新当前页面
    window.location.reload();
  };

  // 生成错误 ID（用于运维排查）
  const displayErrorId =
    errorId || `ERR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.light.bg.secondary,
        padding: spacing[6],
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 640,
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 500 状态 */}
          <Result
            status="error"
            title={
              <Title level={1} style={{ color: colors.neutral[900], fontSize: 72, lineHeight: 1 }}>
                500
              </Title>
            }
            subTitle={
              <Text type="secondary" style={{ fontSize: 16 }}>
                {message}
              </Text>
            }
            extra={
              <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: spacing.lg }}>
                {/* 错误信息 */}
                <Descriptions
                  size="small"
                  column={1}
                  bordered
                  style={{ background: colors.light.bg.primary, borderRadius: 8 }}
                >
                  <Descriptions.Item label="错误 ID">
                    <Text code>{displayErrorId}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="建议操作">
                    <Space direction="vertical" size={4}>
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        1. 点击"重新加载"尝试恢复
                      </Text>
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        2. 如问题持续，请联系运维并提供错误 ID
                      </Text>
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        3. 或前往其他功能页面继续工作
                      </Text>
                    </Space>
                  </Descriptions.Item>
                </Descriptions>

                {/* 操作按钮 */}
                <Space>
                  <Button
                    type="primary"
                    icon={<ReloadOutlined />}
                    onClick={handleRetry}
                    loading={retrying}
                    size="large"
                    style={{ borderRadius: 6, minWidth: 140 }}
                  >
                    重新加载
                  </Button>
                  <Button
                    size="large"
                    icon={<HomeOutlined />}
                    onClick={() => navigate('/')}
                    style={{ borderRadius: 6, minWidth: 140 }}
                  >
                    返回首页
                  </Button>
                  <Button
                    size="large"
                    onClick={() => navigate(-1)}
                    style={{ borderRadius: 6, minWidth: 140 }}
                  >
                    返回上页
                  </Button>
                </Space>
              </Space>
            }
          />

          {/* 快捷导航 */}
          <div style={{ borderTop: `1px solid ${colors.light.border.light}`, paddingTop: spacing.lg }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
              或者访问其他功能页面：
            </Text>
            <Space wrap style={{ justifyContent: 'center' }}>
              {QUICK_LINKS.map((link) => (
                <Card
                  key={link.path}
                  size="small"
                  hoverable
                  onClick={() => navigate(link.path)}
                  style={{
                    minWidth: 120,
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: `1px solid ${colors.light.border.light}`,
                  }}
                >
                  <Space direction="vertical" align="center" size={4}>
                    <span style={{ color: colors.primary[500], fontSize: 20 }}>{link.icon}</span>
                    <Text style={{ fontSize: 13 }}>{link.label}</Text>
                  </Space>
                </Card>
              ))}
            </Space>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default ServerError;
