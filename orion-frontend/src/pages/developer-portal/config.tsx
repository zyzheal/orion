/**
 * DeveloperPortal Configuration — config maps extracted from DeveloperPortalPage.tsx
 */
import React from 'react';
import type { SDKLanguage } from '@/api/developer-portal';
import {
  ApiOutlined,
  DownloadOutlined,
  RocketOutlined,
  FileTextOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';

export const documentTypeConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> =
  {
    api_doc: { label: 'API 文档', color: 'blue', icon: <ApiOutlined /> },
    sdk: { label: 'SDK', color: 'green', icon: <DownloadOutlined /> },
    guide: { label: '指南', color: 'orange', icon: <RocketOutlined /> },
    tutorial: { label: '教程', color: 'purple', icon: <FileTextOutlined /> },
    reference: { label: '参考', color: 'cyan', icon: <FileTextOutlined /> },
    sample: { label: '示例', color: 'gold', icon: <ThunderboltOutlined /> },
  };

export const statusConfig: Record<string, { label: string; color: string }> = {
  published: { label: '已发布', color: 'green' },
  draft: { label: '草稿', color: 'default' },
};

export const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

export const languageOptions: { value: SDKLanguage; label: string }[] = [
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'go', label: 'Go' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
];

export const subscriptionStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待审批', color: 'orange' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已拒绝', color: 'red' },
  suspended: { label: '已暂停', color: 'default' },
  cancelled: { label: '已取消', color: 'default' },
};

export const sdkStatusMap: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: '等待中', color: 'default', icon: <ClockCircleOutlined /> },
  generating: { label: '生成中', color: 'processing', icon: <SyncOutlined spin /> },
  completed: { label: '已完成', color: 'success', icon: <CheckCircleOutlined /> },
  failed: { label: '失败', color: 'error', icon: <CloseCircleOutlined /> },
};

export type TabKey = 'docs' | 'mock' | 'sdk' | 'subscriptions' | 'playground';

export const TAB_KEYS: Record<string, TabKey> = {
  DOCS: 'docs',
  MOCK: 'mock',
  SDK: 'sdk',
  SUBSCRIPTIONS: 'subscriptions',
  PLAYGROUND: 'playground',
};
