import React, { useState } from 'react';
import { Layout as AntLayout, Menu, Avatar, Dropdown, Space, Breadcrumb } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  ProjectOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  MoonOutlined,
  SunOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { GetProp } from 'antd';
import { useAppStore } from '@/stores/appStore';
import { useAuth } from '@/hooks/useAuth';

type ItemType = GetProp<MenuProps, 'items'>[number];

const { Header, Sider, Content, Footer } = AntLayout;

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { theme, setTheme, setSidebarCollapsed, setBreadcrumbs } = useAppStore();
  const { user, logout } = useAuth();

  const menuItems: ItemType[] = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '工作台',
    },
    {
      type: 'divider',
    },
    {
      key: 'projects',
      icon: <ProjectOutlined />,
      label: '项目管理',
      children: [
        {
          key: '/projects',
          label: '项目列表',
        },
        {
          key: '/projects/create',
          label: '创建项目',
        },
      ],
    },
    {
      type: 'divider',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
      children: [
        {
          key: '/settings/general',
          label: '通用设置',
        },
        {
          key: '/settings/user',
          label: '用户管理',
        },
      ],
    },
  ];

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    // 处理菜单点击，更新面包屑
    const selectedMenu = menuItems.find((item) => item && 'key' in item && item.key === e.key);
    if (selectedMenu && 'label' in selectedMenu) {
      setBreadcrumbs([
        { title: '首页', path: '/' },
        { title: String(selectedMenu.label), path: e.key },
      ]);
    }
  };

  const userMenuItems: ItemType[] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '个人设置',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: logout,
    },
  ];

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme={theme === 'dark' ? 'dark' : 'light'}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme === 'dark' ? '#fff' : '#001529',
            fontWeight: 'bold',
            fontSize: collapsed ? 0 : 18,
            overflow: 'hidden',
          }}
        >
          <span style={{ whiteSpace: 'nowrap' }}>Orion Platform</span>
        </div>
        <Menu
          theme={theme === 'dark' ? 'dark' : 'light'}
          mode="inline"
          selectedKeys={['/dashboard']}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <AntLayout style={{ marginLeft: collapsed ? 80 : 200, transition: 'all 0.2s' }}>
        <Header
          style={{
            padding: '0 24px',
            background: theme === 'dark' ? '#001529' : '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 99,
          }}
        >
          <Space>
            {React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
              className: 'trigger',
              onClick: () => {
                setCollapsed(!collapsed);
                setSidebarCollapsed(!collapsed);
              },
              style: {
                fontSize: 18,
                cursor: 'pointer',
              },
            })}
          </Space>

          <Space>
            {React.createElement(theme === 'dark' ? SunOutlined : MoonOutlined, {
              onClick: toggleTheme,
              style: {
                fontSize: 18,
                cursor: 'pointer',
              },
            })}

            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} src={user?.avatar} />
                {!collapsed && <span>{user?.username || '用户'}</span>}
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Breadcrumb
          style={{
            margin: '16px 24px',
          }}
          separator=">"
          items={[
            {
              title: (
                <span>
                  <HomeOutlined /> 首页
                </span>
              ),
              href: '/',
            },
            ...(useAppStore.getState().breadcrumbs || []),
          ]}
        />

        <Content
          style={{
            margin: '0 24px',
            background: theme === 'dark' ? '#141414' : '#f0f2f5',
            borderRadius: 8,
            padding: 24,
            minHeight: 'calc(100vh - 184px)',
          }}
        >
          {children}
        </Content>

        <Footer style={{ textAlign: 'center', background: 'transparent' }}>
          Orion Platform ©{new Date().getFullYear()} Created by Orion Team
        </Footer>
      </AntLayout>
    </AntLayout>
  );
};
