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
  CloudUploadOutlined,
  ExperimentOutlined,
  ApiOutlined,
  SecurityScanOutlined,
  DownOutlined,
  EditOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { GetProp } from 'antd';
import { useAppStore } from '@/stores/appStore';
import { useAuth } from '@/hooks/useAuth';
import SubAppLauncher from '@/components/SubAppLauncher';
import { useNavigate, useLocation } from 'react-router-dom';
import { NotificationBell } from '@/components/NotificationBell';
import { ChatTrigger, ChatPanel } from '@/components/ChatOps';
import { initializeChatOpsStore } from '@/stores/chatOpsStore';
import { useMenuConfigStore, type MenuModuleConfig } from '@/stores/menuConfigStore';
import { MenuConfigPanel } from '@/components/MenuConfig';
import { colors } from '@/tokens/colors';

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

// 图标映射：key -> icon component
const iconMap: Record<string, React.ReactNode> = {
  '/dashboard': <DashboardOutlined />,
  '/ops': <CloudServerOutlined />,
  '/tickets': <UnorderedListOutlined />,
  '/bi': <BarChartOutlined />,
  '/subapps': <AppstoreOutlined />,
  '/product-lines': <ForkOutlined />,
  '/artifacts': <InboxOutlined />,
  '/internal-libraries': <DeploymentUnitOutlined />,
  '/projects': <ProjectOutlined />,
  '/ai': <RocketOutlined />,
  '/governance': <SettingOutlined />,
  '/dev-env': <CloudServerOutlined />,
  // children
  '/pipelines': <RocketOutlined />,
  '/deployments': <CloudServerOutlined />,
  '/monitoring': <EyeOutlined />,
  '/console/monitoring': <EyeOutlined />,
  '/alerts': <AlertOutlined />,
  '/diagnostic': <EyeOutlined />,
  '/console/diagnostic': <EyeOutlined />,
  '/finops': <DollarCircleOutlined />,
  '/self-healing': <RocketOutlined />,
  '/console/self-healing': <RocketOutlined />,
  '/canary-analysis': <BarChartOutlined />,
  '/change-intelligence': <BarChartOutlined />,
  '/eventbus': <DeploymentUnitOutlined />,
  '/metrics-dashboard': <BarChartOutlined />,
  '/test-selector': <ExperimentOutlined />,
  '/workbench': <DashboardOutlined />,
  '/dashboard/executive': <DashboardOutlined />,
  '/dashboard/manager': <TeamOutlined />,
  '/dashboard/engineer': <UserSwitchOutlined />,
  '/efficiency-dashboard': <BarChartOutlined />,
  '/risk-dashboard': <AlertOutlined />,
  '/dba': <DatabaseOutlined />,
  '/knowledge': <BookOutlined />,
  '/visor': <EyeOutlined />,
  '/ai-gateway': <RocketOutlined />,
  '/agents': <AppstoreOutlined />,
  '/console/ai-review': <EyeOutlined />,
  '/console/ai-docs': <BookOutlined />,
  '/console/chatops': <RocketOutlined />,
  '/ai-security': <SecurityScanOutlined />,
  '/policies': <SettingOutlined />,
  '/audit-log': <UnorderedListOutlined />,
  '/tenant-management': <TeamOutlined />,
  '/roles': <UserSwitchOutlined />,
  '/config-management': <SettingOutlined />,
  '/cmdb': <DatabaseOutlined />,
  '/skills': <AppstoreOutlined />,
  '/sbom': <EyeOutlined />,
  '/approvals': <CheckCircleOutlined />,
  '/oncall': <ClockCircleOutlined />,
  '/sessions': <UserSwitchOutlined />,
  '/backup': <CloudUploadOutlined />,
  '/plugin-spi': <ApiOutlined />,
  '/environments': <CloudServerOutlined />,
  '/ephemeral-envs': <CloudServerOutlined />,
  '/console/build-env': <CloudServerOutlined />,
  '/console/iac': <DatabaseOutlined />,
  '/console/code-mgmt': <ForkOutlined />,
  '/queue': <UnorderedListOutlined />,
  '/vector-store': <DatabaseOutlined />,
  // AI 子菜单
  '/llm-trace': <EyeOutlined />,
  '/ai-cost': <DollarCircleOutlined />,
  '/ai/knowledge': <BookOutlined />,
};

const getIcon = (key: string): React.ReactNode => iconMap[key] || <SettingOutlined />;

// 从 store 构建导航菜单项
function buildNavMenuItems(modules: Record<string, MenuModuleConfig>): NavItemDef[] {
  return Object.values(modules)
    .filter((m) => m.enabled)
    .map((m) => ({
      key: m.key,
      icon: getIcon(m.key),
      label: m.label,
      description: m.description,
      hasPanel: !!(m.children && m.children.length > 0 && m.systemTitle),
      systemTitle: m.systemTitle,
      systemDescription: m.systemDescription,
      children: (m.children || [])
        .filter((c) => c.enabled)
        .map((c) => ({
          key: c.key,
          icon: getIcon(c.key),
          label: c.label,
          description: c.description,
          category: c.category,
        })),
    }));
}

// 左侧面板 - 系统概览信息
interface SystemPanelProps {
  title: string;
  description: string;
  categoryItems: { key: string; icon: React.ReactNode; label: string; category: string }[];
  theme: 'light' | 'dark';
  onNavigate: (key: string, label: string) => void;
}

const SystemPanel: React.FC<SystemPanelProps> = ({ title, description, categoryItems, theme, onNavigate }) => {
  const isDark = theme === 'dark';
  const grouped = categoryItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof categoryItems>);

  return (
    <div
      style={{
        width: 260,
        padding: '24px 16px',
        background: isDark
          ? 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(139,92,246,0.1) 100%)'
          : 'linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(139,92,246,0.06) 100%)',
        borderRadius: '12px 0 0 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {/* 系统名称和描述 */}
      <div>
        <div style={{
          fontSize: 18,
          fontWeight: 600,
          color: isDark ? 'rgba(255,255,255,0.95)' : '#1f2329',
          marginBottom: 8,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 13,
          color: isDark ? 'rgba(255,255,255,0.5)' : '#8f959e',
          lineHeight: '20px',
        }}>
          {description}
        </div>
      </div>

      {/* 分类导航 */}
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <div style={{
            fontSize: 12,
            fontWeight: 500,
            color: isDark ? 'rgba(255,255,255,0.35)' : '#c0c4cc',
            marginBottom: 8,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {category}
          </div>
          {items.map((item) => (
            <div
              key={item.key}
              onClick={() => onNavigate(item.key, item.label)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'background 0.15s',
                color: isDark ? 'rgba(255,255,255,0.7)' : '#1f2329',
                fontSize: 14,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

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
  const txtColor = isDark ? 'rgba(255,255,255,0.65)' : '#646a73';
  const activeTxtColor = isDark ? 'rgba(255,255,255,0.95)' : '#1f2329';
  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : '#f2f3f5';

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
          color: isDark ? 'rgba(255,255,255,0.35)' : '#bfbfbf',
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

  // 从 store 构建导航菜单项（响应式）
  const navMenuItems = React.useMemo(() => buildNavMenuItems(modules), [modules]);

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
  }, [location.pathname]);

  const handleNavigate = (key: string, label: string) => {
    setMegaMenuKey(null);
    navigate(key);
    setBreadcrumbs([
      { title: '首页', path: '/' },
      { title: label, path: key },
    ]);
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
    const labelMap: Record<string, string> = {
      '/console/plugins': '插件管理',
      '/console/settings': '系统配置',
      '/console/users': '用户管理',
      '/console/confirmations': '人工确认',
    };
    const label = labelMap[e.key];
    if (label) {
      setBreadcrumbs([
        { title: '控制台', path: '/console' },
        { title: label, path: e.key },
      ]);
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
          background: theme === 'dark' ? colors.dark.bg.primary : '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : '#e8e8e8'}`,
          height: 60,
          lineHeight: '60px',
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
              e.currentTarget.style.background =
                theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.04)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
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

          {/* 顶部导航菜单 - 飞书风格 hover 下拉 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 60,
              overflow: 'hidden',
            }}
          >
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
                right: 0,
                zIndex: 999,
                animation: 'megaMenuFadeIn 0.2s ease-out',
              }}
            >
              <div
                style={{
                  background: isDark ? colors.dark.bg.elevated : colors.light.bg.primary,
                  boxShadow: isDark
                    ? '0 6px 20px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.3)'
                    : '0 6px 20px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)',
                  borderBottom: `1px solid ${isDark ? colors.dark.border.default : colors.light.border.light}`,
                  transition: 'background 0.2s, border-color 0.2s',
                }}
              >
                {/* 内容区域 - 居中 */}
                <div style={{
                  maxWidth: 1200,
                  margin: '0 auto',
                  padding: '16px 24px',
                  display: 'flex',
                  gap: 24,
                  maxHeight: 'calc(100vh - 80px)',
                  overflow: 'hidden',
                }}>
                  {activeItem.hasPanel && activeItem.systemTitle && (
                    <SystemPanel
                      title={activeItem.systemTitle}
                      description={activeItem.systemDescription || ''}
                      categoryItems={activeItem.children.map(c => ({ key: c.key, icon: c.icon, label: c.label, category: c.category || '其他' }))}
                      theme={theme}
                      onNavigate={handleNavigate}
                    />
                  )}

                  <div style={{
                    flex: 1,
                    padding: '4px 0',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '8px 24px',
                    alignContent: 'start',
                    overflowY: 'auto',
                  }}>
                    {activeItem.children.map((child) => (
                      <div
                        key={child.key}
                        onClick={() => handleNavigate(child.key, child.label)}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          padding: '12px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : colors.neutral[100];
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = 'transparent';
                        }}
                      >
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          background: isDark ? 'rgba(255,255,255,0.08)' : '#f0f1f3',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          color: colors.primary[500],
                          fontSize: 16,
                        }}>
                          {child.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 14,
                            fontWeight: 500,
                            color: isDark ? 'rgba(255,255,255,0.9)' : '#1f2329',
                            lineHeight: '22px',
                            marginBottom: child.description ? 2 : 0,
                          }}>
                            {child.label}
                          </div>
                          {child.description && (
                            <div style={{
                              fontSize: 12,
                              color: isDark ? 'rgba(255,255,255,0.4)' : '#8f959e',
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
              </div>
            </div>
          </>
        );
      })()}

      {/* 面包屑导航 */}
      <div
        style={{
          background: theme === 'dark' ? colors.dark.bg.primary : colors.light.bg.tertiary,
          padding: '6px 32px',
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
