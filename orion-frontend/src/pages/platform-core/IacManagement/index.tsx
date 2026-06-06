import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import { colors, spacing } from '@/tokens';
import {
  CloudServerOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';

const { Sider, Content } = Layout;

const menuItems = [
  { key: '/console/iac/workspaces', icon: <CloudServerOutlined />, label: '工作空间' },
  { key: '/console/iac/plans', icon: <FileTextOutlined />, label: '计划查看' },
  { key: '/console/iac/state', icon: <ClockCircleOutlined />, label: '状态浏览' },
  { key: '/console/iac/modules', icon: <AppstoreOutlined />, label: '模块注册' },
];

const IacManagementLayout: React.FC = () => {
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
      <Content style={{ padding: spacing.lg, background: colors.light.bg.primary }}>
        <Outlet />
      </Content>
    </Layout>
  );
};

export default IacManagementLayout;
