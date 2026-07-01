/**
 * Code Management - Layout with Sider Navigation
 * Provides sidebar menu for Repositories, Branch Policies, CODEOWNERS, and Webhook Logs
 */
import React, { useState } from 'react';
import { Layout, Menu, Typography } from 'antd';
import { colors, spacing } from '@/tokens';
import {
  FolderOutlined,
  BranchesOutlined,
  TeamOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

const menuItems = [
  {
    key: '/code-mgmt',
    icon: <FolderOutlined />,
    label: 'Repositories',
  },
  {
    key: '/code-mgmt/branch-policies',
    icon: <BranchesOutlined />,
    label: 'Branch Policies',
  },
  {
    key: '/code-mgmt/codeowners',
    icon: <TeamOutlined />,
    label: 'CODEOWNERS',
  },
  {
    key: '/code-mgmt/webhook-logs',
    icon: <CloudServerOutlined />,
    label: 'Webhook Logs',
  },
];

const pageTitleMap: Record<string, { icon: React.ReactNode; title: string; subtitle: string }> = {
  '/code-mgmt': { icon: <FolderOutlined />, title: 'Repositories', subtitle: '管理代码仓库' },
  '/code-mgmt/branch-policies': { icon: <BranchesOutlined />, title: 'Branch Policies', subtitle: '配置分支保护策略' },
  '/code-mgmt/codeowners': { icon: <TeamOutlined />, title: 'CODEOWNERS', subtitle: '管理代码负责人' },
  '/code-mgmt/webhook-logs': { icon: <CloudServerOutlined />, title: 'Webhook Logs', subtitle: '查看 Webhook 事件日志' },
};

const CodeMgmtLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  // Determine selected key based on current path
  const selectedKey =
    menuItems.find((item) => {
      if (item.key === '/code-mgmt') {
        return location.pathname === '/code-mgmt';
      }
      return location.pathname.startsWith(item.key);
    })?.key || '/code-mgmt';

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const pageInfo = pageTitleMap[selectedKey] || { icon: null, title: 'Code Management', subtitle: '' };

  return (
    <Layout style={{ minHeight: 'calc(100vh - 64px)' }}>
      <Sider
        width={220}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{
          background: colors.light.bg.primary,
          borderRight: `1px solid ${colors.light.border.light}`,
          padding: '8px 0',
        }}
        theme="light"
      >
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 'none' }}
        />
      </Sider>
      <Layout>
        <Content
          style={{
            padding: spacing.lg,
            margin: 0,
            minHeight: 280,
            background: colors.light.bg.primary,
          }}
        >
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
    </Layout>
  );
};

export default CodeMgmtLayout;
