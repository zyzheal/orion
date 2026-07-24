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
const { Title, Text } = Typography;

const menuItems = [
  { key: '/diagnostic/sessions', icon: <PlayCircleOutlined />, label: 'Sessions' },
  { key: '/diagnostic/reports', icon: <FileTextOutlined />, label: 'Reports' },
  { key: '/diagnostic/knowledge', icon: <BookOutlined />, label: 'Knowledge Base' },
  { key: '/diagnostic/trigger', icon: <RocketOutlined />, label: 'Trigger' },
];

const pageTitleMap: Record<string, { icon: React.ReactNode; title: string; subtitle: string }> = {
  '/diagnostic/sessions': { icon: <PlayCircleOutlined />, title: '诊断会话', subtitle: '管理和跟踪所有诊断会话' },
  '/diagnostic/reports': { icon: <FileTextOutlined />, title: '诊断报告', subtitle: '查看诊断报告和模式匹配结果' },
  '/diagnostic/knowledge': { icon: <BookOutlined />, title: '知识库', subtitle: '诊断模式和解决方案管理' },
  '/diagnostic/trigger': { icon: <RocketOutlined />, title: '触发诊断', subtitle: '手动触发新的诊断会话' },
};

const DiagnosticLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [loading, _setLoading] = useState(false);

  const selectedKey = location.pathname;
  const pageInfo = pageTitleMap[selectedKey] || { icon: null, title: '诊断中心', subtitle: '' };

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

export default DiagnosticLayout;
