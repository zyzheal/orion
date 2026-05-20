import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import {
  ShopOutlined,
  HeartOutlined,
  CloudUploadOutlined,
  AuditOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Sider, Content } = Layout;

const menuItems = [
  { key: '/skills/marketplace', icon: <ShopOutlined />, label: '技能市场' },
  { key: '/skills/my', icon: <HeartOutlined />, label: '我的技能' },
  { key: '/skills/submit', icon: <CloudUploadOutlined />, label: '技能提交' },
  { type: 'divider' as const },
  { key: '/skills/admin/pending', icon: <AuditOutlined />, label: '待审核' },
  { key: '/skills/admin/history', icon: <HistoryOutlined />, label: '审核历史' },
];

const SkillManagementLayout: React.FC = () => {
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

export default SkillManagementLayout;
