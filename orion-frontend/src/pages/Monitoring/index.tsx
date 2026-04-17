/**
 * Monitoring Module Layout
 * Sidebar navigation for Monitoring sub-pages: Dashboard, Metrics, Alerts, Rules, Channels
 */
import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography } from 'antd';
import {
  DashboardOutlined,
  LineChartOutlined,
  BellOutlined,
  SafetyOutlined,
  MailOutlined,
} from '@ant-design/icons';

const { Sider, Content } = Layout;
const { Title } = Typography;

const menuItems = [
  { key: '/monitoring/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/monitoring/metrics', icon: <LineChartOutlined />, label: 'Metrics' },
  { key: '/monitoring/alerts', icon: <BellOutlined />, label: 'Alerts' },
  { key: '/monitoring/rules', icon: <SafetyOutlined />, label: 'Rules' },
  { key: '/monitoring/channels', icon: <MailOutlined />, label: 'Channels' },
];

const MonitoringLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const selectedKey = location.pathname;

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  return (
    <Layout style={{ minHeight: 'calc(100vh - 64px)' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="light"
        style={{ borderRight: '1px solid #f0f0f0' }}
        width={220}
      >
        {!collapsed && (
          <div style={{ padding: '16px 12px 8px' }}>
            <Title level={5} style={{ margin: 0, color: '#1890ff' }}>
              Monitoring
            </Title>
          </div>
        )}
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
            background: '#fff',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MonitoringLayout;
