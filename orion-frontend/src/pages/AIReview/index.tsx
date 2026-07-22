/**
 * AI Review - Main Layout
 * Sidebar navigation for AI Review sub-pages
 */
import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography, Spin } from 'antd';
import { colors, spacing } from '@/tokens';
import {
  ScanOutlined,
  HistoryOutlined,
  BulbOutlined,
  SettingOutlined,
} from '@ant-design/icons';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

const menuItems = [
  { key: '/console/ai-review/dashboard', icon: <ScanOutlined />, label: 'Dashboard' },
  { key: '/console/ai-review/history', icon: <HistoryOutlined />, label: 'Review History' },
  { key: '/console/ai-review/rules', icon: <BulbOutlined />, label: 'Review Rules' },
  { key: '/console/ai-review/config', icon: <SettingOutlined />, label: 'Configuration' },
];

const pageTitleMap: Record<string, { icon: React.ReactNode; title: string; subtitle: string }> = {
  '/console/ai-review/dashboard': { icon: <ScanOutlined />, title: 'AI Review Dashboard', subtitle: 'AI 代码评审总览' },
  '/console/ai-review/history': { icon: <HistoryOutlined />, title: 'Review History', subtitle: '查看历史评审记录' },
  '/console/ai-review/rules': { icon: <BulbOutlined />, title: 'Review Rules', subtitle: '管理评审规则配置' },
  '/console/ai-review/config': { icon: <SettingOutlined />, title: 'Configuration', subtitle: 'AI Review 系统配置' },
};

const AIReviewLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [loading, _setLoading] = useState(false);

  const selectedKey = location.pathname;
  const pageInfo = pageTitleMap[selectedKey] || { icon: null, title: 'AI Review', subtitle: '' };

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
            {collapsed ? 'AI' : 'AI Review'}
          </Title>
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
          <Spin spinning={loading}>
            <Outlet />
          </Spin>
        </Content>
      </Layout>
    </Layout>
  );
};

export default AIReviewLayout;
