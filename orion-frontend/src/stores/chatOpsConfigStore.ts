/**
 * ChatOps 配置 Store
 * 支持自定义启动时展示的问答卡片和底部命令配置
 * 数据持久化到 localStorage
 */
import { create } from 'zustand';

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

interface ChatOpsConfigState {
  questions: ChatOpsQuestionConfig[];
  commands: ChatOpsCommandConfig[];
  loadConfig: () => void;
  saveConfig: () => void;
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

export const useChatOpsConfigStore = create<ChatOpsConfigState>((set, get) => ({
  questions: [...defaultQuestions],
  commands: [...defaultCommands],

  loadConfig: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { questions?: Partial<ChatOpsQuestionConfig>[]; commands?: Partial<ChatOpsCommandConfig>[] };
        const merged = {
          questions: defaultQuestions.map((defQ) => {
            const storedQ = parsed.questions?.find((q) => q.key === defQ.key);
            return storedQ ? { ...defQ, ...storedQ } : defQ;
          }),
          commands: defaultCommands.map((defC) => {
            const storedC = parsed.commands?.find((c) => c.key === defC.key);
            return storedC ? { ...defC, ...storedC } : defC;
          }),
        };
        // 追加新增的项（不在默认列表中的）
        if (parsed.questions) {
          for (const storedQ of parsed.questions) {
            if (!merged.questions.find((q) => q.key === storedQ.key) && storedQ.key) {
              merged.questions.push(storedQ as ChatOpsQuestionConfig);
            }
          }
        }
        if (parsed.commands) {
          for (const storedC of parsed.commands) {
            if (!merged.commands.find((c) => c.key === storedC.key) && storedC.key) {
              merged.commands.push(storedC as ChatOpsCommandConfig);
            }
          }
        }
        set({ questions: merged.questions, commands: merged.commands });
      }
    } catch {
      // Ignore parse errors, use defaults
    }
  },

  saveConfig: () => {
    const { questions, commands } = get();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ questions, commands }));
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
    localStorage.removeItem(STORAGE_KEY);
    set({ questions: [...defaultQuestions], commands: [...defaultCommands] });
  },
}));
