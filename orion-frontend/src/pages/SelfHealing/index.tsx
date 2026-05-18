/**
 * Self-Healing - Main Layout
 * Sidebar navigation for Self-Healing sub-pages
 */
import React, { useState } from 'react';
import { Layout, Menu, Typography } from 'antd';
import { colors, spacing } from '@/tokens';
import {
  MedicineBoxOutlined,
  HistoryOutlined,
  ExperimentOutlined,
  CheckSquareOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';

const { Sider, Content } = Layout;
const { Title } = Typography;

// 统一菜单项配置
const menuItems = [
  { key: '/console/self-healing/incidents', icon: <MedicineBoxOutlined />, label: 'Incidents' },
  { key: '/console/self-healing/history', icon: <HistoryOutlined />, label: 'Healing History' },
  { key: '/console/self-healing/strategies', icon: <ExperimentOutlined />, label: 'Strategies' },
  { key: '/console/self-healing/approvals', icon: <CheckSquareOutlined />, label: 'Approval Queue' },
  { key: '/console/self-healing/effectiveness', icon: <DashboardOutlined />, label: 'Effectiveness' },
];

// 统一的 Layout 配置
const LAYOUT_CONFIG = {
  siderWidth: 220,
  titleLevel: 5 as const,
  headerPadding: `${spacing[4]}px ${spacing[3]}px ${spacing[2]}px`,
};

const SelfHealingLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  // 从全局 store 获取主题（响应式）
  const theme = useAppStore((state) => state.theme);
  const isDark = theme === 'dark';

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  return (
    <Layout style={{ minHeight: 'calc(100vh - 64px)' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme={theme}
        width={LAYOUT_CONFIG.siderWidth}
        style={{
          background: isDark ? colors.dark.bg.elevated : colors.light.bg.primary,
          borderRight: `1px solid ${isDark ? colors.dark.border.default : colors.light.border.light}`,
        }}
      >
        {!collapsed && (
          <div style={{ padding: LAYOUT_CONFIG.headerPadding }}>
            <Title level={LAYOUT_CONFIG.titleLevel} style={{ margin: 0, color: colors.primary[500] }}>
              Self-Healing
            </Title>
          </div>
        )}
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 'none' }}
        />
      </Sider>
      <Layout>
        <Content
          style={{
            margin: 0,
            padding: spacing[6],
            background: isDark ? colors.dark.bg.primary : colors.light.bg.primary,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default SelfHealingLayout;
