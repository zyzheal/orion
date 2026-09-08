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
 *
 * 组件化重构 (P2-9 Phase 267): 164->47行 (-71%)
 * 拆分 Components/TabItems + Components/GuideAlert
 */
import { useState } from 'react';
import { Tabs } from 'antd';
import { buildTabItems } from './Components/TabItems';
import { GuideAlert } from './Components/GuideAlert';

export default function ChatOpsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [showGuide, setShowGuide] = useState(() => {
    // 首次访问显示引导，关闭后不再显示
    return localStorage.getItem('chatops-guide-dismissed') !== 'true';
  });

  const dismissGuide = () => {
    setShowGuide(false);
    localStorage.setItem('chatops-guide-dismissed', 'true');
  };

  return (
    <div
      style={{
        padding: 0,
        height: 'calc(100vh - 64px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {showGuide && <GuideAlert onDismiss={dismissGuide} />}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={buildTabItems()}
        style={{ flex: 1, overflow: 'hidden' }}
        tabBarStyle={{ margin: 0, padding: showGuide ? '8px 16px 0' : '16px 16px 0' }}
        size="large"
      />
    </div>
  );
}
