import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import {
  SearchOutlined,
  DashboardOutlined,
  FileTextOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Sider, Content } = Layout;

const menuItems = [
  { key: '/console/chatops/commands', icon: <SearchOutlined />, label: '命令浏览' },
  { key: '/console/chatops/executions', icon: <DashboardOutlined />, label: '执行监控' },
  { key: '/console/chatops/audit', icon: <FileTextOutlined />, label: '审计日志' },
  { key: '/console/chatops/settings', icon: <SettingOutlined />, label: '设置' },
];

const ChatOpsLayout: React.FC = () => {
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

export default ChatOpsLayout;
