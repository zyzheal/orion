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

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

const menuItems = [
  { key: '/self-healing', icon: <MedicineBoxOutlined />, label: 'Incidents' },
  { key: '/self-healing/history', icon: <HistoryOutlined />, label: 'Healing History' },
  { key: '/self-healing/strategies', icon: <ExperimentOutlined />, label: 'Strategies' },
  { key: '/self-healing/approvals', icon: <CheckSquareOutlined />, label: 'Approval Queue' },
  { key: '/self-healing/effectiveness', icon: <DashboardOutlined />, label: 'Effectiveness' },
];

const pageTitleMap: Record<string, { icon: React.ReactNode; title: string; subtitle: string }> = {
  '/self-healing': { icon: <MedicineBoxOutlined />, title: 'Incidents', subtitle: '当前待处理的自我修复事件' },
  '/self-healing/history': { icon: <HistoryOutlined />, title: 'Healing History', subtitle: '查看历史修复记录' },
  '/self-healing/strategies': { icon: <ExperimentOutlined />, title: 'Strategies', subtitle: '管理修复策略配置' },
  '/self-healing/approvals': { icon: <CheckSquareOutlined />, title: 'Approval Queue', subtitle: '待审核的修复操作' },
  '/self-healing/effectiveness': { icon: <DashboardOutlined />, title: 'Effectiveness', subtitle: '自我修复效果分析' },
};

const SelfHealingLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

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
        theme="light"
        style={{ borderRight: `1px solid ${colors.light.border.light}` }}
      >
        <div style={{ padding: '16px 12px' }}>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <MedicineBoxOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            {collapsed ? 'SH' : 'Self-Healing'}
          </Title>
          {!collapsed && <Text type="secondary">自动化故障恢复与自愈系统</Text>}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Content style={{ margin: 0, padding: spacing.lg, background: colors.light.bg.primary }}>
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
