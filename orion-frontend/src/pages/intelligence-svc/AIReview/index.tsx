/**
 * AI Review - Main Layout
 * Sidebar navigation for AI Review sub-pages
 */
import React, { useState } from 'react';
import { Layout, Menu, Typography } from 'antd';
import { colors, spacing } from '@/tokens';
import {
  ScanOutlined,
  HistoryOutlined,
  FileSearchOutlined,
  BulbOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

const menuItems = [
  { key: '/ai-review', icon: <ScanOutlined />, label: 'Dashboard' },
  { key: '/ai-review/history', icon: <HistoryOutlined />, label: 'Review History' },
  { key: '/ai-review/detail', icon: <FileSearchOutlined />, label: 'Review Detail' },
  { key: '/ai-review/rules', icon: <BulbOutlined />, label: 'Review Rules' },
  { key: '/ai-review/config', icon: <SettingOutlined />, label: 'Configuration' },
];

const pageTitleMap: Record<string, { icon: React.ReactNode; title: string; subtitle: string }> = {
  '/ai-review': { icon: <ScanOutlined />, title: 'Dashboard', subtitle: 'AI 代码评审总览' },
  '/ai-review/history': { icon: <HistoryOutlined />, title: 'Review History', subtitle: '查看历史评审记录' },
  '/ai-review/detail': { icon: <FileSearchOutlined />, title: 'Review Detail', subtitle: '查看评审详情' },
  '/ai-review/rules': { icon: <BulbOutlined />, title: 'Review Rules', subtitle: '管理评审规则配置' },
  '/ai-review/config': { icon: <SettingOutlined />, title: 'Configuration', subtitle: 'AI Review 系统配置' },
};

const AIReviewLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const selectedKey = location.pathname;
  const pageInfo = pageTitleMap[selectedKey] || { icon: null, title: 'AI Review', subtitle: '' };

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
            <ScanOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            {collapsed ? 'AI' : 'AI Review'}
          </Title>
          {!collapsed && <Text type="secondary">AI 驱动的智能代码评审</Text>}
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

export default AIReviewLayout;
