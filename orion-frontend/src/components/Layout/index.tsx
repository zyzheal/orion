/**
 * 新版 Layout - 飞书风格顶部导航栏设计
 * - 固定顶部导航
 * - 左上角：子系统启动器 + 系统名称 (可点击返回首页)
 * - 导航项 hover 触发下拉面板（飞书风格 mega menu）
 * - 右上角：主题切换 + 控制台 (管理员) + 用户菜单
 */
import React, { useEffect } from 'react';
import { Layout as AntLayout, Avatar, Dropdown, Breadcrumb, Button } from 'antd';
import {
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  MoonOutlined,
  SunOutlined,
  HomeOutlined,
  ControlOutlined,
  UnorderedListOutlined,
  EditOutlined,
  DownOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { GetProp } from 'antd';
import { useAppStore } from '@/stores/appStore';
import { useAuth } from '@/hooks/useAuth';
import SubAppLauncher from '@/components/SubAppLauncher';
import { useNavigate, useLocation } from 'react-router-dom';
import { NotificationBell } from '@/components/NotificationBell';
import { ChatTrigger, ChatPanel } from '@/components/ChatOps';
import { TenantSelector } from '@/components/TenantSelector';
import { initializeChatOpsStore } from '@/stores/chatOpsStore';
import { useMenuConfigStore, type MenuModuleConfig, type MenuChildConfig } from '@/stores/menuConfigStore';
import { useSubAppStore } from '@/stores/subappStore';
import { MenuConfigPanel } from '@/components/MenuConfig';
import { colors } from '@/tokens/colors';
import { getIcon } from './iconMap';
import { prefetchSubApp } from '@/utils/subappPreload';

type ItemType = GetProp<MenuProps, 'items'>[number];

const { Header, Content, Footer } = AntLayout;

interface NavChildItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
  category?: string;
}

interface NavItemDef {
  key: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
  children?: NavChildItem[];
  systemTitle?: string;
  systemDescription?: string;
  hasPanel?: boolean;
}

// 从 store 构建导航菜单项
function buildNavMenuItems(
  modules: Record<string, MenuModuleConfig>,
  subApps?: { key: string; name: string; description: string; status: string }[]
): NavItemDef[] {
  return Object.values(modules)
    .filter((m) => m.enabled)
    .map((m) => {
      // 处理动态子应用：从后端 API 获取
      let children = m.children || [];
      if (m.isDynamicSubApps && subApps) {
        const subAppChildren = subApps
          .filter((app) => app.status === 'enabled')
          .map((app) => ({
            key: `/${app.key}`,
            icon: getIcon(app.key),
            label: app.name,
            description: app.description || '',
            category: '子系统' as const,
          }));
        children = [...children, ...subAppChildren] as MenuChildConfig[];
      }

      return {
        key: m.key,
        icon: getIcon(m.key),
        label: m.label,
        description: m.description,
        hasPanel: !!(children.length > 0 && m.systemTitle),
        systemTitle: m.systemTitle,
        systemDescription: m.systemDescription,
        children: children
          .filter((c) => c.enabled)
          .map((c) => ({
            key: c.key,
            icon: getIcon(c.key),
            label: c.label,
            description: c.description,
            category: c.category,
          })),
      };
    });
}

// 飞书风格：hover 弹出全宽 mega menu 面板
interface FeishuNavItemProps {
  item: NavItemDef;
  isActive: boolean;
  theme: 'light' | 'dark';
  onNavigate: (key: string, label: string) => void;
  onMegaMenuToggle: (key: string | null) => void;
}

const FeishuNavItem: React.FC<FeishuNavItemProps> = ({ item, isActive, theme, onNavigate, onMegaMenuToggle }) => {
  const isDark = theme === 'dark';
  const hasChildren = item.children && item.children.length > 0;
  const txtColor = isDark ? 'rgba(255,255,255,0.65)' : colors.neutral[600];
  const activeTxtColor = isDark ? 'rgba(255,255,255,0.95)' : colors.neutral[800];
  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : colors.neutral[100];

  const navTrigger = (
    <div
      onClick={() => onNavigate(item.key, item.label)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: 56,
        padding: '0 14px',
        margin: '0 1px',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: isActive ? 500 : 400,
        color: isActive ? activeTxtColor : txtColor,
        transition: 'color 0.2s, background 0.15s',
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = hoverBg;
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      <span style={{ fontSize: 15, lineHeight: 1 }}>{item.icon}</span>
      <span style={{ lineHeight: '20px' }}>{item.label}</span>
      {hasChildren && (
        <DownOutlined style={{
          fontSize: 10,
          color: isDark ? 'rgba(255,255,255,0.35)' : colors.neutral[400],
          marginLeft: 2,
        }} />
      )}
      {isActive && (
        <span
          style={{
            position: 'absolute',
            bottom: 0,
            left: 12,
            right: 12,
            height: 2,
            borderRadius: '1px 1px 0 0',
            background: `linear-gradient(90deg, ${colors.primary[500]}, ${colors.primary[400]})`,
          }}
        />
      )}
    </div>
  );

  if (hasChildren) {
    return (
      <div
        onMouseEnter={() => onMegaMenuToggle(item.key)}
        onMouseLeave={() => onMegaMenuToggle(null)}
      >
        {navTrigger}
      </div>
    );
  }

  return navTrigger;
};

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme, breadcrumbs, setBreadcrumbs } = useAppStore();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { modules, loadConfig } = useMenuConfigStore();
  const [configOpen, setConfigOpen] = React.useState(false);
  const [megaMenuKey, setMegaMenuKey] = React.useState<string | null>(null);
  const megaMenuTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // 注入 Mega Menu 动画 keyframes
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes megaMenuFadeIn {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  const handleMegaMenuToggle = (key: string | null) => {
    // 清除之前的定时器
    if (megaMenuTimerRef.current) {
      clearTimeout(megaMenuTimerRef.current);
      megaMenuTimerRef.current = null;
    }

    if (key) {
      // 打开面板：立即设置
      setMegaMenuKey(key);
    } else {
      // 关闭面板：延迟 200ms，给用户足够时间从导航项移动到面板
      megaMenuTimerRef.current = setTimeout(() => {
        setMegaMenuKey(null);
      }, 200);
    }
  };

  // Initialize stores on mount
  React.useEffect(() => {
    initializeChatOpsStore();
    loadConfig();
  }, []);

  // 从 store 获取子应用状态（用于动态控制菜单显示）
  const { apps: subApps, fetchApps } = useSubAppStore();

  // 初始化时获取所有子应用（包含状态）
  React.useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  // 直接传递 subApps 到 buildNavMenuItems，由函数内部处理动态子应用
  const navMenuItems = React.useMemo(
    () => buildNavMenuItems(modules, subApps as { key: string; name: string; description: string; status: string }[]),
    [modules, subApps]
  );

  // 根据当前路由动态计算激活的菜单 key
  const activeKey = React.useMemo(() => {
    const path = location.pathname;
    for (const item of navMenuItems) {
      if (item.key === path) return item.key;
      if (item.children) {
        for (const child of item.children) {
          if (child.key === path) return item.key;
        }
      }
    }
    for (const item of navMenuItems) {
      if (item.key !== '/dashboard' && path.startsWith(item.key)) return item.key;
    }
    return '/dashboard';
  }, [location.pathname, navMenuItems]);

  // 面包屑自动同步：根据路由变化自动更新面包屑
  React.useEffect(() => {
    const path = location.pathname;
    // 跳过根路径
    if (path === '/' || path === '/login') {
      setBreadcrumbs([]);
      return;
    }

    // 从菜单配置中查找匹配的项
    for (const module of Object.values(modules)) {
      if (!module.enabled) continue;
      // 检查子菜单
      for (const child of module.children) {
        if (child.enabled && child.key === path) {
          setBreadcrumbs([
            { title: module.label, path: module.key },
            { title: child.label, path: child.key },
          ]);
          return;
        }
      }
      // 检查一级菜单
      if (module.key === path) {
        setBreadcrumbs([{ title: module.label, path: module.key }]);
        return;
      }
    }
  }, [location.pathname, modules]);

  const handleNavigate = (key: string, label: string) => {
    setMegaMenuKey(null);
    navigate(key);
    // 查找该子菜单所属的模块，构建完整面包屑
    for (const module of Object.values(modules)) {
      if (!module.enabled) continue;
      const child = module.children?.find(c => c.enabled && c.key === key);
      if (child) {
        setBreadcrumbs([
          { title: module.label, path: module.key },
          { title: child.label, path: child.key },
        ]);
        return;
      }
      if (module.key === key) {
        setBreadcrumbs([{ title: module.label, path: module.key }]);
        return;
      }
    }
    // 兜底
    setBreadcrumbs([{ title: label, path: key }]);
  };

  // 用户菜单
  const userMenuItems: ItemType[] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心',
      onClick: () => navigate('/profile'),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '个人设置',
      onClick: () => navigate('/settings'),
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

  // 控制台菜单（仅管理员）— 定位为系统级管理入口
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
          background: theme === 'dark' ? colors.dark.bg.primary : colors.neutral[0],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : colors.neutral[200]}`,
          height: 60,
          lineHeight: '60px',
          overflow: 'visible',
        }}
      >
        {/* 左侧：logo + 系统名称 */}
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
        >
          <SubAppLauncher />
          <img src="/logo.svg" alt="Orion" style={{ width: 28, height: 28, flexShrink: 0 }} />
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              background: `linear-gradient(135deg, ${colors.primary[500]} 0%, ${colors.purple[500]} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              whiteSpace: 'nowrap',
            }}
          >
            Orion Platform
          </span>
        </div>

        {/* 中间：导航菜单 - 居中 */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 60,
          }}
        >
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
          }}>
            {navMenuItems.map((item) => (
              <FeishuNavItem
                key={item.key}
                item={item}
                isActive={activeKey === item.key}
                theme={theme}
                onNavigate={handleNavigate}
                onMegaMenuToggle={handleMegaMenuToggle}
              />
            ))}
          </div>
        </div>

        {/* 右侧区域：控制台 + 主题 + 用户 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* 菜单配置入口（仅管理员） */}
          {isAdmin && (
            <Button
              icon={<EditOutlined />}
              type="text"
              size="large"
              onClick={() => setConfigOpen(true)}
              style={{
                fontSize: 18,
                color: theme === 'dark' ? colors.dark.text.primary : colors.light.text.secondary,
              }}
              title="菜单配置"
            />
          )}

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
                  color: theme === 'dark' ? colors.dark.text.primary : colors.light.text.secondary,
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
              color: theme === 'dark' ? colors.dark.text.primary : colors.light.text.secondary,
            }}
            title={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
          />

          {/* 通知铃铛 */}
          <NotificationBell />

          {/* ChatOps 触发器 */}
          <ChatTrigger />

          {/* 租户选择器 - 多租户时显示下拉，单租户时显示标签 */}
          <TenantSelector />

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
                e.currentTarget.style.background =
                  theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.04)';
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
                  background: `linear-gradient(135deg, ${colors.primary[500]} 0%, ${colors.purple[500]} 100%)`,
                }}
              />
              <span style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' }}>
                {user?.username || '用户'}
              </span>
            </div>
          </Dropdown>
        </div>
      </Header>

      {/* 全宽 Mega Menu 面板 - 飞书风格，面板全宽，内容居中 */}
      {megaMenuKey && (() => {
        const activeItem = navMenuItems.find(i => i.key === megaMenuKey);
        if (!activeItem || !activeItem.children || activeItem.children.length === 0) return null;
        const isDark = theme === 'dark';

        // 子应用 hover 预加载处理
        const handleSubAppHover = (childKey: string) => {
          const appKey = childKey.replace('/', '');
          if (!appKey || appKey.includes('/')) return;
          const remoteEntry = `/orion-${appKey}/remoteEntry.js`;
          prefetchSubApp(appKey, remoteEntry, { mode: 'idle' });
        };

        return (
          <>
            {/* 透明点击层 - 面板外区域点击关闭 */}
            <div
              style={{ position: 'fixed', top: 60, left: 0, right: 0, bottom: 0, zIndex: 998 }}
              onClick={() => handleMegaMenuToggle(null)}
            />
            {/* 面板容器 - 全宽，紧贴 Header 底部，带淡入动画 */}
            <div
              onMouseEnter={() => handleMegaMenuToggle(megaMenuKey)}
              onMouseLeave={() => handleMegaMenuToggle(null)}
              style={{
                position: 'fixed',
                top: 60,
                left: 0,
                width: '100vw',
                zIndex: 999,
                animation: 'megaMenuFadeIn 0.2s ease-out',
                background: isDark ? colors.dark.bg.elevated : colors.light.bg.primary,
                boxShadow: isDark
                  ? '0 6px 20px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.3)'
                  : '0 6px 20px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)',
                borderBottom: `1px solid ${isDark ? colors.dark.border.default : colors.light.border.light}`,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <div style={{
                width: '100%',
                maxWidth: 1200,
                padding: '16px 24px 24px',
                maxHeight: 'calc(100vh - 80px)',
                overflowY: 'auto',
              }}>
                {(() => {
                      const grouped: Record<string, typeof activeItem.children> = {};
                      for (const child of activeItem.children) {
                        const cat = child.category || '其他';
                        if (!grouped[cat]) grouped[cat] = [];
                        grouped[cat].push(child);
                      }
                      return Object.entries(grouped).map(([category, items]) => (
                        <div key={category}>
                          <div style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: isDark ? 'rgba(255,255,255,0.4)' : colors.neutral[500],
                            marginBottom: 8,
                            paddingLeft: 4,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}>
                            {category}
                          </div>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                            gap: '4px 16px',
                          }}>
                            {items.map((child) => (
                              <div
                                key={child.key}
                                onClick={() => handleNavigate(child.key, child.label)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: 12,
                                  padding: '10px 12px',
                                  borderRadius: 8,
                                  cursor: 'pointer',
                                  transition: 'background 0.15s',
                                }}
                                onMouseEnter={(e) => {
                                  (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : colors.neutral[100];
                                  // 子应用 hover 预加载
                                  handleSubAppHover(child.key);
                                }}
                                onMouseLeave={(e) => {
                                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                                }}
                              >
                                <div style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 8,
                                  background: isDark ? 'rgba(255,255,255,0.08)' : colors.neutral[100],
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  color: colors.primary[500],
                                  fontSize: 15,
                                }}>
                                  {child.icon}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{
                                    fontSize: 14,
                                    fontWeight: 500,
                                    color: isDark ? 'rgba(255,255,255,0.9)' : colors.neutral[800],
                                    lineHeight: '22px',
                                  }}>
                                    {child.label}
                                  </div>
                                  {child.description && (
                                    <div style={{
                                      fontSize: 12,
                                      color: isDark ? 'rgba(255,255,255,0.4)' : colors.neutral[500],
                                      lineHeight: '18px',
                                    }}>
                                      {child.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
            </div>
            </>
          );
      })()}

      {/* 顶部占位 - 防止内容被 fixed Header 遮挡 */}
      <div style={{ height: 60, flexShrink: 0 }} />

      {/* 面包屑导航 */}
      <div
        style={{
          background: theme === 'dark' ? colors.dark.bg.primary : colors.light.bg.tertiary,
          padding: '8px 32px',
          borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.04)' : colors.neutral[200]}`,
        }}
      >
        <Breadcrumb
          separator={<span style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.25)' : colors.neutral[300], margin: '0 8px' }}>/</span>}
          items={[
            {
              title: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <HomeOutlined style={{ fontSize: 13 }} />
                  <span style={{ fontSize: 13 }}>首页</span>
                </span>
              ),
              onClick: () => navigate('/dashboard'),
              style: { fontSize: 13 },
            } as any,
            ...((breadcrumbs || []).map(b => ({
              title: (
                <span style={{ fontSize: 13, color: theme === 'dark' ? 'rgba(255,255,255,0.65)' : colors.neutral[600] }}>
                  {b.title}
                </span>
              ),
              onClick: b.path ? () => navigate(b.path as string) : undefined,
              style: {
                fontSize: 13,
                cursor: b.path ? 'pointer' : 'default',
              },
            }))),
          ]}
        />
      </div>

      {/* 内容区域 */}
      <Content
        style={{
          margin: '20px 32px',
          background: theme === 'dark' ? colors.dark.bg.primary : colors.light.bg.primary,
          borderRadius: 12,
          padding: 32,
          minHeight: 'calc(100vh - 180px)',
          boxShadow: theme === 'dark'
            ? '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)'
            : '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        {children}
      </Content>

      {/* ChatOps 面板 - 固定在右下角 */}
      <ChatPanel />

      {/* 菜单配置面板（仅管理员） */}
      {isAdmin && <MenuConfigPanel open={configOpen} onClose={() => setConfigOpen(false)} />}

      {/* 页脚 */}
      <Footer
        style={{
          textAlign: 'center',
          background: 'transparent',
          color: theme === 'dark' ? colors.dark.text.tertiary : colors.neutral[400],
        }}
      >
        Orion Platform ©{new Date().getFullYear()} Created by Orion Team
      </Footer>
    </AntLayout>
  );
};
