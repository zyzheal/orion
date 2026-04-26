/**
 * Code Management - Layout with Sider Navigation
 * Provides sidebar menu for Repositories, Branch Policies, CODEOWNERS, and Webhook Logs
 */
import React, { useState } from 'react';
import { Layout, Menu } from 'antd';
import { colors } from '@/tokens';
import {
  FolderOutlined,
  BranchesOutlined,
  TeamOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const { Sider, Content } = Layout;

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

const CodeMgmtLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  // Determine selected key based on current path
  const selectedKey = menuItems.find((item) => {
    if (item.key === '/code-mgmt') {
      return location.pathname === '/code-mgmt';
    }
    return location.pathname.startsWith(item.key);
  })?.key || '/code-mgmt';

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

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
            padding: 24,
            margin: 0,
            minHeight: 280,
            background: colors.light.bg.primary,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default CodeMgmtLayout;
