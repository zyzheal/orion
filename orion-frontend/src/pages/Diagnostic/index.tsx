/**
 * Diagnostic Module Layout
 * Sidebar navigation for Diagnostic sub-pages: Sessions, Reports, Knowledge Base, Trigger
 */
import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography, Spin } from 'antd';
import { colors, spacing } from '@/tokens';
import {
  PlayCircleOutlined,
  FileTextOutlined,
  BookOutlined,
  RocketOutlined,
} from '@ant-design/icons';

const { Sider, Content } = Layout;
const { Title } = Typography;

const menuItems = [
  { key: '/diagnostic/sessions', icon: <PlayCircleOutlined />, label: 'Sessions' },
  { key: '/diagnostic/reports', icon: <FileTextOutlined />, label: 'Reports' },
  { key: '/diagnostic/knowledge', icon: <BookOutlined />, label: 'Knowledge Base' },
  { key: '/diagnostic/trigger', icon: <RocketOutlined />, label: 'Trigger' },
];

const DiagnosticLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [loading, _setLoading] = useState(false);

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
        width={200}
      >
        {!collapsed && (
          <div style={{ padding: '16px 12px 8px' }}>
            <Title level={5} style={{ margin: 0, color: colors.purple[500] }}>
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
            padding: spacing.lg,
            margin: 0,
            minHeight: 280,
            background: colors.light.bg.primary,
          }}
        >
          <Spin spinning={loading}>
            <Outlet />
          </Spin>
        </Content>
      </Layout>
    </Layout>
  );
};

export default DiagnosticLayout;
