import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography } from 'antd';
import {
  CheckSquareOutlined,
  CheckCircleOutlined,
  BellOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

const menuItems = [
  { key: '/console/confirmations/pending', icon: <CheckSquareOutlined />, label: '确认工作台' },
  { key: '/console/confirmations/batch', icon: <CheckCircleOutlined />, label: '批量确认' },
  { key: '/console/confirmations/notifications', icon: <BellOutlined />, label: '通知设置' },
  { key: '/console/confirmations/audit', icon: <AuditOutlined />, label: '审计日志' },
];

const pageTitleMap: Record<string, { icon: React.ReactNode; title: string; subtitle: string }> = {
  '/console/confirmations/pending': { icon: <CheckSquareOutlined />, title: '确认工作台', subtitle: '处理待确认事项' },
  '/console/confirmations/batch': { icon: <CheckCircleOutlined />, title: '批量确认', subtitle: '批量确认操作' },
  '/console/confirmations/notifications': { icon: <BellOutlined />, title: '通知设置', subtitle: '配置确认通知' },
  '/console/confirmations/audit': { icon: <AuditOutlined />, title: '审计日志', subtitle: '查看确认审计记录' },
};

const ConfirmationLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const selectedKey = location.pathname;
  const pageInfo = pageTitleMap[selectedKey] || { icon: null, title: '确认工作台', subtitle: '' };

  return (
    <Layout style={{ minHeight: '100%' }}>
      <Sider
        width={200}
        theme="light"
        style={{ borderRight: `1px solid ${colors.light.border.light}` }}
      >
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Content style={{ padding: spacing.lg, background: colors.light.bg.primary }}>
        {pageInfo.title && (
          <div style={{ marginBottom: spacing.md }}>
            <Title level={2} style={{ marginBottom: spacing.sm }}>
              {pageInfo.icon && <span style={{ marginRight: spacing[3], color: colors.primary[500] }}>{pageInfo.icon}</span>}
              {pageInfo.title}
            </Title>
            {pageInfo.subtitle && (
              <Text type="secondary">{pageInfo.subtitle}</Text>
            )}
          </div>
        )}
        <Outlet />
      </Content>
    </Layout>
  );
};

export default ConfirmationLayout;
