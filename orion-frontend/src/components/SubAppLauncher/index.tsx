/**
 * 子系统启动器 - 侧边栏抽屉式菜单
 * 参考 ChatOps ChatPanel 的 Drawer 模式
 */
import React, { useEffect } from 'react';
import { Drawer, Typography } from 'antd';
import {
  DatabaseOutlined,
  BookOutlined,
  DashboardOutlined,
  AppstoreOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { colors } from '@/tokens/colors';
import { useSubAppStore } from '@/stores/subappStore';
import { spacing } from '@/tokens';

const { Text } = Typography;

/** UI-facing sub-app card data (derived from SubAppConfig store) */
interface SubApp {
  key: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  path: string;
  status: 'running' | 'stopped' | 'error';
}

// 子应用图标映射
const iconMap: Record<string, React.ReactNode> = {
  dba: <DatabaseOutlined />,
  knowledge: <BookOutlined />,
  visor: <DashboardOutlined />,
};

// 子应用颜色映射
const colorMap: Record<string, string> = {
  dba: colors.primary[500],
  knowledge: colors.success[500],
  visor: colors.purple[500],
};

// 触发器按钮组件
interface SubAppTriggerProps {
  onClick: () => void;
}

const SubAppTrigger: React.FC<SubAppTriggerProps> = ({ onClick }) => (
  <div
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 32,
      height: 32,
      borderRadius: 8,
      background: `linear-gradient(135deg, ${colors.primary[400]}, ${colors.primary[600]})`,
      cursor: 'pointer',
      transition: 'all 0.2s',
      boxShadow: `0 2px 8px ${colors.primary[400]}30`,
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'scale(1.08)';
      e.currentTarget.style.boxShadow = `0 4px 12px ${colors.primary[400]}50`;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'scale(1)';
      e.currentTarget.style.boxShadow = `0 2px 8px ${colors.primary[400]}30`;
    }}
  >
    <AppstoreOutlined style={{ fontSize: 15, color: colors.neutral[0] }} />
  </div>
);

// 子系统卡片
interface SubAppCardProps {
  app: SubApp;
  onClick: () => void;
}

const SubAppCard: React.FC<SubAppCardProps> = ({ app, onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: colors.light.bg.primary,
      border: `1px solid ${colors.light.border.light}`,
      borderRadius: 12,
      padding: '14px 16px',
      cursor: 'pointer',
      transition: 'all 0.2s',
      display: 'flex',
      gap: spacing[3],
      alignItems: 'center',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = colors.primary[300];
      e.currentTarget.style.boxShadow = `0 2px 8px ${colors.primary[100]}`;
      e.currentTarget.style.background = colors.primary[50];
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = colors.light.border.light;
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.background = colors.light.bg.primary;
    }}
  >
    <div
      style={{
        width: 42,
        height: 42,
        borderRadius: 10,
        background: app.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 20,
        color: colors.neutral[0],
        flexShrink: 0,
        boxShadow: `0 3px 8px ${app.color}40`,
      }}
    >
      {app.icon}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text strong style={{ fontSize: 14 }}>{app.name}</Text>
      </div>
      <Text type="secondary" style={{ fontSize: 12 }}>{app.description}</Text>
    </div>
  </div>
);

// 主组件
export const SubAppLauncher: React.FC & { Trigger: React.FC<SubAppTriggerProps> } = () => {
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const { apps: subAppsList, fetchApps } = useSubAppStore();

  // 打开时获取子应用列表
  useEffect(() => {
    if (open) {
      fetchApps();
    }
  }, [open, fetchApps]);

  // 将后端数据转换为组件需要的格式
  const subApps: SubApp[] = subAppsList
    .filter((app) => app.status === 'enabled')
    .map((app) => ({
      key: app.key,
      name: app.name,
      description: app.description || '',
      icon: iconMap[app.key] || <AppstoreOutlined />,
      color: colorMap[app.key] || colors.primary[500],
      path: `/${app.key}`,
      status: 'running' as const,
    }));

  const handleAppClick = (app: SubApp) => {
    setOpen(false);
    // 延迟跳转确保 Drawer 关闭动画开始
    setTimeout(() => navigate(app.path), 50);
  };

  return (
    <>
      <SubAppTrigger onClick={() => setOpen(true)} />

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        width={360}
        placement="left"
        destroyOnClose={false}
        mask={false}
        styles={{
          body: {
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            background: colors.light.bg.primary,
          },
          header: { display: 'none' },
          mask: { background: 'transparent' },
        }}
        style={{
          boxShadow: '8px 0 32px rgba(0,0,0,0.1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: `1px solid ${colors.light.border.light}`,
            background: colors.light.bg.primary,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: `linear-gradient(135deg, ${colors.primary[400]}, ${colors.primary[600]})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppstoreOutlined style={{ fontSize: 15, color: colors.neutral[0] }} />
            </div>
            <Text strong style={{ fontSize: 15 }}>子系统应用</Text>
          </div>
          <div
            onClick={() => setOpen(false)}
            style={{
              cursor: 'pointer',
              width: 28,
              height: 28,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
              color: colors.light.text.tertiary,
              fontSize: 12,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.light.bg.secondary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <CloseOutlined />
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            background: colors.light.bg.secondary,
            padding: '16px',
          }}
        >
          <Text type="secondary" style={{ fontSize: 12, marginBottom: spacing[3], display: 'block' }}>
            点击图标进入相应的子系统
          </Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {subApps.map((app) => (
              <SubAppCard key={app.key} app={app} onClick={() => handleAppClick(app)} />
            ))}
          </div>
        </div>
      </Drawer>
    </>
  );
};

// 导出 Trigger 以便在 Layout 中单独使用
SubAppLauncher.Trigger = SubAppTrigger;

export default SubAppLauncher;
