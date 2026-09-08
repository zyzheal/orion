/**
 * Self-Healing - Main Layout
 * Sidebar navigation for Self-Healing sub-pages
 * P2-9 Phase 287: 159->51 行 (-68%), 新增 Components/{constants,Sider,ContentHeader}.tsx
 */
import React, { useState } from 'react';
import { Layout } from 'antd';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';
import { spacing, themeVars } from '@/tokens';
import { SelfHealingSider } from './Components/Sider';
import { ContentHeader } from './Components/ContentHeader';

const { Content } = Layout;

const SelfHealingLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  // 从全局 store 获取主题（响应式）
  const theme = useAppStore((state) => state.theme);

  const selectedKey = location.pathname;

  return (
    <Layout style={{ minHeight: 'calc(100vh - 64px)' }}>
      <SelfHealingSider
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme={theme}
        selectedKey={selectedKey}
        onMenuClick={navigate}
      />
      <Layout>
        <Content
          style={{
            margin: 0,
            padding: spacing[6],
            background: themeVars.bgPrimary,
          }}
        >
          <ContentHeader selectedKey={selectedKey} />
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default SelfHealingLayout;
