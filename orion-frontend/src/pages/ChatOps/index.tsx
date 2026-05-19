/**
 * ChatOps 主页面 - Tab 分页结构
 *
 * 定位说明：
 * - 本页：ChatOps 管理中心（分析、命令、历史、配置）
 * - 右下角悬浮助手：日常对话交互入口（点击右下角按钮打开）
 */
import React, { useState } from 'react';
import { Tabs, Alert } from 'antd';
import { DashboardOutlined, BookOutlined, PlayCircleOutlined, SettingOutlined, CloseOutlined } from '@ant-design/icons';
import ChatDashboard from './ChatDashboard';
import CommandBrowser from './CommandBrowser';
import ExecutionDashboard from './ExecutionDashboard';
import ChatOpsSettings from './ChatOpsSettings';

export default function ChatOpsPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showGuide, setShowGuide] = useState(() => {
    // 首次访问显示引导，关闭后不再显示
    return localStorage.getItem('chatops-guide-dismissed') !== 'true';
  });

  const tabItems = [
    {
      key: 'dashboard',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <DashboardOutlined />
          数据看板
        </span>
      ),
      children: <ChatDashboard />,
    },
    {
      key: 'commands',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <BookOutlined />
          命令中心
        </span>
      ),
      children: <CommandBrowser />,
    },
    {
      key: 'executions',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <PlayCircleOutlined />
          执行记录
        </span>
      ),
      children: <ExecutionDashboard />,
    },
    {
      key: 'settings',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <SettingOutlined />
          配置管理
        </span>
      ),
      children: <ChatOpsSettings />,
    },
  ];

  return (
    <div style={{ padding: 0, height: 'calc(100vh - 64px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* 使用引导 */}
      {showGuide && (
        <Alert
          type="info"
          style={{ margin: '8px 16px 0', borderRadius: 8 }}
          message={
            <span style={{ fontSize: 13 }}>
              <strong>如何使用 ChatOps？</strong>
              {' '}本页为<span style={{ color: '#3370e6', fontWeight: 500 }}>管理中心</span>（数据看板、命令文档、执行记录、配置管理）。
              {' '}需要对话操作？点击页面<span style={{ color: '#3370e6', fontWeight: 500 }}>右下角</span>的悬浮按钮打开 AI 助手。
            </span>
          }
          action={
            <a onClick={() => { setShowGuide(false); localStorage.setItem('chatops-guide-dismissed', 'true'); }} style={{ fontSize: 12 }}>
              <CloseOutlined /> 不再提示
            </a>
          }
          closable
          onClose={() => { setShowGuide(false); localStorage.setItem('chatops-guide-dismissed', 'true'); }}
        />
      )}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        style={{ flex: 1, overflow: 'hidden' }}
        tabBarStyle={{ margin: 0, padding: showGuide ? '8px 16px 0' : '0 16px' }}
      />
    </div>
  );
}
