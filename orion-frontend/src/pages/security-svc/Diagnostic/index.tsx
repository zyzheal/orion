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
} from '@ant-design/icons';
import { useAppStore } from '@/stores/appStore';

const { Sider, Content } = Layout;
const { Title } = Typography;

const menuItems = [
  { key: '/console/diagnostic/sessions', icon: <PlayCircleOutlined />, label: 'Sessions' },
  { key: '/console/diagnostic/reports', icon: <FileTextOutlined />, label: 'Reports' },
  { key: '/console/diagnostic/knowledge', icon: <BookOutlined />, label: 'Knowledge Base' },
  { key: '/console/diagnostic/trigger', icon: <RocketOutlined />, label: 'Trigger' },
];

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
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default DiagnosticLayout;
