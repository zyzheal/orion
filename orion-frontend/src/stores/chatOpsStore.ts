/**
 * ChatOps Zustand Store
 * L1: 内存中的当前会话状态
 *
 * 修复:
 * TE-9: 移除 IIFE 初始化，改为 initializeChatOpsStore() 延迟加载
 * TE-10: userId 从 useAuthStore.getState() 获取，替代 localStorage
 * TE-11: sendMessage 使用函数式更新 + isTyping 防抖，消除竞态
 * TE-12: executeAction 直接调用 executeCommand API，替代字符串拼接
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { ExtendedAction } from '@/components/ChatOps/types';
import type { CommandListResponse, RecommendationListResponse } from '@/types/api';
import {
  getCommands,
  executeCommand as executeCommandAPI,
  fetchRecommendations,
  getSessionMessages,
  markAlertRead as markAlertReadAPI,
  markAlertAcknowledged as markAlertAckAPI,
  markAlertDismissed as markAlertDismissedAPI,
} from '@/api/chatops';
import { CommandParser } from '@/components/ChatOps/CommandParser';
import { useAuthStore } from '@/stores/authStore';

// ---- Types ----

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: ExtendedAction[];
  status?: 'success' | 'failed' | 'running';
}

export interface Recommendation {
  id: string;
  type: 'alert' | 'blocked' | 'deploy_result' | 'selfhealing' | 'cost_anomaly';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  actions: ExtendedAction[];
  createdAt: Date;
  source: string;
  // Extended fields for frontend processing state
  status?: 'pending' | 'dismissed' | 'resolved' | 'archived';
  assignee?: string;
}

export interface PageContext {
  type: string;
  id?: string;
}

// ---- Store ----

interface ChatOpsState {
  // 面板状态
  isOpen: boolean;
  unreadAlerts: number;
  alertLevel: 'normal' | 'warning' | 'critical' | 'executing';

  // 对话
  messages: ChatMessage[];
  isTyping: boolean;
  sessionId: string | null;

  // 推荐
  recommendations: Recommendation[];
  isRecommendationLoading: boolean;

  // 上下文
  pageContext: PageContext | null;

  // 命令
  commands: Array<{
    id: string;
    name: string;
    subcommand: string;
    aliases: string[];
    schema: Record<string, unknown>;
    examples: string[];
  }>;

  // 分页
  isLoadingMore: boolean;
  hasMoreMessages: boolean;
  nextCursor: string | null;

  // 内存监控
  memoryCheckEnabled: boolean;

  // 执行防护 (防并发)
  isExecuting: boolean;

  // Actions
  toggle: () => void;
  open: () => void;
  close: () => void;

  sendMessage: (text: string) => Promise<void>;
  executeAction: (command: string, params: Record<string, unknown>) => Promise<void>;

  dismissRecommendation: (id: string) => void;
  fetchRecommendations: () => Promise<void>;

  setUnreadAlerts: (count: number) => void;
  setAlertLevel: (level: 'normal' | 'warning' | 'critical' | 'executing') => void;

  setPageContext: (ctx: PageContext | null) => void;

  loadMoreMessages: () => Promise<void>;
  trimOldMessages: (maxCount: number) => void;

  markAlertRead: (alertId: string) => Promise<void>;
  markAlertAcknowledged: (alertId: string) => Promise<void>;
  markAlertDismissed: (alertId: string) => Promise<void>;

  setMemoryCheckEnabled: (enabled: boolean) => void;
}

const parser = new CommandParser();

export const useChatOpsStore = create<ChatOpsState>()(
  subscribeWithSelector((set, get) => ({
    // 初始状态
    isOpen: false,
    unreadAlerts: 0,
    alertLevel: 'normal',
    messages: [],
    isTyping: false,
    sessionId: null,
    recommendations: [],
    isRecommendationLoading: false,
    pageContext: null,
    commands: [],
    isLoadingMore: false,
    hasMoreMessages: false,
    nextCursor: null,
    memoryCheckEnabled: true,
    isExecuting: false,

    toggle: () => set((state) => ({ isOpen: !state.isOpen })),
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false }),

    // TE-11: 函数式更新 + isTyping 防抖
    sendMessage: async (text: string) => {
      const { isTyping, messages } = get();
      if (isTyping) return; // 防抖: 正在处理中则忽略

      // 前端解析
      const parseResult = parser.parse(text);
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };

      // 单次函数式更新: 同时添加消息和设置 typing
      set({
        messages: [...messages, userMsg].slice(-500),
        isTyping: true,
      });

      if (!parseResult.success) {
        const errMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'system',
          content: parseResult.error || '无法识别命令',
          timestamp: new Date(),
        };
        set((state) => ({
          messages: [...state.messages, errMsg],
          isTyping: false,
        }));
        return;
      }

      try {
        const { command, params } = parseResult.parsed!;
        // TE-10: 从 authStore 获取 userId，替代 localStorage
        const userId =
          useAuthStore.getState().user?.id || useAuthStore.getState().user?.email || 'anonymous';

        const response = await executeCommandAPI({
          command,
          params,
          userId,
          platform: 'web',
          channel: 'chatops-panel',
        });

        const execData = ((response.data as any)?.data ?? response.data) as any;
        const aiMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: (execData as any).result?.output || `命令 ${command} 执行完成`,
          timestamp: new Date(),
          status: (execData as any).status === 'completed' ? 'success' : 'failed',
          actions: extractActionsFromResult(execData),
        };

        // TE-11: 函数式更新，基于当前 state 追加
        set((state) => ({
          messages: [...state.messages, aiMsg].slice(-500),
          isTyping: false,
        }));
      } catch (err) {
        set((state) => ({
          messages: [
            ...state.messages,
            {
              id: crypto.randomUUID(),
              role: 'system',
              content: `执行失败: ${err instanceof Error ? err.message : '未知错误'}`,
              timestamp: new Date(),
            },
          ],
          isTyping: false,
        }));
      }
    },

    // TE-12: 直接调用 API，不经过 CommandParser 二次解析
    // M-NEW-1: 添加 isExecuting 并发防护，防止快速点击导致多次调用
    executeAction: async (command: string, params: Record<string, unknown>) => {
      if (get().isExecuting) return; // 防并发

      // TE-10: 从 authStore 获取 userId
      const userId = useAuthStore.getState().user?.id || 'anonymous';

      set({ isTyping: true, alertLevel: 'executing', isExecuting: true });

      try {
        const response = await executeCommandAPI({
          command,
          params, // 直接传递结构化对象
          userId,
          platform: 'web',
          channel: 'chatops-panel',
        });

        const execData = ((response.data as any)?.data ?? response.data) as any;
        const aiMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: (execData as any).result?.output || `操作 ${command} 执行完成`,
          timestamp: new Date(),
          status: (execData as any).status === 'completed' ? 'success' : 'failed',
          actions: extractActionsFromResult(execData),
        };

        set((state) => ({
          messages: [...state.messages, aiMsg].slice(-500),
          isTyping: false,
          alertLevel: 'normal',
          isExecuting: false,
        }));
      } catch (err) {
        set((state) => ({
          messages: [
            ...state.messages,
            {
              id: crypto.randomUUID(),
              role: 'system',
              content: `操作失败: ${err instanceof Error ? err.message : '未知错误'}`,
              timestamp: new Date(),
            },
          ],
          isTyping: false,
          alertLevel: 'normal',
          isExecuting: false,
        }));
      }
    },

    dismissRecommendation: (id: string) => {
      set((state) => ({
        recommendations: state.recommendations.filter((r) => r.id !== id),
      }));
    },

    fetchRecommendations: async () => {
      set({ isRecommendationLoading: true });
      try {
        const response = await fetchRecommendations({});
        const recs = (response.data as RecommendationListResponse)?.data?.recommendations || [];
        set({
          recommendations: recs as any,
          unreadAlerts: recs.filter(
            (r: { severity?: string }) => r.severity === 'critical' || r.severity === 'warning'
          ).length,
        });
      } catch (err) {
        console.error('[ChatOps] Failed to fetch recommendations:', err);
      } finally {
        set({ isRecommendationLoading: false });
      }
    },

    setUnreadAlerts: (count: number) => set({ unreadAlerts: count }),
    setAlertLevel: (level) => set({ alertLevel: level }),
    setPageContext: (ctx) => set({ pageContext: ctx }),

    loadMoreMessages: async () => {
      const state = get();
      if (state.isLoadingMore || !state.sessionId) return;
      set({ isLoadingMore: true });
      try {
        const response = await getSessionMessages(state.sessionId, {
          limit: 50,
          cursor: state.nextCursor ?? undefined,
        });
        const data = (response.data as { data?: Array<{ id: string; role: 'user' | 'assistant' | 'system'; content: string; timestamp: Date; actions?: ExtendedAction[]; status?: 'success' | 'failed' | 'running' }> }) ?? {};
        const newMsgs = data.data ?? [];
        const hasMore = (response.data as { hasMore?: boolean })?.hasMore ?? false;
        const nextCursor = (response.data as { nextCursor?: string | null })?.nextCursor ?? null;
        set({
          messages: [...state.messages, ...newMsgs].slice(-500),
          hasMoreMessages: hasMore,
          nextCursor,
        });
      } finally {
        set({ isLoadingMore: false });
      }
    },

    trimOldMessages: (maxCount: number) => {
      set((state) => ({
        messages: state.messages.slice(-maxCount),
      }));
    },

    markAlertRead: async (alertId: string) => {
      try {
        await markAlertReadAPI(alertId);
        set((state) => ({
          unreadAlerts: Math.max(0, state.unreadAlerts - 1),
        }));
      } catch (err) {
        console.error('[ChatOps] Failed to mark alert read:', err);
      }
    },

    markAlertAcknowledged: async (alertId: string) => {
      try {
        await markAlertAckAPI(alertId);
        set((state) => ({
          unreadAlerts: Math.max(0, state.unreadAlerts - 1),
        }));
      } catch (err) {
        console.error('[ChatOps] Failed to acknowledge alert:', err);
      }
    },

    markAlertDismissed: async (alertId: string) => {
      try {
        await markAlertDismissedAPI(alertId);
        set((state) => ({
          unreadAlerts: Math.max(0, state.unreadAlerts - 1),
        }));
      } catch (err) {
        console.error('[ChatOps] Failed to dismiss alert:', err);
      }
    },

    setMemoryCheckEnabled: (enabled) => set({ memoryCheckEnabled: enabled }),
  }))
);

// 辅助: 从执行结果提取操作按钮
function extractActionsFromResult(result: any): ChatMessage['actions'] {
  if (!result) return undefined;
  if (result.actions) return result.actions;
  return [{ label: '查看详情', command: 'status', params: {} }];
}

// TE-9: 延迟初始化函数 (替代 IIFE)
let _initialized = false;
export async function initializeChatOpsStore(): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  try {
    const response = await getCommands();
    const commands = (response.data as CommandListResponse)?.data?.commands || [];
    if (Array.isArray(commands)) {
      commands.forEach((cmd: { name: string; schema?: Record<string, unknown> }) => {
        parser.registerSchema(cmd.name, cmd.schema || {});
      });
      useChatOpsStore.setState({ commands: commands as any });
    }
    useChatOpsStore.getState().fetchRecommendations();
  } catch (err) {
    console.warn('[ChatOps] Commands unavailable (check permission):', err);
    _initialized = false; // 失败时允许重试
  }
}
