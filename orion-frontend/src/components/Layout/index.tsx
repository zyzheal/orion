/**
 * 新版 Layout - 固定顶部导航栏设计
 * - 去掉左侧边栏
 * - 固定顶部导航
 * - 左上角：子系统启动器 + 系统名称 (可点击返回首页)
 * - 右上角：主题切换 + 控制台 (管理员) + 用户菜单
 */
import React from 'react';
import { Layout as AntLayout, Menu, Avatar, Dropdown, Breadcrumb, Button } from 'antd';
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
  ForkOutlined,
  InboxOutlined,
  DollarCircleOutlined,
  AlertOutlined,
  BarChartOutlined,
  TeamOutlined,
  UserSwitchOutlined,
  UnorderedListOutlined,
  BookOutlined,
  DatabaseOutlined,
  EyeOutlined,
  DeploymentUnitOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { GetProp } from 'antd';
import { useAppStore } from '@/stores/appStore';
import { useAuth } from '@/hooks/useAuth';
import SubAppLauncher from '@/components/SubAppLauncher';
import { useNavigate, useLocation } from 'react-router-dom';
import { NotificationBell } from '@/components/NotificationBell';

type ItemType = GetProp<MenuProps, 'items'>[number];

const { Header, Content, Footer } = AntLayout;

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme, breadcrumbs, setBreadcrumbs } = useAppStore();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';

  // 根据当前路由动态计算菜单激活态
  const selectedKeys = React.useMemo(() => {
    const path = location.pathname;
    // Direct match
    for (const item of navMenuItems) {
      if (!item || !('key' in item)) continue;
      if (item.key === path) return [item.key as string];
      if ('children' in item && item.children) {
        for (const child of item.children) {
          if (!child || !('key' in child)) continue;
          if (child.key === path) return [child.key as string];
          if ('children' in child && child.children) {
            const gc = child.children.find((c) => c && 'key' in c && c.key === path);
            if (gc && 'key' in gc) return [gc.key as string];
          }
        }
      }
    }
    // Prefix match for nested routes
    for (const item of navMenuItems) {
      if (!item || !('key' in item) || !item.key) continue;
      const itemKey = String(item.key);
      if (itemKey !== '/dashboard' && path.startsWith(itemKey)) return [itemKey];
    }
    return ['/dashboard'];
  }, [location.pathname]);

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
        {
          key: '/finops',
          icon: <DollarCircleOutlined />,
          label: '成本分析',
        },
        {
          key: '/monitoring',
          icon: <EyeOutlined />,
          label: '监控中心',
        },
        {
          key: '/diagnostic',
          icon: <EyeOutlined />,
          label: '诊断中心',
        },
        {
          key: '/self-healing',
          icon: <RocketOutlined />,
          label: '自愈系统',
        },
        {
          key: '/canary-analysis',
          icon: <BarChartOutlined />,
          label: '灰度分析',
        },
        {
          key: '/change-intelligence',
          icon: <BarChartOutlined />,
          label: '变更智能',
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
        {
          key: '/efficiency-dashboard',
          icon: <BarChartOutlined />,
          label: '效能分析',
        },
        {
          key: '/risk-dashboard',
          icon: <AlertOutlined />,
          label: '风险看板',
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
          icon: <DatabaseOutlined />,
          label: '数据库管理',
        },
        {
          key: '/knowledge',
          icon: <BookOutlined />,
          label: '知识库',
        },
        {
          key: '/visor',
          icon: <EyeOutlined />,
          label: '运维监控',
        },
      ],
    },
    {
      key: '/product-lines',
      icon: <ForkOutlined />,
      label: '产品线',
    },
    {
      key: '/artifacts',
      icon: <InboxOutlined />,
      label: '制品管理',
    },
    {
      key: '/internal-libraries',
      icon: <DeploymentUnitOutlined />,
      label: '二方库',
    },
    {
      key: '/projects',
      icon: <ProjectOutlined />,
      label: '项目',
    },
    {
      key: '/ai',
      icon: <RocketOutlined />,
      label: 'AI 能力',
      children: [
        {
          key: '/ai-gateway',
          icon: <RocketOutlined />,
          label: 'AI 网关',
        },
        {
          key: '/agents',
          icon: <AppstoreOutlined />,
          label: 'Agent 调度',
        },
        {
          key: '/console/ai-review',
          icon: <EyeOutlined />,
          label: 'AI Review',
        },
        {
          key: '/knowledge',
          icon: <BookOutlined />,
          label: 'AI 知识库',
        },
        {
          key: '/console/ai-docs',
          icon: <BookOutlined />,
          label: 'AI 文档',
        },
        {
          key: '/console/chatops',
          icon: <RocketOutlined />,
          label: 'ChatOps',
        },
      ],
    },
    {
      key: '/governance',
      icon: <SettingOutlined />,
      label: '治理',
      children: [
        {
          key: '/policies',
          icon: <SettingOutlined />,
          label: '策略管理',
        },
        {
          key: '/audit-log',
          icon: <UnorderedListOutlined />,
          label: '审计日志',
        },
        {
          key: '/tenant-management',
          icon: <TeamOutlined />,
          label: '租户管理',
        },
        {
          key: '/roles',
          icon: <UserSwitchOutlined />,
          label: '角色管理',
        },
        {
          key: '/config-management',
          icon: <SettingOutlined />,
          label: '配置管理',
        },
        {
          key: '/cmdb',
          icon: <DatabaseOutlined />,
          label: 'CMDB',
        },
        {
          key: '/skills',
          icon: <AppstoreOutlined />,
          label: 'Skill 市场',
        },
        {
          key: '/sbom',
          icon: <EyeOutlined />,
          label: 'SBOM',
        },
        {
          key: '/approvals',
          icon: <CheckCircleOutlined />,
          label: '审批流',
        },
        {
          key: '/oncall',
          icon: <ClockCircleOutlined />,
          label: '值班管理',
        },
      ],
    },
    {
      key: '/dev-env',
      icon: <CloudServerOutlined />,
      label: '环境',
      children: [
        {
          key: '/environments',
          icon: <CloudServerOutlined />,
          label: '环境管理',
        },
        {
          key: '/ephemeral-envs',
          icon: <CloudServerOutlined />,
          label: '临时环境',
        },
        {
          key: '/console/build-env',
          icon: <CloudServerOutlined />,
          label: '构建环境',
        },
        {
          key: '/console/iac',
          icon: <DatabaseOutlined />,
          label: 'IaC 管理',
        },
        {
          key: '/console/code-mgmt',
          icon: <ForkOutlined />,
          label: '代码管理',
        },
        {
          key: '/queue',
          icon: <UnorderedListOutlined />,
          label: '队列管理',
        },
        {
          key: '/vector-store',
          icon: <DatabaseOutlined />,
          label: '向量存储',
        },
      ],
    },
  ];

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    navigate(e.key);
    // Find menu item (including nested children at any depth)
    let foundLabel: string | undefined;
    for (const item of navMenuItems) {
      if (!item || !('key' in item)) continue;
      if (item.key === e.key) {
        foundLabel = 'label' in item ? String(item.label) : undefined;
        break;
      }
      // Check children (2 levels deep)
      if ('children' in item && item.children) {
        for (const child of item.children) {
          if (!child || !('key' in child)) continue;
          if (child.key === e.key) {
            foundLabel = 'label' in child ? String(child.label) : undefined;
            break;
          }
          // Check grandchildren
          if ('children' in child && child.children) {
            const grandchild = child.children.find((c) => c && 'key' in c && c.key === e.key);
            if (grandchild && 'label' in grandchild) {
              foundLabel = String(grandchild.label);
              break;
            }
          }
        }
        if (foundLabel) break;
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
    {
      key: '/console/confirmations',
      icon: <UnorderedListOutlined />,
      label: '人工确认',
    },
    {
      key: '/console/ai-cost',
      icon: <DollarCircleOutlined />,
      label: 'AI 成本',
    },
  ];

  const handleConsoleMenuClick: MenuProps['onClick'] = (e) => {
    navigate(e.key);
    // Update breadcrumbs for console menu items
    const labelMap: Record<string, string> = {
      '/console/plugins': '插件管理',
      '/console/settings': '系统配置',
      '/console/users': '用户管理',
      '/console/confirmations': '人工确认',
      '/console/ai-cost': 'AI 成本',
    };
    const label = labelMap[e.key];
    if (label) {
      setBreadcrumbs([{ title: '控制台', path: '/console' }, { title: label, path: e.key }]);
    }
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
            selectedKeys={selectedKeys}
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

          {/* 通知铃铛 */}
          <NotificationBell />

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
            ...(breadcrumbs || []),
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
