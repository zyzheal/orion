/**
 * ChatOps 主页面 - Tab 分页结构
 * Tab 1: 总览看板 (默认)
 * Tab 2: 对话工作台
 * Tab 3: 执行记录
 * Tab 4: 设置
 */
import React, { useState } from 'react';
import { Tabs } from 'antd';
import { DashboardOutlined, MessageOutlined, PlayCircleOutlined, SettingOutlined } from '@ant-design/icons';
import ChatDashboard from './ChatDashboard';
import ChatOpsChat from './index.chat';
import ExecutionDashboard from './ExecutionDashboard';
import ChatOpsSettings from './ChatOpsSettings';

export default function ChatOpsPage() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div style={{ padding: 0, height: 'calc(100vh - 64px)', overflow: 'auto' }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'dashboard',
            label: (
              <span>
                <DashboardOutlined />
                总览看板
              </span>
            ),
            children: <ChatDashboard />,
          },
          {
            key: 'chat',
            label: (
              <span>
                <MessageOutlined />
                对话工作台
              </span>
            ),
            children: <ChatOpsChat />,
          },
          {
            key: 'executions',
            label: (
              <span>
                <PlayCircleOutlined />
                执行记录
              </span>
            ),
            children: <ExecutionDashboard />,
          },
          {
            key: 'settings',
            label: (
              <span>
                <SettingOutlined />
                设置
              </span>
            ),
            children: <ChatOpsSettings />,
          },
        ]}
      />
    </div>
  );
}