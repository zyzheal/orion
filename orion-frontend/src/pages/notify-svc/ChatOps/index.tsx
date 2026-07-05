/**
 * ChatOps 主页面 - Tab 分页结构
 *
 * 定位说明：
 * - 本页：ChatOps 管理中心（分析、历史、审计、配置）
 * - 右下角悬浮助手：日常对话交互入口（点击右下角按钮打开）
 *
 * Tab 结构（设计文档: chatops-dashboard-design.md）:
 * 1. 总览看板 - 执行统计、趋势分析、热门命令、平台分布
 * 2. 执行记录 - 命令执行历史列表
 * 3. 审计日志 - 审计日志查看与导出
 * 4. 管理配置 - 命令-Capability 映射、审批配置
 */
import _React, { useState } from 'react';
import { Tabs, Alert } from 'antd';
import {
  DashboardOutlined,
  PlayCircleOutlined,
  AuditOutlined,
  SettingOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import ChatDashboard from './ChatDashboard';
import ExecutionDashboard from './ExecutionDashboard';
import AuditLogViewer from './AuditLogViewer';
import AdminSettings from './AdminSettings';
import { colors } from '@/tokens';

export default function ChatOpsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [showGuide, setShowGuide] = useState(() => {
    // 首次访问显示引导，关闭后不再显示
    return localStorage.getItem('chatops-guide-dismissed') !== 'true';
  });

  const tabItems = [
    {
      key: 'overview',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500 }}>
          <DashboardOutlined />
          总览看板
        </span>
      ),
      children: <ChatDashboard />,
    },
    {
      key: 'executions',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500 }}>
          <PlayCircleOutlined />
          执行记录
        </span>
      ),
      children: <ExecutionDashboard />,
    },
    {
      key: 'audit',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500 }}>
          <AuditOutlined />
          审计日志
        </span>
      ),
      children: <AuditLogViewer />,
    },
    {
      key: 'admin',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500 }}>
          <SettingOutlined />
          管理配置
        </span>
      ),
      children: <AdminSettings />,
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
              {' '}本页为<span style={{ color: colors.primary[500], fontWeight: 500 }}>管理中心</span>（数据看板、命令文档、执行记录、配置管理）。
              {' '}需要对话操作？点击页面<span style={{ color: colors.primary[500], fontWeight: 500 }}>右下角</span>的悬浮按钮打开 AI 助手。
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
        tabBarStyle={{ margin: 0, padding: showGuide ? '8px 16px 0' : '16px 16px 0' }}
        size="large"
      />
    </div>
  );
}
