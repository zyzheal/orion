/**
 * useAssistantState.ts - Assistant 状态 Hook
 * 抽取自 Assistant/index.tsx (P2-9 Phase 66)
 */
import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import {
  assistantAsk,
  assistantAction,
  listAssistantSessions,
  getAssistantSession,
  deleteAssistantSession,
  ingestSource,
  type AssistantSession,
} from '@/api/assistant';
import type { ChatItem, SourceSamples } from './types';
import { SOURCE_SAMPLES } from './constants';

export const useAssistantState = () => {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Session management
  const [sessions, setSessions] = useState<AssistantSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const loadSessions = useCallback(async () => {
    try {
      const res = await listAssistantSessions(20);
      setSessions(res.data || []);
    } catch {
      message.error('加载会话列表失败');
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const selectSession = useCallback(async (id: string) => {
    setCurrentSessionId(id);
    try {
      const res = await getAssistantSession(id);
      const session = res.data;
      const chatItems: ChatItem[] = (session.messages || []).map((m, idx) => ({
        id: idx,
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
      setMessages(chatItems);
    } catch {
      message.error('加载会话详情失败');
      setMessages([]);
    }
  }, []);

  const newSession = useCallback(() => {
    setCurrentSessionId(null);
    setMessages([]);
  }, []);

  const deleteSession = useCallback(
    async (id: string) => {
      try {
        await deleteAssistantSession(id);
        if (currentSessionId === id) {
          setCurrentSessionId(null);
          setMessages([]);
        }
        loadSessions();
        message.success('会话已删除');
      } catch (e: unknown) {
        message.error((e as Error)?.message || '删除失败');
      }
    },
    [currentSessionId, loadSessions],
  );

  // Action execution
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<
    import('@/api/assistant').AssistantActionResult | null
  >(null);
  const [actionPrompt, setActionPrompt] = useState('');
  const [actionTitle, setActionTitle] = useState('');

  const handleAction = useCallback(
    async (kind: 'trigger_pipeline' | 'suggest_command' | 'generate_flow') => {
      const prompt = actionPrompt.trim();
      if (!prompt) {
        message.warning('请输入操作描述');
        return;
      }
      setActionLoading(true);
      setActionResult(null);
      try {
        const res = await assistantAction({
          prompt,
          kind,
          title: actionTitle.trim() || undefined,
        });
        setActionResult(res.data);
        if (res.data.status === 'executed') {
          message.success(res.data.summary || '操作执行成功');
        } else {
          message.info(res.data.summary || '操作已处理');
        }
      } catch (e: unknown) {
        message.error((e as Error)?.message || '操作执行失败');
      } finally {
        setActionLoading(false);
      }
    },
    [actionPrompt, actionTitle],
  );

  // Chat
  const ask = useCallback(
    async (q?: string) => {
      const query = (q ?? question).trim();
      if (!query || loading) return;

      const userMsg: ChatItem = { id: Date.now(), role: 'user', content: query };
      setMessages((prev) => [...prev, userMsg]);
      setQuestion('');
      setLoading(true);

      try {
        const res = await assistantAsk({ question: query, session_id: currentSessionId ?? '' });
        const data = res.data;
        if (data.session_id && !currentSessionId) {
          setCurrentSessionId(data.session_id);
          loadSessions();
        }
        const assistantMsg: ChatItem = {
          id: Date.now() + 1,
          role: 'assistant',
          content: data.answer,
          response: data,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        message.error('助手暂时无法回答，请稍后重试');
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, role: 'assistant', content: '抱歉，出错了，请稍后再试。' },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [question, loading, currentSessionId, loadSessions],
  );

  const clearChat = useCallback(() => setMessages([]), []);

  // Data source ingestion
  const [importSource, setImportSource] = useState<SourceSamples>(SOURCE_SAMPLES[0]);
  const [ingesting, setIngesting] = useState(false);

  const handleIngest = useCallback(async () => {
    setIngesting(true);
    try {
      const res = await ingestSource({
        source: importSource.source,
        items: importSource.items,
      });
      message.success(
        `已将 ${res.data.indexed} 条${importSource.label}记录导入知识库（${res.data.space_id}）`,
      );
    } catch {
      message.error('导入失败，请确认知识库 ingest 服务可用');
    } finally {
      setIngesting(false);
    }
  }, [importSource]);

  return {
    question, setQuestion,
    messages, setMessages,
    loading,
    sessions, currentSessionId, setCurrentSessionId,
    sidebarOpen, setSidebarOpen,
    actionLoading, actionResult, actionPrompt, setActionPrompt,
    actionTitle, setActionTitle,
    importSource, setImportSource, ingesting,
    loadSessions, selectSession, newSession, deleteSession,
    ask, clearChat, handleAction, handleIngest,
  };
};
