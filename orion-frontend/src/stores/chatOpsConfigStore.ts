/**
 * ChatOps 配置 Store
 * 支持自定义启动时展示的问答卡片和底部命令配置
 * 数据持久化到后端 API（fallback 到 localStorage 缓存）
 */
import { create } from 'zustand';
import {
  getQuestionConfigs,
  updateQuestionConfigs,
  getCommandConfigs,
  updateCommandConfigs,
} from '../api/chatops';

export interface ChatOpsQuestionConfig {
  key: string;
  icon: string; // Ant Design icon name, e.g., 'RocketOutlined'
  title: string;
  desc: string;
  question: string;
  enabled: boolean;
}

export interface ChatOpsCommandConfig {
  key: string;
  label: string;
  command: string;
  enabled: boolean;
}

export interface ConfigListResponse {
  data?: {
    data?: ChatOpsQuestionConfig[] | ChatOpsCommandConfig[];
  };
}

interface ChatOpsConfigState {
  questions: ChatOpsQuestionConfig[];
  commands: ChatOpsCommandConfig[];
  isLoading: boolean;
  loadConfig: () => Promise<void>;
  saveConfig: () => Promise<void>;
  updateQuestion: (key: string, updates: Partial<ChatOpsQuestionConfig>) => void;
  addQuestion: (question: ChatOpsQuestionConfig) => void;
  removeQuestion: (key: string) => void;
  updateCommand: (key: string, updates: Partial<ChatOpsCommandConfig>) => void;
  addCommand: (command: ChatOpsCommandConfig) => void;
  removeCommand: (key: string) => void;
  resetToDefault: () => void;
}

// 默认问答卡片配置
const defaultQuestions: ChatOpsQuestionConfig[] = [
  { key: 'pipeline', icon: 'RocketOutlined', title: '部署流水线', desc: '查看当前流水线状态', question: '查看最近 5 条流水线执行状态', enabled: true },
  { key: 'troubleshoot', icon: 'BugOutlined', title: '故障排查', desc: '分析最近的告警', question: '分析最近 3 条告警信息', enabled: true },
  { key: 'efficiency', icon: 'BarChartOutlined', title: '效能分析', desc: '查看团队效能数据', question: '本周团队效能如何？', enabled: true },
  { key: 'env-status', icon: 'CloudServerOutlined', title: '环境状态', desc: '检查服务健康度', question: '检查各环境服务健康状态', enabled: true },
  { key: 'security', icon: 'SecurityScanOutlined', title: '安全检查', desc: '扫描安全风险', question: '当前系统有哪些安全风险？', enabled: true },
  { key: 'config-query', icon: 'SettingOutlined', title: '配置查询', desc: '查看系统配置', question: '查看当前系统配置', enabled: true },
];

// 默认底部命令配置
const defaultCommands: ChatOpsCommandConfig[] = [
  { key: 'deploy', label: '部署', command: '/deploy app=xxx env=production', enabled: true },
  { key: 'rollback', label: '回滚', command: '/rollback app=xxx env=production', enabled: true },
  { key: 'restart', label: '重启', command: '/restart app=xxx env=staging', enabled: true },
  { key: 'status', label: '状态', command: '/status app=xxx', enabled: true },
  { key: 'logs', label: '日志', command: '/logs app=xxx env=production', enabled: true },
  { key: 'pipeline-run', label: '触发流水线', command: '/pipeline run name=xxx', enabled: true },
];

const STORAGE_KEY = 'orion_chatops_config';

/** 从 localStorage 读取缓存 */
function loadFromCache(): { questions: ChatOpsQuestionConfig[]; commands: ChatOpsCommandConfig[] } | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/** 写入 localStorage 缓存 */
function saveToCache(questions: ChatOpsQuestionConfig[], commands: ChatOpsCommandConfig[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ questions, commands }));
  } catch {
    // Ignore storage errors
  }
}

/** 合并问答默认值与远程数据 */
function mergeQuestions(
  remote: any[] | null,
  defaults: ChatOpsQuestionConfig[]
): ChatOpsQuestionConfig[] {
  if (!remote || remote.length === 0) return [...defaults];
  const merged = defaults.map((defQ) => {
    const remoteQ = remote.find((q: any) => q.key === defQ.key);
    return remoteQ ? { ...defQ, ...remoteQ } : defQ;
  });
  for (const r of remote) {
    if (!merged.find((q) => q.key === r.key) && r.key) {
      merged.push(r as ChatOpsQuestionConfig);
    }
  }
  return merged;
}

/** 合并命令默认值与远程数据 */
function mergeCommands(
  remote: any[] | null,
  defaults: ChatOpsCommandConfig[]
): ChatOpsCommandConfig[] {
  if (!remote || remote.length === 0) return [...defaults];
  const merged = defaults.map((defC) => {
    const remoteC = remote.find((c: any) => c.key === defC.key);
    return remoteC ? { ...defC, ...remoteC } : defC;
  });
  for (const r of remote) {
    if (!merged.find((c) => c.key === r.key) && r.key) {
      merged.push(r as ChatOpsCommandConfig);
    }
  }
  return merged;
}

export const useChatOpsConfigStore = create<ChatOpsConfigState>((set, get) => ({
  questions: [...defaultQuestions],
  commands: [...defaultCommands],
  isLoading: false,

  loadConfig: async () => {
    set({ isLoading: true });
    try {
      // 优先从 API 拉取
      const [qRes, cRes] = await Promise.allSettled([
        getQuestionConfigs(),
        getCommandConfigs(),
      ]);

      const remoteQuestions = qRes.status === 'fulfilled' && qRes.value?.data
        ? (qRes.value.data as ChatOpsQuestionConfig[])
        : null;
      const remoteCommands = cRes.status === 'fulfilled' && cRes.value?.data
        ? (cRes.value.data as ChatOpsCommandConfig[])
        : null;

      if (remoteQuestions !== null || remoteCommands !== null) {
        // API 成功，使用远程数据合并
        const merged = {
          questions: mergeQuestions(remoteQuestions, defaultQuestions),
          commands: mergeCommands(remoteCommands, defaultCommands),
        };
        // 同时写入缓存
        saveToCache(merged.questions, merged.commands);
        set({ questions: merged.questions, commands: merged.commands, isLoading: false });
      } else {
        // API 全部失败，回退到 localStorage
        const cached = loadFromCache();
        if (cached) {
          const merged = {
            questions: mergeQuestions(cached.questions, defaultQuestions),
            commands: mergeCommands(cached.commands, defaultCommands),
          };
          set({ questions: merged.questions, commands: merged.commands, isLoading: false });
        } else {
          // 无缓存，使用默认值
          set({ isLoading: false });
        }
      }
    } catch {
      // API 异常，回退到 localStorage
      const cached = loadFromCache();
      if (cached) {
        set({ questions: cached.questions, commands: cached.commands, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    }
  },

  saveConfig: async () => {
    const { questions, commands } = get();
    // 先写入缓存
    saveToCache(questions, commands);
    // 异步调用 API 保存
    try {
      await Promise.all([
        updateQuestionConfigs({ configs: questions }),
        updateCommandConfigs({ configs: commands }),
      ]);
    } catch {
      // API 失败时数据已缓存，不影响体验
      console.warn('[ChatOpsConfigStore] API save failed, data cached locally');
    }
  },

  updateQuestion: (key, updates) => {
    set((state) => ({
      questions: state.questions.map((q) => (q.key === key ? { ...q, ...updates } : q)),
    }));
  },

  addQuestion: (question) => {
    set((state) => ({
      questions: [...state.questions, question],
    }));
  },

  removeQuestion: (key) => {
    set((state) => ({
      questions: state.questions.filter((q) => q.key !== key),
    }));
  },

  updateCommand: (key, updates) => {
    set((state) => ({
      commands: state.commands.map((c) => (c.key === key ? { ...c, ...updates } : c)),
    }));
  },

  addCommand: (command) => {
    set((state) => ({
      commands: [...state.commands, command],
    }));
  },

  removeCommand: (key) => {
    set((state) => ({
      commands: state.commands.filter((c) => c.key !== key),
    }));
  },

  resetToDefault: () => {
    saveToCache([...defaultQuestions], [...defaultCommands]);
    set({ questions: [...defaultQuestions], commands: [...defaultCommands] });
    // 异步调用 API 重置
    Promise.all([
      updateQuestionConfigs({ configs: [...defaultQuestions] }).catch((err: unknown) => console.error('Failed to reset questions:', err)),
      updateCommandConfigs({ configs: [...defaultCommands] }).catch((err: unknown) => console.error('Failed to reset commands:', err)),
    ]);
  },
}));
