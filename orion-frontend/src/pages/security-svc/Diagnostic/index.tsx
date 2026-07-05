/**
 * Diagnostic Module Layout
 * Sidebar navigation for Diagnostic sub-pages: Sessions, Reports, Knowledge Base, Trigger
 */
import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography } from 'antd';
import { colors, spacing } from '@/tokens';
import {
  PlayCircleOutlined,
  FileTextOutlined,
  BookOutlined,
  RocketOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { useAppStore } from '@/stores/appStore';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

const menuItems = [
  { key: '/observability/diagnostic/sessions', icon: <PlayCircleOutlined />, label: 'Sessions' },
  { key: '/observability/diagnostic/reports', icon: <FileTextOutlined />, label: 'Reports' },
  { key: '/observability/diagnostic/knowledge', icon: <BookOutlined />, label: 'Knowledge Base' },
  { key: '/observability/diagnostic/trigger', icon: <RocketOutlined />, label: 'Trigger' },
];

const pageTitleMap: Record<string, { icon: React.ReactNode; title: string; subtitle: string }> = {
  '/observability/diagnostic/sessions': { icon: <PlayCircleOutlined />, title: 'Sessions', subtitle: '诊断会话管理' },
  '/observability/diagnostic/reports': { icon: <FileTextOutlined />, title: 'Reports', subtitle: '诊断报告查看' },
  '/observability/diagnostic/knowledge': { icon: <BookOutlined />, title: 'Knowledge Base', subtitle: '诊断知识库' },
  '/observability/diagnostic/trigger': { icon: <RocketOutlined />, title: 'Trigger', subtitle: '诊断触发规则' },
};

// 统一的 Layout 配置
const LAYOUT_CONFIG = {
  siderWidth: 220,
  titleLevel: 5 as const,
  headerPadding: `${spacing[4]}px ${spacing[3]}px ${spacing[2]}px`,
};

const DiagnosticLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  // 从全局 store 获取主题（响应式）
  const theme = useAppStore((state) => state.theme);
  const isDark = theme === 'dark';

  const selectedKey = location.pathname;
  const pageInfo = pageTitleMap[selectedKey] || { icon: null, title: 'Diagnostic', subtitle: '' };

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
            <Title level={2} style={{ marginBottom: spacing.sm, color: colors.primary[500] }}>
              <ToolOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
              Diagnostic
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

export default DiagnosticLayout;
