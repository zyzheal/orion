/**
 * Developer Portal — pure data constants (no React, no hooks).
 *
 * Holds non-JSX option lists, label maps, empty-state copy and pagination
 * defaults. Anything containing a JSX element / icon must live in config.tsx.
 */
import type { SDKLanguage, PlaygroundBodyType } from './types';

/** HTTP methods used by mock rules and the playground builder. */
export const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

/** Body type options for the online playground request builder. */
export const playgroundBodyTypes: { value: PlaygroundBodyType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'json', label: 'JSON' },
  { value: 'form', label: 'Form' },
  { value: 'raw', label: 'Raw' },
];

/** Multi-language SDK generation targets. */
export const languageOptions: { value: SDKLanguage; label: string }[] = [
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'go', label: 'Go' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
];

/** Subscription plan options. */
export const subscriptionPlanOptions: { value: string; label: string }[] = [
  { value: 'free', label: '免费版' },
  { value: 'standard', label: '标准版' },
  { value: 'premium', label: '高级版' },
] as const;

/** Ant Design tag color for each HTTP method. */
export const httpMethodColorMap: Record<string, string> = {
  GET: 'green',
  POST: 'blue',
  PUT: 'orange',
  DELETE: 'red',
  PATCH: 'purple',
};

/** Tab key constants for the five top-level portal tabs. */
export const TAB_DOCS = 'docs' as const;
export const TAB_MOCK = 'mock' as const;
export const TAB_SDK = 'sdk' as const;
export const TAB_SUBSCRIPTIONS = 'subscriptions' as const;
export const TAB_PLAYGROUND = 'playground' as const;

/** All tab keys as an object, for switch/case and record lookups. */
export const TAB_KEYS = {
  DOCS: TAB_DOCS,
  MOCK: TAB_MOCK,
  SDK: TAB_SDK,
  SUBSCRIPTIONS: TAB_SUBSCRIPTIONS,
  PLAYGROUND: TAB_PLAYGROUND,
} as const;

/** Empty-state copy used inside each tab's table. */
export const EMPTY_STATES = {
  docs: '暂无文档，点击"创建文档"开始添加',
  mock: '暂无 Mock 规则',
  sdk: '暂无 SDK 任务',
  subscriptions: '暂无订阅',
  playground: '暂无保存的请求',
  playgroundForm: '填写请求参数并点击"发送请求"',
} as const;

/** Default table pagination shared by all five tabs. */
export const defaultPagination = { current: 1, pageSize: 10, total: 0 };

/** Empty statistics shapes used as initial useState values. */
export const emptyDocStats = {
  total: 0,
  published: 0,
  draft: 0,
  inReview: 0,
  totalViews: 0,
  totalHelpful: 0,
};

export const emptyMockStats = { total: 0, enabled: 0, disabled: 0 };

export const emptySdkStats = { total: 0, completed: 0, failed: 0, pending: 0 };

export const emptySubStats = {
  totalSubscriptions: 0,
  approved: 0,
  pending: 0,
  rejected: 0,
  suspended: 0,
};

export const emptyPgStats = { totalRequests: 0, totalExecutions: 0, avgLatency: 0 };
