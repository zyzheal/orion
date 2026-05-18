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
import { colors, spacing } from '@/tokens';

const { Sider, Content } = Layout;
const { Title } = Typography;

const menuItems = [
  { key: '/console/monitoring/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/console/monitoring/metrics', icon: <LineChartOutlined />, label: 'Metrics' },
  { key: '/console/monitoring/alerts', icon: <BellOutlined />, label: 'Alerts' },
  { key: '/console/monitoring/rules', icon: <SafetyOutlined />, label: 'Rules' },
  { key: '/console/monitoring/channels', icon: <MailOutlined />, label: 'Channels' },
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
        style={{ borderRight: `1px solid ${colors.light.border.light}` }}
        width={220}
      >
        {!collapsed && (
          <div style={{ padding: `${spacing[4]}px ${spacing[3]}px ${spacing[2]}px` }}>
            <Title level={5} style={{ margin: 0, color: colors.primary[500] }}>
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
            padding: spacing[6],
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

export default MonitoringLayout;
