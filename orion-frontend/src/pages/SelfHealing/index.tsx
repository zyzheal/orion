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
const { Title, Text } = Typography;

// 统一菜单项配置
const menuItems = [
  { key: '/observability/self-healing/incidents', icon: <MedicineBoxOutlined />, label: 'Incidents' },
  { key: '/observability/self-healing/history', icon: <HistoryOutlined />, label: 'Healing History' },
  { key: '/observability/self-healing/strategies', icon: <ExperimentOutlined />, label: 'Strategies' },
  { key: '/observability/self-healing/approvals', icon: <CheckSquareOutlined />, label: 'Approval Queue' },
  { key: '/observability/self-healing/effectiveness', icon: <DashboardOutlined />, label: 'Effectiveness' },
];

const pageTitleMap: Record<string, { icon: React.ReactNode; title: string; subtitle: string }> = {
  '/observability/self-healing/incidents': { icon: <MedicineBoxOutlined />, title: 'Incidents', subtitle: '当前待处理的自我修复事件' },
  '/observability/self-healing/history': { icon: <HistoryOutlined />, title: 'Healing History', subtitle: '查看历史修复记录' },
  '/observability/self-healing/strategies': { icon: <ExperimentOutlined />, title: 'Strategies', subtitle: '管理修复策略配置' },
  '/observability/self-healing/approvals': { icon: <CheckSquareOutlined />, title: 'Approval Queue', subtitle: '待审核的修复操作' },
  '/observability/self-healing/effectiveness': { icon: <DashboardOutlined />, title: 'Effectiveness', subtitle: '自我修复效果分析' },
};

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

  const selectedKey = location.pathname;
  const pageInfo = pageTitleMap[selectedKey] || { icon: null, title: 'Self-Healing', subtitle: '' };

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
          selectedKeys={[selectedKey]}
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

export default SelfHealingLayout;
