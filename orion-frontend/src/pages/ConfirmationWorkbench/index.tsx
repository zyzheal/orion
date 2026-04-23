import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import { colors } from '@/tokens';
import { CheckSquareOutlined, CheckCircleOutlined, BellOutlined, AuditOutlined } from '@ant-design/icons';

const { Sider, Content } = Layout;

const menuItems = [
  { key: '/console/confirmations/pending', icon: <CheckSquareOutlined />, label: '确认工作台' },
  { key: '/console/confirmations/batch', icon: <CheckCircleOutlined />, label: '批量确认' },
  { key: '/console/confirmations/notifications', icon: <BellOutlined />, label: '通知设置' },
  { key: '/console/confirmations/audit', icon: <AuditOutlined />, label: '审计日志' },
];

const ConfirmationLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <Layout style={{ minHeight: '100%' }}>
      <Sider width={200} theme="light" style={{ borderRight: `1px solid ${colors.light.border.light}` }}>
        <Menu mode="inline" selectedKeys={[location.pathname]} items={menuItems} onClick={({ key }) => navigate(key)} />
      </Sider>
      <Content style={{ padding: 24, background: colors.light.bg.primary }}><Outlet /></Content>
    </Layout>
  );
};

export default ConfirmationLayout;
