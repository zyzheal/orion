import React from "react";
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography } from 'antd';
import {
  CloudServerOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

const menuItems = [
  { key: '/console/iac/workspaces', icon: <CloudServerOutlined />, label: '工作空间' },
  { key: '/console/iac/plans', icon: <FileTextOutlined />, label: '计划查看' },
  { key: '/console/iac/state', icon: <ClockCircleOutlined />, label: '状态浏览' },
  { key: '/console/iac/modules', icon: <AppstoreOutlined />, label: '模块注册' },
];

const pageTitleMap: Record<string, { icon: React.ReactNode; title: string; subtitle: string }> = {
  '/console/iac/workspaces': { icon: <CloudServerOutlined />, title: '工作空间', subtitle: '管理 IaC 工作空间' },
  '/console/iac/plans': { icon: <FileTextOutlined />, title: '计划查看', subtitle: '查看基础设施变更计划' },
  '/console/iac/state': { icon: <ClockCircleOutlined />, title: '状态浏览', subtitle: '浏览基础设施状态' },
  '/console/iac/modules': { icon: <AppstoreOutlined />, title: '模块注册', subtitle: '管理 IaC 模块' },
};

const IacManagementLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const selectedKey = location.pathname;
  const pageInfo = pageTitleMap[selectedKey] || { icon: null, title: 'IaC 管理', subtitle: '' };

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
      <Content style={{ padding: spacing.lg, background: colors.light.bg.primary }}>
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

export default IacManagementLayout;
