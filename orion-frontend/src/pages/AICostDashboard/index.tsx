import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography, Spin } from 'antd';
import {
  BarChartOutlined,
  WalletOutlined,
  UnorderedListOutlined,
  FundOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

const menuItems = [
  { key: '/console/ai-cost/overview', icon: <BarChartOutlined />, label: '成本总览' },
  { key: '/console/ai-cost/budgets', icon: <WalletOutlined />, label: '预算管理' },
  { key: '/console/ai-cost/details', icon: <UnorderedListOutlined />, label: '成本明细' },
  { key: '/console/ai-cost/roi', icon: <FundOutlined />, label: 'ROI 报告' },
  { key: '/console/ai-cost/alerts', icon: <BellOutlined />, label: '告警设置' },
];

const pageTitleMap: Record<string, { icon: React.ReactNode; title: string; subtitle: string }> = {
  '/console/ai-cost/overview': { icon: <BarChartOutlined />, title: 'AI 成本总览', subtitle: '监控 AI 服务的成本消耗趋势' },
  '/console/ai-cost/budgets': { icon: <WalletOutlined />, title: '预算管理', subtitle: '设置和管理 AI 服务预算' },
  '/console/ai-cost/details': { icon: <UnorderedListOutlined />, title: '成本明细', subtitle: '查看各项 AI 服务的详细费用' },
  '/console/ai-cost/roi': { icon: <FundOutlined />, title: 'ROI 报告', subtitle: 'AI 投资回报率分析' },
  '/console/ai-cost/alerts': { icon: <BellOutlined />, title: '告警设置', subtitle: '配置成本告警阈值' },
};

const AICostDashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading] = useState(false);

  const selectedKey = location.pathname;
  const pageInfo = pageTitleMap[selectedKey] || { icon: null, title: 'AI 成本', subtitle: '' };

  return (
    <Layout style={{ minHeight: '100%' }}>
      <Sider
        width={200}
        theme="light"
        style={{ borderRight: `1px solid ${colors.light.border.light}` }}
      >
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Content style={{ padding: spacing[6], background: colors.light.bg.primary }}>
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
  );
};

export default AICostDashboardLayout;
