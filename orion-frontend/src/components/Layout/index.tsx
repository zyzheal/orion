/**
 * 新版 Layout - 固定顶部导航栏设计
 * - 去掉左侧边栏
 * - 固定顶部导航
 * - 左上角：子系统启动器 + 系统名称 (可点击返回首页)
 * - 右上角：主题切换 + 控制台 (管理员) + 用户菜单
 */
import React, { useState } from 'react';
import { Layout as AntLayout, Menu, Avatar, Dropdown, Space, Breadcrumb, Button } from 'antd';
import {
  DashboardOutlined,
  ProjectOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  MoonOutlined,
  SunOutlined,
  HomeOutlined,
  AppstoreOutlined,
  ControlOutlined,
  RocketOutlined,
  CloudServerOutlined,
  AlertOutlined,
  BarChartOutlined,
  TeamOutlined,
  UserSwitchOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { GetProp } from 'antd';
import { useAppStore } from '@/stores/appStore';
import { useAuth } from '@/hooks/useAuth';
import SubAppLauncher from '@/components/SubAppLauncher';
import { useNavigate } from 'react-router-dom';

type ItemType = GetProp<MenuProps, 'items'>[number];

const { Header, Content, Footer } = AntLayout;

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const { theme, setTheme, setBreadcrumbs } = useAppStore();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';

  // 顶部导航菜单
  const navMenuItems: ItemType[] = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '工作台',
    },
    {
      key: '/ops',
      icon: <CloudServerOutlined />,
      label: '运维中心',
      children: [
        {
          key: '/pipelines',
          icon: <RocketOutlined />,
          label: '流水线',
        },
        {
          key: '/deployments',
          icon: <CloudServerOutlined />,
          label: '部署',
        },
        {
          key: '/alerts',
          icon: <AlertOutlined />,
          label: '告警',
        },
      ],
    },
    {
      key: '/tickets',
      icon: <UnorderedListOutlined />,
      label: '工单',
    },
    {
      key: '/bi',
      icon: <BarChartOutlined />,
      label: '效能看板',
      children: [
        {
          key: '/dashboard/executive',
          icon: <DashboardOutlined />,
          label: '总览看板',
        },
        {
          key: '/dashboard/manager',
          icon: <TeamOutlined />,
          label: '经理看板',
        },
        {
          key: '/dashboard/engineer',
          icon: <UserSwitchOutlined />,
          label: '个人看板',
        },
      ],
    },
    {
      key: '/subapps',
      icon: <AppstoreOutlined />,
      label: '子系统',
      children: [
        {
          key: '/dba',
          label: '数据库管理',
        },
        {
          key: '/knowledge',
          label: '知识库',
        },
        {
          key: '/visor',
          label: '监控中心',
        },
      ],
    },
    {
      key: '/projects',
      icon: <ProjectOutlined />,
      label: '项目',
    },
  ];

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    navigate(e.key);
    // Find menu item (including nested children)
    let foundLabel: string | undefined;
    for (const item of navMenuItems) {
      if (!item || !('key' in item)) continue;
      if (item.key === e.key) {
        foundLabel = 'label' in item ? String(item.label) : undefined;
        break;
      }
      // Check children
      if ('children' in item && item.children) {
        const child = item.children.find((c) => c && 'key' in c && c.key === e.key);
        if (child && 'label' in child) {
          foundLabel = String(child.label);
          break;
        }
      }
    }
    if (foundLabel) {
      setBreadcrumbs([
        { title: '首页', path: '/' },
        { title: foundLabel, path: e.key },
      ]);
    }
  };

  // 用户菜单
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

  // 控制台菜单（仅管理员）
  const consoleMenuItems: ItemType[] = [
    {
      key: '/console/plugins',
      icon: <AppstoreOutlined />,
      label: '插件管理',
    },
    {
      key: '/console/settings',
      icon: <SettingOutlined />,
      label: '系统配置',
    },
    {
      key: '/console/users',
      icon: <UserOutlined />,
      label: '用户管理',
    },
  ];

  const handleConsoleMenuClick: MenuProps['onClick'] = (e) => {
    navigate(e.key);
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      {/* 固定顶部导航栏 */}
      <Header
        style={{
          padding: '0 24px',
          background: theme === 'dark' ? '#001529' : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          height: 64,
          overflow: 'visible',
        }}
      >
        {/* 左侧区域：启动器 + 系统名 + 导航菜单 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* 子系统启动器 + 系统名称 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: 8,
              transition: 'all 0.3s',
              flexShrink: 0,
            }}
            onClick={() => navigate('/dashboard')}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.04)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <SubAppLauncher />
            <span
              style={{
                fontSize: 16,
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                whiteSpace: 'nowrap',
              }}
            >
              Orion Platform
            </span>
          </div>

          {/* 顶部导航菜单 */}
          <Menu
            mode="horizontal"
            selectedKeys={['/dashboard']}
            items={navMenuItems}
            onClick={handleMenuClick}
            style={{
              border: 'none',
              background: 'transparent',
              overflow: 'visible',
            }}
            theme={theme === 'dark' ? 'dark' : 'light'}
            overflowedIndicator={null}
          />
        </div>

        {/* 右侧区域：控制台 + 主题 + 用户 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* 控制台入口（仅管理员） */}
          {isAdmin && (
            <Dropdown
              menu={{ items: consoleMenuItems, onClick: handleConsoleMenuClick }}
              placement="bottomRight"
              trigger={['click']}
            >
              <Button
                icon={<ControlOutlined />}
                type="text"
                size="large"
                style={{
                  fontSize: 18,
                  color: theme === 'dark' ? '#fff' : '#666',
                }}
                title="控制台"
              />
            </Dropdown>
          )}

          {/* 主题切换 */}
          <Button
            icon={theme === 'dark' ? <SunOutlined /> : <MoonOutlined />}
            type="text"
            size="large"
            onClick={toggleTheme}
            style={{
              fontSize: 18,
              color: theme === 'dark' ? '#fff' : '#666',
            }}
            title={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
          />

          {/* 用户菜单 */}
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 8,
                transition: 'all 0.3s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.04)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <Avatar
                icon={<UserOutlined />}
                src={user?.avatar}
                size="default"
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                }}
              />
              <span style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' }}>
                {user?.username || '用户'}
              </span>
            </div>
          </Dropdown>
        </div>
      </Header>

      {/* 面包屑导航 */}
      <div
        style={{
          background: theme === 'dark' ? '#141414' : '#f0f2f5',
          padding: '12px 24px',
        }}
      >
        <Breadcrumb
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
      </div>

      {/* 内容区域 */}
      <Content
        style={{
          margin: '16px 24px',
          background: theme === 'dark' ? '#141414' : '#fff',
          borderRadius: 12,
          padding: 24,
          minHeight: 'calc(100vh - 180px)',
          boxShadow: theme === 'dark'
            ? '0 2px 8px rgba(0,0,0,0.3)'
            : '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        {children}
      </Content>

      {/* 页脚 */}
      <Footer style={{
        textAlign: 'center',
        background: 'transparent',
        color: theme === 'dark' ? '#666' : '#999',
      }}>
        Orion Platform ©{new Date().getFullYear()} Created by Orion Team
      </Footer>
    </AntLayout>
  );
};
