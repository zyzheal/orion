/**
 * 子系统启动器 - 带动态效果的弹出式菜单
 */
import React, { useState } from 'react';
import { Popover, Card, Badge, Tag } from 'antd';
import {
  DatabaseOutlined,
  BookOutlined,
  DashboardOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

interface SubApp {
  key: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  path: string;
  status: 'running' | 'stopped' | 'loading';
  unreadCount?: number;
}

const subApps: SubApp[] = [
  {
    key: 'dba',
    name: '数据库管理',
    description: 'SQL 执行·数据建模',
    icon: <DatabaseOutlined />,
    color: '#1890ff',
    path: '/dba',
    status: 'running',
    unreadCount: 3,
  },
  {
    key: 'knowledge',
    name: '知识库',
    description: '文档管理·经验分享',
    icon: <BookOutlined />,
    color: '#52c41a',
    path: '/knowledge',
    status: 'running',
  },
  {
    key: 'visor',
    name: '监控中心',
    description: '系统监控·告警管理',
    icon: <DashboardOutlined />,
    color: '#722ed1',
    path: '/visor',
    status: 'running',
    unreadCount: 1,
  },
];

const SubAppLauncher: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleAppClick = (app: SubApp) => {
    navigate(app.path);
    setOpen(false);
  };

  const popoverContent = (
    <div style={{ minWidth: 320 }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ fontWeight: 600, fontSize: 16 }}>子系统应用</div>
        <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
          点击图标进入相应的子系统
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {subApps.map((app, index) => (
          <div
            key={app.key}
            onClick={() => handleAppClick(app)}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: 16,
              borderRadius: 12,
              marginBottom: index < subApps.length - 1 ? 12 : 0,
              background: `${app.color}08`,
              border: `1px solid ${app.color}20`,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateX(8px)';
              e.currentTarget.style.boxShadow = `0 4px 12px ${app.color}30`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateX(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* 动态背景效果 */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `linear-gradient(90deg, transparent, ${app.color}10, transparent)`,
                transform: 'translateX(-100%)',
                transition: 'transform 0.5s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateX(100%)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateX(-100%)';
              }}
            />

            {/* 图标 */}
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: app.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                color: '#fff',
                marginRight: 16,
                position: 'relative',
                zIndex: 1,
                boxShadow: `0 4px 12px ${app.color}40`,
              }}
            >
              {app.icon}
            </div>

            {/* 信息 */}
            <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 15, color: '#333' }}>
                  {app.name}
                </span>
                <Badge status="success" style={{ marginRight: 0 }} />
              </div>
              <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                {app.description}
              </div>
            </div>

            {/* 未读消息 */}
            {app.unreadCount ? (
              <Badge
                count={app.unreadCount}
                offset={[-12, 0]}
                style={{
                  backgroundColor: '#ff4d4f',
                  position: 'relative',
                  zIndex: 2,
                }}
              />
            ) : null}
          </div>
        ))}
      </div>

      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid #f0f0f0',
          textAlign: 'center',
          fontSize: 12,
          color: '#999',
        }}
      >
        按 <kbd style={{ padding: '2px 6px', background: '#f5f5f5', borderRadius: 4 }}>Esc</kbd> 关闭
      </div>
    </div>
  );

  return (
    <Popover
      content={popoverContent}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomLeft"
      overlayStyle={{ maxWidth: 400 }}
      overlayInnerStyle={{ padding: 0, borderRadius: 12 }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 48,
          height: 48,
          borderRadius: 12,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.6)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
        }}
      >
        {/* 脉冲动画效果 */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.3)',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        />
        <AppstoreOutlined
          style={{
            fontSize: 24,
            color: '#fff',
            position: 'relative',
            zIndex: 1,
          }}
        />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.5);
            opacity: 0.5;
          }
        }
      `}</style>
    </Popover>
  );
};

export default SubAppLauncher;
