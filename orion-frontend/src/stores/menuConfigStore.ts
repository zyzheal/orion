/**
 * 菜单配置 Store
 * 支持管理员自定义导航菜单模块名称、描述、子菜单项
 * 数据持久化到 localStorage
 */
import { create } from 'zustand';

export interface MenuChildConfig {
  key: string;
  label: string;
  description?: string;
  category?: string;
  enabled: boolean;
}

export interface MenuModuleConfig {
  key: string;
  label: string;
  description?: string;
  systemTitle?: string;
  systemDescription?: string;
  enabled: boolean;
  children: MenuChildConfig[];
}

interface MenuConfigState {
  modules: Record<string, MenuModuleConfig>;
  loadConfig: () => void;
  saveConfig: () => void;
  updateModule: (key: string, updates: Partial<MenuModuleConfig>) => void;
  updateChild: (moduleKey: string, childKey: string, updates: Partial<MenuChildConfig>) => void;
  resetToDefault: () => void;
}

const defaultModules: Record<string, MenuModuleConfig> = {
  '/dashboard': { key: '/dashboard', label: '工作台', description: '', enabled: true, children: [] },
  '/ops': {
    key: '/ops',
    label: '运维中心',
    description: '全链路运维管理',
    systemTitle: '运维中心',
    systemDescription: '从代码到生产的全链路运维管理，包含流水线、部署、监控、告警等核心能力',
    enabled: true,
    children: [
      { key: '/pipelines', label: '流水线', description: 'CI/CD 流水线管理', category: '持续交付', enabled: true },
      { key: '/deployments', label: '部署', description: '应用部署管理', category: '持续交付', enabled: true },
      { key: '/console/monitoring', label: '监控中心', description: '全栈监控', category: '可观测性', enabled: true },
      { key: '/alerts', label: '告警', description: '智能告警管理', category: '可观测性', enabled: true },
      { key: '/console/diagnostic', label: '诊断中心', description: '根因分析诊断', category: '可观测性', enabled: true },
      { key: '/finops', label: '成本分析', description: '云成本优化', category: '成本治理', enabled: true },
      { key: '/console/self-healing', label: '自愈系统', description: '自动化故障恢复', category: '智能运维', enabled: true },
      { key: '/canary-analysis', label: '灰度分析', description: '发布质量分析', category: '智能运维', enabled: true },
      { key: '/change-intelligence', label: '变更智能', description: '变更影响分析', category: '智能运维', enabled: true },
      { key: '/eventbus', label: '事件总线', description: '事件驱动架构', category: '基础能力', enabled: true },
      { key: '/metrics-dashboard', label: '指标看板', description: '自定义指标', category: '可观测性', enabled: true },
      { key: '/test-selector', label: '测试管理', description: '测试用例管理', category: '质量保障', enabled: true },
    ],
  },
  '/tickets': { key: '/tickets', label: '工单', description: '', enabled: true, children: [] },
  '/bi': {
    key: '/bi',
    label: '效能看板',
    description: '研发效能度量',
    systemTitle: '效能看板',
    systemDescription: '多维度研发效能度量与分析，驱动持续改进',
    enabled: true,
    children: [
      { key: '/workbench', label: '个人工作台', description: '个人工作概览', category: '个人视角', enabled: true },
      { key: '/dashboard/executive', label: '总览看板', description: '全局效能视图', category: '管理视角', enabled: true },
      { key: '/dashboard/manager', label: '经理看板', description: '团队效能分析', category: '管理视角', enabled: true },
      { key: '/dashboard/engineer', label: '个人看板', description: '个人效能分析', category: '个人视角', enabled: true },
      { key: '/efficiency-dashboard', label: '效能分析', description: '深度效能洞察', category: '分析视角', enabled: true },
      { key: '/risk-dashboard', label: '风险看板', description: '风险识别预警', category: '分析视角', enabled: true },
    ],
  },
  '/subapps': {
    key: '/subapps',
    label: '子系统',
    description: '扩展能力平台',
    systemTitle: '子系统',
    systemDescription: '垂直领域专业工具，深度集成核心平台能力',
    enabled: true,
    children: [
      { key: '/dba', label: '数据库管理', description: 'DBA 运维平台', enabled: true },
      { key: '/knowledge', label: '知识库', description: '企业知识沉淀', enabled: true },
      { key: '/visor', label: '运维监控', description: '基础设施监控', enabled: true },
    ],
  },
  '/product-lines': { key: '/product-lines', label: '产品线', description: '', enabled: true, children: [] },
  '/artifacts': { key: '/artifacts', label: '制品管理', description: '', enabled: true, children: [] },
  '/internal-libraries': { key: '/internal-libraries', label: '二方库', description: '', enabled: true, children: [] },
  '/projects': { key: '/projects', label: '项目', description: '', enabled: true, children: [] },
  '/ai': {
    key: '/ai',
    label: 'AI 能力',
    description: '智能化平台',
    systemTitle: 'AI 能力',
    systemDescription: 'AI 驱动的研发效能提升，让工具链更智能',
    enabled: true,
    children: [
      // 智能助手
      { key: '/console/chatops', label: '智能助手', description: '对话式运维', category: '智能助手', enabled: true },
      // 代码智能
      { key: '/console/ai-review', label: 'AI Review', description: '智能代码评审', category: '代码智能', enabled: true },
      { key: '/console/ai-docs', label: 'AI 文档', description: '智能文档生成', category: '代码智能', enabled: true },
      // 平台配置
      { key: '/ai-gateway', label: 'AI 网关', description: '统一 AI 服务入口', category: '平台配置', enabled: true },
      { key: '/agents', label: 'Agent 调度', description: '智能体编排', category: '平台配置', enabled: true },
      // 可观测性
      { key: '/llm-trace', label: 'LLM Trace', description: '模型调用追踪', category: '可观测性', enabled: true },
      { key: '/ai-cost', label: '成本分析', description: 'AI 成本分析', category: '可观测性', enabled: true },
      // 知识管理
      { key: '/ai/knowledge', label: 'AI 知识库', description: '智能知识管理', category: '知识管理', enabled: true },
      // 安全合规
      { key: '/ai-security', label: 'AI 安全', description: 'AI 安全治理', category: '安全合规', enabled: true },
    ],
  },
  '/governance': {
    key: '/governance',
    label: '治理',
    description: '平台治理中心',
    systemTitle: '治理中心',
    systemDescription: '统一的平台治理，确保安全、合规与可控',
    enabled: true,
    children: [
      { key: '/policies', label: '策略管理', description: '策略定义与执行', category: '策略引擎', enabled: true },
      { key: '/audit-log', label: '审计日志', description: '操作审计追踪', category: '安全合规', enabled: true },
      { key: '/tenant-management', label: '租户管理', description: '多租户隔离', category: '组织管理', enabled: true },
      { key: '/roles', label: '角色管理', description: '权限角色定义', category: '组织管理', enabled: true },
      { key: '/config-management', label: '配置管理', description: '配置中心', category: '基础能力', enabled: true },
      { key: '/cmdb', label: 'CMDB', description: '配置管理数据库', category: '基础能力', enabled: true },
      { key: '/skills', label: 'Skill 市场', description: '能力插件市场', category: '扩展能力', enabled: true },
      { key: '/sbom', label: 'SBOM', description: '软件物料清单', category: '安全合规', enabled: true },
      { key: '/approvals', label: '审批流', description: '审批流程管理', category: '流程管理', enabled: true },
      { key: '/oncall', label: '值班管理', description: '排班与告警', category: '流程管理', enabled: true },
      { key: '/sessions', label: '会话管理', description: '终端会话管理', category: '基础能力', enabled: true },
      { key: '/backup', label: '备份恢复', description: '数据备份策略', category: '数据安全', enabled: true },
      { key: '/plugin-spi', label: '插件框架', description: '插件扩展规范', category: '扩展能力', enabled: true },
    ],
  },
  '/dev-env': {
    key: '/dev-env',
    label: '环境',
    description: '开发运行环境',
    systemTitle: '环境管理',
    systemDescription: '全生命周期环境管理，从构建到运行的基础设施',
    enabled: true,
    children: [
      { key: '/environments', label: '环境管理', description: '环境生命周期', category: '环境管理', enabled: true },
      { key: '/ephemeral-envs', label: '临时环境', description: '按需环境创建', category: '环境管理', enabled: true },
      { key: '/console/build-env', label: '构建环境', description: '构建运行时', category: '构建系统', enabled: true },
      { key: '/console/iac', label: 'IaC 管理', description: '基础设施即代码', category: '基础设施', enabled: true },
      { key: '/console/code-mgmt', label: '代码管理', description: '代码仓库管理', category: '源代码', enabled: true },
      { key: '/queue', label: '队列管理', description: '消息队列管理', category: '消息系统', enabled: true },
      { key: '/vector-store', label: '向量存储', description: 'AI 向量数据库', category: 'AI 基础设施', enabled: true },
    ],
  },
};

const STORAGE_KEY = 'orion_menu_config_v2';

export const useMenuConfigStore = create<MenuConfigState>((set, get) => ({
  modules: { ...defaultModules },

  loadConfig: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, Partial<MenuModuleConfig>>;
        // Merge with defaults to handle new items added in code
        const merged: Record<string, MenuModuleConfig> = { ...defaultModules };
        for (const [key, storedModule] of Object.entries(parsed)) {
          const defModule = merged[key];
          if (defModule && storedModule) {
            merged[key] = {
              ...defModule,
              ...storedModule,
              children: (defModule.children || []).map((defChild) => {
                const storedChild = (storedModule.children as MenuChildConfig[] || []).find((c) => c.key === defChild.key);
                return storedChild ? { ...defChild, ...storedChild } : defChild;
              }),
            };
          }
        }
        set({ modules: merged });
      }
    } catch {
      // Ignore parse errors, use defaults
    }
  },

  saveConfig: () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(get().modules));
  },

  updateModule: (key, updates) => {
    set((state) => ({
      modules: {
        ...state.modules,
        [key]: { ...state.modules[key], ...updates },
      },
    }));
  },

  updateChild: (moduleKey, childKey, updates) => {
    set((state) => {
      const module = state.modules[moduleKey];
      if (!module) return state;
      return {
        modules: {
          ...state.modules,
          [moduleKey]: {
            ...module,
            children: module.children.map((child) =>
              child.key === childKey ? { ...child, ...updates } : child
            ),
          },
        },
      };
    });
  },

  resetToDefault: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ modules: { ...defaultModules } });
  },
}));

// AI 模块权限映射 — 每个菜单项需要的权限点
export const AI_MODULE_PERMISSIONS: Record<string, { resource: string; action: string }> = {
  '/ai/dashboard': { resource: 'ai-gateway', action: 'read' },
  '/ai/chatops': { resource: 'chatops', action: 'use' },
  '/ai/docs': { resource: 'ai-doc', action: 'read' },
  '/ai/knowledge': { resource: 'knowledge', action: 'read' },
  '/ai/review': { resource: 'ai-review', action: 'read' },
  '/ai/gateway': { resource: 'ai-gateway', action: 'read' },
  '/ai/security': { resource: 'ai-security', action: 'read' },
  '/ai/provider': { resource: 'ai-provider', action: 'read' },
  '/ai/agents': { resource: 'ai-agent', action: 'read' },
  '/ai/orchestration': { resource: 'ai-orchestration', action: 'read' },
  '/ai/tools': { resource: 'ai-tool', action: 'read' },
  '/ai/trace': { resource: 'ai-trace', action: 'read' },
  '/ai/cost': { resource: 'ai-cost', action: 'read' },
};

/**
 * 根据用户权限过滤菜单子项
 * @param moduleKey - 模块 key，如 '/ai'
 * @returns 可见的子菜单项
 */
export const getVisibleChildren = (moduleKey: string): MenuChildConfig[] => {
  const state = useMenuConfigStore.getState();
  const module = state.modules[moduleKey];
  if (!module || !module.enabled) return [];

  const { modules } = state;
  const aiModule = modules['/ai'];
  if (!aiModule) return module.children.filter(c => c.enabled);

  return module.children.filter(child => {
    if (!child.enabled) return false;
    const required = AI_MODULE_PERMISSIONS[child.key];
    if (!required) return true;
    // 简单权限检查：检查用户角色是否有该权限
    // 实际使用时由 usePermission hook 提供
    return true; // TODO: 后续接入 usePermission
  });
};
