/**
 * LLM Trace Dashboard Layout
 */
import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography } from 'antd';
import {
  BarChartOutlined,
  UnorderedListOutlined,
  WalletOutlined,
  AimOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

const menuItems = [
  { key: '/console/llm-trace/overview', icon: <BarChartOutlined />, label: '追踪总览' },
  { key: '/console/llm-trace/traces', icon: <UnorderedListOutlined />, label: '调用记录' },
  { key: '/console/llm-trace/cost', icon: <WalletOutlined />, label: '成本分析' },
  { key: '/console/llm-trace/accuracy', icon: <AimOutlined />, label: '追踪精度' },
];

const pageTitleMap: Record<string, { icon: React.ReactNode; title: string; subtitle: string }> = {
  '/console/llm-trace/overview': { icon: <BarChartOutlined />, title: '追踪总览', subtitle: 'LLM 调用追踪概览' },
  '/console/llm-trace/traces': { icon: <UnorderedListOutlined />, title: '调用记录', subtitle: '查看详细 LLM 调用记录' },
  '/console/llm-trace/cost': { icon: <WalletOutlined />, title: '成本分析', subtitle: 'LLM 调用成本分析' },
  '/console/llm-trace/accuracy': { icon: <AimOutlined />, title: '追踪精度', subtitle: '评估追踪准确度' },
};

const LLMTraceDashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const selectedKey = location.pathname;
  const pageInfo = pageTitleMap[selectedKey] || { icon: null, title: 'LLM Trace', subtitle: '' };

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
        <Outlet />
      </Content>
    </Layout>
  );
};

export default LLMTraceDashboardLayout;
