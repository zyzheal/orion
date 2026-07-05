import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography } from 'antd';
import { ShopOutlined, HeartOutlined, CloudUploadOutlined, AuditOutlined, HistoryOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

const menuItems = [
  { key: '/skills/marketplace', icon: <ShopOutlined />, label: '技能市场' },
  { key: '/skills/my', icon: <HeartOutlined />, label: '我的技能' },
  { key: '/skills/submit', icon: <CloudUploadOutlined />, label: '技能提交' },
  { type: 'divider' as const },
  { key: '/skills/admin/pending', icon: <AuditOutlined />, label: '待审核' },
  { key: '/skills/admin/history', icon: <HistoryOutlined />, label: '审核历史' },
];

const pageTitleMap: Record<string, { icon: React.ReactNode; title: string; subtitle: string }> = {
  '/skills/marketplace': { icon: <ShopOutlined />, title: '技能市场', subtitle: '浏览和发现可用技能' },
  '/skills/my': { icon: <HeartOutlined />, title: '我的技能', subtitle: '管理已安装的技能' },
  '/skills/submit': { icon: <CloudUploadOutlined />, title: '技能提交', subtitle: '提交新的技能包' },
  '/skills/admin/pending': { icon: <AuditOutlined />, title: '待审核', subtitle: '审核待处理的技能提交' },
  '/skills/admin/history': { icon: <HistoryOutlined />, title: '审核历史', subtitle: '查看技能审核历史' },
};

const SkillManagementLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const selectedKey = location.pathname;
  const pageInfo = pageTitleMap[selectedKey] || { icon: null, title: '技能管理', subtitle: '' };

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

export default SkillManagementLayout;
