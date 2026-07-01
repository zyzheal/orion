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
import { useAppStore } from '@/stores/appStore';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

const menuItems = [
  { key: '/observability/monitoring/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/observability/monitoring/metrics', icon: <LineChartOutlined />, label: 'Metrics' },
  { key: '/observability/monitoring/alerts', icon: <BellOutlined />, label: 'Alerts' },
  { key: '/observability/monitoring/rules', icon: <SafetyOutlined />, label: 'Rules' },
  { key: '/observability/monitoring/channels', icon: <MailOutlined />, label: 'Channels' },
];

const pageTitleMap: Record<string, { icon: React.ReactNode; title: string; subtitle: string }> = {
  '/observability/monitoring/dashboard': { icon: <DashboardOutlined />, title: 'Dashboard', subtitle: '监控总览仪表板' },
  '/observability/monitoring/metrics': { icon: <LineChartOutlined />, title: 'Metrics', subtitle: '指标查询与分析' },
  '/observability/monitoring/alerts': { icon: <BellOutlined />, title: 'Alerts', subtitle: '告警管理与响应' },
  '/observability/monitoring/rules': { icon: <SafetyOutlined />, title: 'Rules', subtitle: '告警规则配置' },
  '/observability/monitoring/channels': { icon: <MailOutlined />, title: 'Channels', subtitle: '通知渠道管理' },
};

// 统一的 Layout 配置
const LAYOUT_CONFIG = {
  siderWidth: 220,
  titleLevel: 5 as const,
  headerPadding: `${spacing[4]}px ${spacing[3]}px ${spacing[2]}px`,
};

const MonitoringLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  // 从全局 store 获取主题（响应式）
  const theme = useAppStore((state) => state.theme);
  const isDark = theme === 'dark';

  const selectedKey = location.pathname;
  const pageInfo = pageTitleMap[selectedKey] || { icon: null, title: 'Monitoring', subtitle: '' };

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
            background: isDark ? colors.dark.bg.primary : colors.light.bg.primary,
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

export default MonitoringLayout;
