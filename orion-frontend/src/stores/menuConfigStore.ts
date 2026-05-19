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
  addChild: (moduleKey: string, child: Omit<MenuChildConfig, 'key'>) => void;
  deleteChild: (moduleKey: string, childKey: string) => void;
  moveChild: (fromModuleKey: string, toModuleKey: string, childKey: string, index?: number) => void;
  resetToDefault: () => void;
}

const defaultModules: Record<string, MenuModuleConfig> = {
  '/workbench': {
    key: '/workbench',
    label: '工作台',
    description: '个人工作与效能度量',
    systemTitle: '工作台',
    systemDescription: '统一工作入口，涵盖工单管理、效能度量与项目概览',
    enabled: true,
    children: [
      // 个人视角
      { key: '/dashboard', label: '总览看板', description: '个人工作台', category: '个人视角', enabled: true },
      { key: '/workbench', label: '个人工作台', description: '个人工作概览', category: '个人视角', enabled: true },
      { key: '/dashboard/engineer', label: '个人看板', description: '个人效能分析', category: '个人视角', enabled: true },
      // 管理视角
      { key: '/dashboard/executive', label: '总览看板', description: '全局效能视图', category: '管理视角', enabled: true },
      { key: '/dashboard/manager', label: '经理看板', description: '团队效能分析', category: '管理视角', enabled: true },
      // 业务管理
      { key: '/tickets', label: '工单', description: '工单管理', category: '业务管理', enabled: true },
      { key: '/product-lines', label: '产品线', description: '产品线管理', category: '业务管理', enabled: true },
      { key: '/projects', label: '项目', description: '项目管理', category: '业务管理', enabled: true },
      // 分析视角
      { key: '/efficiency-dashboard', label: '效能分析', description: '深度效能洞察', category: '分析视角', enabled: true },
      { key: '/risk-dashboard', label: '风险看板', description: '风险识别预警', category: '分析视角', enabled: true },
    ],
  },
  '/console': {
    key: '/console',
    label: '控制台',
    description: '系统管理与配置',
    systemTitle: '系统控制台',
    systemDescription: '管理系统插件、配置、用户与功能开关',
    enabled: true,
    children: [
      { key: '/console', label: '控制台首页', description: '系统概览与快速操作', category: '概览', enabled: true },
      { key: '/console/plugins', label: '插件管理', description: '插件安装、配置与生命周期管理', category: '扩展管理', enabled: true },
      { key: '/console/settings', label: '系统配置', description: '功能开关与特性管理', category: '配置', enabled: true },
      { key: '/console/users', label: '用户管理', description: '用户、角色与权限管理', category: '权限', enabled: true },
    ],
  },
  '/delivery': {
    key: '/delivery',
    label: '交付',
    description: 'CI/CD 与制品管理',
    systemTitle: '交付中心',
    systemDescription: '从代码到制品的全链路交付，包含流水线、部署、灰度、测试等核心能力',
    enabled: true,
    children: [
      // 持续交付
      { key: '/pipelines', label: '流水线', description: 'CI/CD 流水线管理', category: '持续交付', enabled: true },
      { key: '/deployments', label: '部署', description: '应用部署管理', category: '持续交付', enabled: true },
      { key: '/canary-analysis', label: '灰度分析', description: '发布质量分析', category: '持续交付', enabled: true },
      { key: '/change-intelligence', label: '变更智能', description: '变更影响分析', category: '持续交付', enabled: true },
      // 代码与制品
      { key: '/console/code-mgmt', label: '代码管理', description: '代码仓库管理', category: '代码与制品', enabled: true },
      { key: '/artifacts', label: '制品管理', description: '构建产物管理', category: '代码与制品', enabled: true },
      { key: '/internal-libraries', label: '二方库', description: '内部依赖管理', category: '代码与制品', enabled: true },
      // 质量保障
      { key: '/test-selector', label: '测试管理', description: '测试用例与执行', category: '质量保障', enabled: true },
    ],
  },
  '/observability': {
    key: '/observability',
    label: '可观测性',
    description: '监控、告警与诊断',
    systemTitle: '可观测性中心',
    systemDescription: '全面可观测性覆盖，从监控告警到根因分析再到自动化修复',
    enabled: true,
    children: [
      // 监控告警
      { key: '/observability/monitoring', label: '监控中心', description: '全栈监控', category: '监控告警', enabled: true },
      { key: '/alerts', label: '告警', description: '智能告警管理', category: '监控告警', enabled: true },
      { key: '/metrics-dashboard', label: '指标看板', description: '自定义指标体系', category: '监控告警', enabled: true },
      // 智能诊断
      { key: '/observability/diagnostic', label: '诊断中心', description: '根因分析诊断', category: '智能诊断', enabled: true },
      { key: '/observability/self-healing', label: '自愈系统', description: '自动化故障恢复', category: '智能诊断', enabled: true },
    ],
  },
  '/ai': {
    key: '/ai',
    label: 'AI 平台',
    description: '智能化能力中心',
    systemTitle: 'AI 平台',
    systemDescription: 'AI 驱动的研发效能提升，包含智能助手、代码评审、知识管理、AI 网关等核心能力',
    enabled: true,
    children: [
      // 智能助手
      { key: '/ai/chatops', label: '智能助手', description: '对话式运维', category: '智能助手', enabled: true },
      // 代码智能
      { key: '/ai/review', label: 'AI Review', description: '智能代码评审', category: '代码智能', enabled: true },
      { key: '/ai/docs', label: 'AI 文档', description: '智能文档生成', category: '代码智能', enabled: true },
      // 平台配置
      { key: '/ai/gateway', label: 'AI 网关', description: '统一 AI 服务入口', category: '平台配置', enabled: true },
      { key: '/ai/agents', label: 'Agent 调度', description: '智能体编排', category: '平台配置', enabled: true },
      // 可观测性
      { key: '/ai/trace', label: 'LLM Trace', description: '模型调用追踪', category: '可观测性', enabled: true },
      { key: '/ai/cost', label: 'AI 成本', description: 'AI 成本分析', category: '可观测性', enabled: true },
      // 知识管理
      { key: '/ai/knowledge', label: 'AI 知识库', description: '智能知识管理', category: '知识管理', enabled: true },
      // 安全合规
      { key: '/ai/security', label: 'AI 安全', description: 'AI 安全治理', category: '安全合规', enabled: true },
    ],
  },
  '/infra': {
    key: '/infra',
    label: '基础设施',
    description: '环境与基础设施管理',
    systemTitle: '基础设施',
    systemDescription: '全生命周期基础设施管理，涵盖环境、中间件、CMDB、运维流程等核心能力',
    enabled: true,
    children: [
      // 环境管理
      { key: '/environments', label: '环境管理', description: '环境生命周期管理', category: '环境管理', enabled: true },
      { key: '/ephemeral-envs', label: '临时环境', description: '按需环境创建', category: '环境管理', enabled: true },
      { key: '/console/build-env', label: '构建环境', description: '构建运行时管理', category: '环境管理', enabled: true },
      { key: '/console/iac', label: 'IaC 管理', description: '基础设施即代码', category: '环境管理', enabled: true },
      // 中间件
      { key: '/queue', label: '队列管理', description: '消息队列管理', category: '中间件', enabled: true },
      { key: '/vector-store', label: '向量存储', description: 'AI 向量数据库', category: '中间件', enabled: true },
      { key: '/eventbus', label: '事件总线', description: '事件驱动架构', category: '中间件', enabled: true },
      // CMDB
      { key: '/cmdb', label: 'CMDB', description: '配置管理与运维终端', category: 'CMDB', enabled: true },
      { key: '/cmdb/topology', label: '拓扑图', description: 'CI 关系可视化', category: 'CMDB', enabled: true },
      { key: '/cmdb/integration', label: '集成资源', description: '主机 + K8s 资源', category: 'CMDB', enabled: true },
      { key: '/cmdb/terminal', label: 'Web 终端', description: 'SSH 远程终端', category: 'CMDB', enabled: true },
      { key: '/cmdb/batch-exec', label: '批量执行', description: '命令执行与脚本模板', category: 'CMDB', enabled: true },
      { key: '/cmdb/audit', label: '审计日志', description: '终端操作审计', category: 'CMDB', enabled: true },
      // 运维流程
      { key: '/sessions', label: '会话管理', description: '终端会话管理', category: '运维流程', enabled: true },
      { key: '/backup', label: '备份恢复', description: '数据备份策略管理', category: '运维流程', enabled: true },
      { key: '/oncall', label: '值班管理', description: '排班与告警响应', category: '运维流程', enabled: true },
    ],
  },
  '/governance': {
    key: '/governance',
    label: '治理',
    description: '安全合规与配置治理',
    systemTitle: '治理中心',
    systemDescription: '统一的平台治理，确保安全、合规、可控与成本优化',
    enabled: true,
    children: [
      // 安全合规
      { key: '/policies', label: '策略管理', description: '策略定义与执行', category: '安全合规', enabled: true },
      { key: '/audit-log', label: '审计日志', description: '操作审计追踪', category: '安全合规', enabled: true },
      { key: '/sbom', label: 'SBOM', description: '软件物料清单', category: '安全合规', enabled: true },
      // 组织管理
      { key: '/tenant-management', label: '租户管理', description: '多租户隔离管理', category: '组织管理', enabled: true },
      { key: '/roles', label: '角色管理', description: '权限角色定义', category: '组织管理', enabled: true },
      // 配置与审批
      { key: '/config-management', label: '配置管理', description: '平台配置中心', category: '配置管理', enabled: true },
      { key: '/approvals', label: '审批流', description: '审批流程管理', category: '流程管理', enabled: true },
      { key: '/console/approvals', label: '审批管理', description: '审批流程配置与记录', category: '流程管理', enabled: true },
      { key: '/workflows', label: '工作流设计器', description: '低代码流程编排', category: '流程管理', enabled: true },
      // 成本治理
      { key: '/finops', label: '成本分析', description: '云成本优化与治理', category: '成本治理', enabled: true },
    ],
  },
  '/ecosystem': {
    key: '/ecosystem',
    label: '生态',
    description: '扩展能力与子系统',
    systemTitle: '生态中心',
    systemDescription: '垂直领域专业工具与扩展能力市场',
    enabled: true,
    children: [
      // 子系统
      { key: '/dba', label: '数据库管理', description: 'DBA 运维平台', category: '子系统', enabled: true },
      { key: '/knowledge', label: '知识库', description: '企业知识沉淀平台', category: '子系统', enabled: true },
      { key: '/visor', label: '运维监控', description: '基础设施可视化监控', category: '子系统', enabled: true },
      // 文档与知识
      { key: '/documents', label: '文档中心', description: '项目设计文档与运维手册', category: '文档与知识', enabled: true },
      // 扩展能力
      { key: '/skills', label: 'Skill 市场', description: '能力插件市场', category: '扩展能力', enabled: true },
      { key: '/plugin-spi', label: 'SPI 扩展点', description: '插件扩展规范框架', category: '扩展能力', enabled: true },
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
        const merged: Record<string, MenuModuleConfig> = { ...defaultModules };
        for (const [key, storedModule] of Object.entries(parsed)) {
          const defModule = merged[key];
          if (defModule && storedModule) {
            // Merge children: defaults + user-added items not in defaults
            const defaultKeys = new Set(defModule.children.map(c => c.key));
            const mergedChildren = defModule.children.map(defChild => {
              const storedChild = (storedModule.children as MenuChildConfig[] || []).find(c => c.key === defChild.key);
              return storedChild ? { ...defChild, ...storedChild } : defChild;
            });
            // Append user-added children that aren't in defaults
            const userAddedChildren = (storedModule.children as MenuChildConfig[] || []).filter(
              c => !defaultKeys.has(c.key)
            );
            mergedChildren.push(...userAddedChildren);

            merged[key] = {
              ...defModule,
              ...storedModule,
              children: mergedChildren,
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

  addChild: (moduleKey, child) => {
    set((state) => {
      const module = state.modules[moduleKey];
      if (!module) return state;
      const key = child.label.toLowerCase().replace(/\s+/g, '-');
      const newChild: MenuChildConfig = {
        key: `/${key}`,
        label: child.label,
        description: child.description,
        category: child.category,
        enabled: child.enabled ?? true,
      };
      return {
        modules: {
          ...state.modules,
          [moduleKey]: {
            ...module,
            children: [...module.children, newChild],
          },
        },
      };
    });
  },

  deleteChild: (moduleKey, childKey) => {
    set((state) => {
      const module = state.modules[moduleKey];
      if (!module) return state;
      return {
        modules: {
          ...state.modules,
          [moduleKey]: {
            ...module,
            children: module.children.filter((c) => c.key !== childKey),
          },
        },
      };
    });
  },

  moveChild: (fromModuleKey, toModuleKey, childKey, index) => {
    set((state) => {
      const fromModule = state.modules[fromModuleKey];
      const toModule = state.modules[toModuleKey];
      if (!fromModule || !toModule || fromModuleKey === toModuleKey) return state;
      const child = fromModule.children.find((c) => c.key === childKey);
      if (!child) return state;
      const newFromChildren = fromModule.children.filter((c) => c.key !== childKey);
      const newToChildren = [...toModule.children];
      const insertIndex = index !== undefined ? Math.min(index, newToChildren.length) : newToChildren.length;
      newToChildren.splice(insertIndex, 0, child);
      return {
        modules: {
          ...state.modules,
          [fromModuleKey]: { ...fromModule, children: newFromChildren },
          [toModuleKey]: { ...toModule, children: newToChildren },
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
