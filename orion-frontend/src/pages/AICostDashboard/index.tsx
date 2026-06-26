import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Spin } from 'antd';
import {
  BarChartOutlined,
  WalletOutlined,
  UnorderedListOutlined,
  FundOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Sider, Content } = Layout;

const menuItems = [
  { key: '/console/ai-cost/overview', icon: <BarChartOutlined />, label: '成本总览' },
  { key: '/console/ai-cost/budgets', icon: <WalletOutlined />, label: '预算管理' },
  { key: '/console/ai-cost/details', icon: <UnorderedListOutlined />, label: '成本明细' },
  { key: '/console/ai-cost/roi', icon: <FundOutlined />, label: 'ROI 报告' },
  { key: '/console/ai-cost/alerts', icon: <BellOutlined />, label: '告警设置' },
];

const AICostDashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading] = useState(false);

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
        <Spin spinning={loading}>
          <Outlet />
        </Spin>
      </Content>
    </Layout>
  );
};

export default AICostDashboardLayout;
