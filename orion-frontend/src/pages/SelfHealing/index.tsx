/**
 * Self-Healing - Main Layout
 * Sidebar navigation for Self-Healing sub-pages
 */
import React, { useState } from 'react';
import { Layout, Menu, Typography } from 'antd';
import { colors } from '@/tokens';
import {
  MedicineBoxOutlined,
  HistoryOutlined,
  ExperimentOutlined,
  CheckSquareOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';

const { Sider, Content } = Layout;
const { Title } = Typography;

const menuItems = [
  { key: '/console/self-healing/incidents', icon: <MedicineBoxOutlined />, label: 'Incidents' },
  { key: '/console/self-healing/history', icon: <HistoryOutlined />, label: 'Healing History' },
  { key: '/console/self-healing/strategies', icon: <ExperimentOutlined />, label: 'Strategies' },
  { key: '/console/self-healing/approvals', icon: <CheckSquareOutlined />, label: 'Approval Queue' },
  { key: '/console/self-healing/effectiveness', icon: <DashboardOutlined />, label: 'Effectiveness' },
];

const SelfHealingLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

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
      >
        <div style={{ padding: '16px 12px' }}>
          <Title level={4} style={{ margin: 0 }}>
            {collapsed ? 'SH' : 'Self-Healing'}
          </Title>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Content style={{ margin: 0 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default SelfHealingLayout;
