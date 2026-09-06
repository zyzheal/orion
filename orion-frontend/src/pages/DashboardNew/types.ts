/**
 * types.ts - DashboardNew 类型定义
 * 抽取自 DashboardNew/index.tsx (P2-9 Phase 67)
 */
import type React from 'react';

export interface PipelineRecord {
  key: string;
  name: string;
  pipelineId: string;
  runId?: string;
  status: string;
  duration: string;
  trigger: string;
  time: string;
}

export interface TaskRecord {
  key: string;
  title: string;
  priority: string;
  status: string;
  assignee: string;
  due: string;
}

export interface SystemHealthItem {
  name: string;
  status: string;
  latency: string;
  uptime: string;
}

export interface QuickAction {
  name: string;
  icon: React.ReactNode;
  color: string;
  path: string;
}

export interface DashboardLink {
  name: string;
  icon: React.ReactNode;
  color: string;
  path: string;
  desc: string;
}
