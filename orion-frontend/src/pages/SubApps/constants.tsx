/**
 * constants.tsx - SubApps 常量定义
 * 抽取自 index.tsx (P2-9 Phase 225)
 */
import React from 'react';
import {
  DatabaseOutlined,
  BookOutlined,
  DashboardOutlined,
  CodeOutlined,
  CloudOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';

export interface SubAppCard {
  key: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  path: string;
  tags: string[];
}

export const iconMap: Record<string, React.ReactNode> = {
  '/dba': <DatabaseOutlined />,
  '/knowledge': <BookOutlined />,
  '/visor': <DashboardOutlined />,
  '/ai-gateway': <CloudOutlined />,
  '/agents': <CodeOutlined />,
  '/ai-security': <SafetyOutlined />,
};

export const colorMap: Record<string, string> = {
  '/dba': colors.primary[500],
  '/knowledge': colors.success[500],
  '/visor': colors.purple[500],
  '/ai-gateway': colors.primary[500],
  '/agents': colors.warning[500],
  '/ai-security': colors.error[500],
};

export const defaultSubApps: SubAppCard[] = [
  {
    key: 'dba',
    name: '数据库管理',
    description: '提供数据库连接管理、SQL 执行、数据建模、性能监控等功能',
    icon: <DatabaseOutlined />,
    color: colors.primary[500],
    path: '/dba',
    tags: ['数据库', 'SQL', '管理工具'],
  },
  {
    key: 'knowledge',
    name: '知识库',
    description: '团队知识沉淀、文档管理、经验分享、最佳实践收集',
    icon: <BookOutlined />,
    color: colors.success[500],
    path: '/knowledge',
    tags: ['文档', '知识管理', '协作'],
  },
  {
    key: 'visor',
    name: '监控中心',
    description: '系统监控、告警管理、性能分析、日志查询一体化平台',
    icon: <DashboardOutlined />,
    color: colors.purple[500],
    path: '/visor',
    tags: ['监控', '告警', '分析'],
  },
];
