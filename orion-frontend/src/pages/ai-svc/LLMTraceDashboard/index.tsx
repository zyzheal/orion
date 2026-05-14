/**
 * LLM Trace Dashboard Layout
 */
import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import {
  BarChartOutlined,
  UnorderedListOutlined,
  WalletOutlined,
  AimOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Sider, Content } = Layout;

const menuItems = [
  { key: '/console/llm-trace/overview', icon: <BarChartOutlined />, label: '追踪总览' },
  { key: '/console/llm-trace/traces', icon: <UnorderedListOutlined />, label: '调用记录' },
  { key: '/console/llm-trace/cost', icon: <WalletOutlined />, label: '成本分析' },
  { key: '/console/llm-trace/accuracy', icon: <AimOutlined />, label: '追踪精度' },
];

const LLMTraceDashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Layout style={{ minHeight: '100%' }}>
      <Sider
        width={200}
        theme="light"
        style={{ borderRight: `1px solid ${colors.light.border.light}` }}
      >
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Content style={{ padding: spacing[6], background: colors.light.bg.primary }}>
        <Outlet />
      </Content>
    </Layout>
  );
};

export default LLMTraceDashboardLayout;