import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import { colors, spacing } from '@/tokens';
import { DockerOutlined, DatabaseOutlined, CloudServerOutlined, FileTextOutlined, ContainerOutlined } from '@ant-design/icons';

const { Sider, Content } = Layout;

const menuItems = [
  { key: '/console/build-env/images', icon: <DockerOutlined />, label: 'Builder Images' },
  { key: '/console/build-env/cache', icon: <DatabaseOutlined />, label: 'Build Cache' },
  { key: '/console/build-env/pods', icon: <CloudServerOutlined />, label: 'Build Pods' },
  { key: '/console/build-env/logs', icon: <FileTextOutlined />, label: 'Build Logs' },
  { key: '/console/build-env/artifacts', icon: <ContainerOutlined />, label: 'Artifacts' },
];

const BuildEnvLayout: React.FC = () => {
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

export default BuildEnvLayout;
