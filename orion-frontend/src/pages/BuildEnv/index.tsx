import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography, Spin } from 'antd';
import { colors, spacing } from '@/tokens';
import {
  DockerOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
  FileTextOutlined,
  ContainerOutlined,
} from '@ant-design/icons';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

const menuItems = [
  { key: '/console/build-env/images', icon: <DockerOutlined />, label: 'Builder Images' },
  { key: '/console/build-env/cache', icon: <DatabaseOutlined />, label: 'Build Cache' },
  { key: '/console/build-env/pods', icon: <CloudServerOutlined />, label: 'Build Pods' },
  { key: '/console/build-env/logs', icon: <FileTextOutlined />, label: 'Build Logs' },
  { key: '/console/build-env/artifacts', icon: <ContainerOutlined />, label: 'Artifacts' },
];

const pageTitleMap: Record<string, { icon: React.ReactNode; title: string; subtitle: string }> = {
  '/console/build-env/images': { icon: <DockerOutlined />, title: 'Builder Images', subtitle: '管理构建镜像' },
  '/console/build-env/cache': { icon: <DatabaseOutlined />, title: 'Build Cache', subtitle: '管理构建缓存' },
  '/console/build-env/pods': { icon: <CloudServerOutlined />, title: 'Build Pods', subtitle: '管理构建 Pod 实例' },
  '/console/build-env/logs': { icon: <FileTextOutlined />, title: 'Build Logs', subtitle: '查看构建日志' },
  '/console/build-env/artifacts': { icon: <ContainerOutlined />, title: 'Artifacts', subtitle: '管理构建制品' },
};

const BuildEnvLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  const selectedKey = location.pathname;
  const pageInfo = pageTitleMap[selectedKey] || { icon: null, title: 'Build Environment', subtitle: '' };

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
        <Spin spinning={loading}>
          <Outlet context={{ setLoading }} />
        </Spin>
      </Content>
    </Layout>
  );
};

export default BuildEnvLayout;
