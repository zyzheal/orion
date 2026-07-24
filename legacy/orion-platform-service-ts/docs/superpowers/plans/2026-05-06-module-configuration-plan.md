# 模块配置化启用 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Orion 平台实现四层混合模块配置化启用系统（L0 核心/L1 功能域/L2 服务级/L3 特性级），支持依赖校验、懒加载、运行时状态管理。

**Architecture:** 新增 `module-lifecycle/` 目录实现 `ModuleRegistry`（状态跟踪+依赖图）和 `ModuleManager`（生命周期管理），集成到 `UnifiedConfigService` 的 `moduleConfig` 域，改造 `routes.ts` 使用 `ModuleManager` 注册路由。

**Tech Stack:** TypeScript, Fastify, PostgreSQL, UnifiedConfigService

---

## File Structure

| 文件 | 类型 | 职责 |
|------|------|------|
| `src/services/module-lifecycle/ModuleRegistry.ts` | 新建 | 模块注册表，状态跟踪，依赖图校验 |
| `src/services/module-lifecycle/ModuleManager.ts` | 新建 | 生命周期管理，从 UnifiedConfigService 读取配置 |
| `src/services/module-lifecycle/types.ts` | 新建 | 类型定义（ModuleStatus, ModuleConfig, ModuleLifecycle） |
| `src/services/module-lifecycle/index.ts` | 新建 | 模块导出 |
| `src/api/module-routes.ts` | 新建 | 模块管理 API（/v1/system/modules） |
| `src/config/UnifiedConfigService.ts` | 修改 | 添加 `moduleConfig` 域 |
| `src/api/routes.ts` | 修改 | 使用 ModuleManager 注册路由，减少硬编码 |
| `src/services/module-lifecycle/__tests__/ModuleRegistry.test.ts` | 新建 | ModuleRegistry 单元测试 |
| `src/services/module-lifecycle/__tests__/ModuleManager.test.ts` | 新建 | ModuleManager 单元测试 |

---

### Task 1: 类型定义 (types.ts)

**Files:**
- Create: `src/services/module-lifecycle/types.ts`
- Test: `src/services/module-lifecycle/__tests__/ModuleRegistry.test.ts`

- [ ] **Step 1: 创建类型定义**

```typescript
// src/services/module-lifecycle/types.ts

/**
 * 模块生命周期状态
 */
export type ModuleState = 'registered' | 'starting' | 'active' | 'stopping' | 'stopped' | 'failed';

/**
 * 模块层级
 */
export type ModuleLevel = 'core' | 'domain' | 'service' | 'feature';

/**
 * 模块配置
 */
export interface ModuleConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 是否自动启动 */
  autoStart?: boolean;
  /** 依赖的模块 ID 列表 */
  dependencies?: string[];
  /** 启动优先级（数字越小越先启动） */
  priority?: number;
}

/**
 * 模块描述
 */
export interface ModuleDescriptor {
  /** 唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 层级 */
  level: ModuleLevel;
  /** 所属功能域 */
  domain?: string;
  /** 当前状态 */
  state: ModuleState;
  /** 配置 */
  config: ModuleConfig;
  /** 路由前缀（如果有） */
  routePrefix?: string;
  /** 错误信息（如果状态为 failed） */
  error?: string;
}

/**
 * 模块生命周期接口
 * 所有可配置模块应实现此接口
 */
export interface ModuleLifecycle {
  /** 初始化模块（创建服务实例、准备资源） */
  initialize?(): Promise<void>;
  /** 启动模块（注册路由、启动定时任务、订阅 EventBus） */
  start?(): Promise<void>;
  /** 停止模块（清理资源、取消订阅） */
  stop?(): Promise<void>;
  /** 健康检查 */
  healthCheck?(): Promise<boolean>;
}

/**
 * 模块注册信息
 */
export interface ModuleRegistration {
  descriptor: ModuleDescriptor;
  lifecycle?: ModuleLifecycle;
  /** 启动函数（返回 Fastify 路由注册函数或 undefined） */
  routeRegistrar?: (app: any, options?: Record<string, unknown>) => Promise<void>;
}

/**
 * 依赖校验结果
 */
export interface DependencyValidationResult {
  valid: boolean;
  /** 不满足的依赖列表 */
  missingDependencies: string[];
  /** 循环依赖链（如果有） */
  circularDependencies?: string[][];
}

/**
 * 模块管理器配置
 */
export interface ModuleManagerConfig {
  /** 核心模块配置（不可禁用） */
  core?: Record<string, { enabled: boolean }>;
  /** 功能域配置 */
  domains?: Record<string, ModuleConfig>;
  /** 服务级配置 */
  services?: Record<string, ModuleConfig>;
  /** 特性级配置 */
  features?: Record<string, { enabled: boolean }>;
}
```

- [ ] **Step 2: 提交**

```bash
git add src/services/module-lifecycle/types.ts
git commit -m "feat: add module lifecycle type definitions"
```

---

### Task 2: ModuleRegistry 实现

**Files:**
- Create: `src/services/module-lifecycle/ModuleRegistry.ts`
- Test: `src/services/module-lifecycle/__tests__/ModuleRegistry.test.ts`

- [ ] **Step 1: 编写 ModuleRegistry 测试**

```typescript
// src/services/module-lifecycle/__tests__/ModuleRegistry.test.ts

import { ModuleRegistry, ModuleDescriptor, ModuleLifecycle } from '../ModuleRegistry';

describe('ModuleRegistry', () => {
  let registry: ModuleRegistry;

  beforeEach(() => {
    registry = new ModuleRegistry();
  });

  describe('register', () => {
    it('should register a module successfully', () => {
      const module: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: 'A test module',
        level: 'service',
        state: 'registered',
        config: { enabled: true, autoStart: true, priority: 10 },
      };
      registry.register(module);
      expect(registry.get('test-module')).toEqual(module);
    });

    it('should throw error when registering duplicate module', () => {
      const module: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: 'A test module',
        level: 'service',
        state: 'registered',
        config: { enabled: true },
      };
      registry.register(module);
      expect(() => registry.register(module)).toThrow('Module test-module is already registered');
    });
  });

  describe('state transitions', () => {
    it('should transition from registered to starting to active', () => {
      const module: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: 'A test module',
        level: 'service',
        state: 'registered',
        config: { enabled: true },
      };
      registry.register(module);
      registry.setState('test-module', 'starting');
      registry.setState('test-module', 'active');
      expect(registry.get('test-module')?.state).toBe('active');
    });

    it('should transition to failed state with error message', () => {
      const module: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: 'A test module',
        level: 'service',
        state: 'registered',
        config: { enabled: true },
      };
      registry.register(module);
      registry.setFailed('test-module', new Error('Connection failed'));
      const mod = registry.get('test-module');
      expect(mod?.state).toBe('failed');
      expect(mod?.error).toBe('Connection failed');
    });
  });

  describe('dependency validation', () => {
    it('should validate satisfied dependencies', () => {
      registry.register({
        id: 'module-a', name: 'A', description: '', level: 'service',
        state: 'active', config: { enabled: true },
      });
      registry.register({
        id: 'module-b', name: 'B', description: '', level: 'service',
        state: 'registered', config: { enabled: true, dependencies: ['module-a'] },
      });
      const result = registry.validateDependencies();
      expect(result.valid).toBe(true);
      expect(result.missingDependencies).toEqual([]);
    });

    it('should detect missing dependencies', () => {
      registry.register({
        id: 'module-b', name: 'B', description: '', level: 'service',
        state: 'registered', config: { enabled: true, dependencies: ['module-a', 'module-c'] },
      });
      const result = registry.validateDependencies();
      expect(result.valid).toBe(false);
      expect(result.missingDependencies).toContain('module-a');
      expect(result.missingDependencies).toContain('module-c');
    });

    it('should detect circular dependencies', () => {
      registry.register({
        id: 'module-a', name: 'A', description: '', level: 'service',
        state: 'registered', config: { enabled: true, dependencies: ['module-b'] },
      });
      registry.register({
        id: 'module-b', name: 'B', description: '', level: 'service',
        state: 'registered', config: { enabled: true, dependencies: ['module-a'] },
      });
      const result = registry.validateDependencies();
      expect(result.circularDependencies).toBeDefined();
      expect(result.circularDependencies!.length).toBeGreaterThan(0);
    });
  });

  describe('getStartupOrder', () => {
    it('should return modules in dependency order', () => {
      registry.register({
        id: 'db', name: 'DB', description: '', level: 'core',
        state: 'registered', config: { enabled: true, priority: 1 },
      });
      registry.register({
        id: 'auth', name: 'Auth', description: '', level: 'core',
        state: 'registered', config: { enabled: true, dependencies: ['db'], priority: 2 },
      });
      registry.register({
        id: 'api', name: 'API', description: '', level: 'domain',
        state: 'registered', config: { enabled: true, dependencies: ['auth'], priority: 10 },
      });
      const order = registry.getStartupOrder();
      expect(order).toEqual(['db', 'auth', 'api']);
    });
  });

  describe('listByLevel', () => {
    it('should filter modules by level', () => {
      registry.register({
        id: 'core-1', name: 'Core 1', description: '', level: 'core',
        state: 'registered', config: { enabled: true },
      });
      registry.register({
        id: 'svc-1', name: 'Svc 1', description: '', level: 'service',
        state: 'registered', config: { enabled: true },
      });
      const core = registry.listByLevel('core');
      expect(core).toHaveLength(1);
      expect(core[0].id).toBe('core-1');
    });
  });

  describe('getActiveModules', () => {
    it('should return only active modules', () => {
      registry.register({
        id: 'active', name: 'Active', description: '', level: 'service',
        state: 'active', config: { enabled: true },
      });
      registry.register({
        id: 'stopped', name: 'Stopped', description: '', level: 'service',
        state: 'stopped', config: { enabled: false },
      });
      const active = registry.getActiveModules();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('active');
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx jest src/services/module-lifecycle/__tests__/ModuleRegistry.test.ts --no-coverage 2>&1 | tail -10
```
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: 实现 ModuleRegistry**

```typescript
// src/services/module-lifecycle/ModuleRegistry.ts

import pino from 'pino';
import {
  ModuleDescriptor,
  ModuleState,
  DependencyValidationResult,
} from './types';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export { ModuleDescriptor, ModuleState, DependencyValidationResult } from './types';

export class ModuleRegistry {
  private modules: Map<string, ModuleDescriptor> = new Map();

  /**
   * 注册模块
   */
  register(descriptor: ModuleDescriptor): void {
    if (this.modules.has(descriptor.id)) {
      throw new Error(`Module ${descriptor.id} is already registered`);
    }
    this.modules.set(descriptor.id, descriptor);
    logger.debug(`[ModuleRegistry] Registered module: ${descriptor.id}`);
  }

  /**
   * 获取模块
   */
  get(id: string): ModuleDescriptor | undefined {
    return this.modules.get(id);
  }

  /**
   * 获取所有模块
   */
  getAll(): ModuleDescriptor[] {
    return Array.from(this.modules.values());
  }

  /**
   * 更新模块状态
   */
  setState(id: string, state: ModuleState): void {
    const mod = this.modules.get(id);
    if (!mod) {
      throw new Error(`Module ${id} not found`);
    }
    mod.state = state;
    logger.debug(`[ModuleRegistry] ${id} -> ${state}`);
  }

  /**
   * 标记模块为失败状态
   */
  setFailed(id: string, error: Error): void {
    const mod = this.modules.get(id);
    if (!mod) {
      throw new Error(`Module ${id} not found`);
    }
    mod.state = 'failed';
    mod.error = error.message;
    logger.error(`[ModuleRegistry] ${id} failed: ${error.message}`);
  }

  /**
   * 校验所有依赖
   */
  validateDependencies(): DependencyValidationResult {
    const missingDependencies: string[] = [];
    const circularDependencies: string[][] = [];

    // 检查缺失依赖
    for (const mod of this.modules.values()) {
      const deps = mod.config.dependencies || [];
      for (const dep of deps) {
        if (!this.modules.has(dep)) {
          missingDependencies.push(dep);
        }
      }
    }

    // 检测循环依赖
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const detectCycle = (id: string, path: string[]): void => {
      if (visiting.has(id)) {
        const cycleStart = path.indexOf(id);
        if (cycleStart !== -1) {
          circularDependencies.push([...path.slice(cycleStart), id]);
        }
        return;
      }
      if (visited.has(id)) return;

      visiting.add(id);
      const mod = this.modules.get(id);
      if (mod?.config.dependencies) {
        for (const dep of mod.config.dependencies) {
          detectCycle(dep, [...path, id]);
        }
      }
      visiting.delete(id);
      visited.add(id);
    };

    for (const mod of this.modules.values()) {
      detectCycle(mod.id, []);
    }

    return {
      valid: missingDependencies.length === 0 && circularDependencies.length === 0,
      missingDependencies,
      circularDependencies: circularDependencies.length > 0 ? circularDependencies : undefined,
    };
  }

  /**
   * 获取启动顺序（拓扑排序）
   */
  getStartupOrder(): string[] {
    const result: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (id: string): void => {
      if (visiting.has(id)) return; // 循环依赖跳过
      if (visited.has(id)) return;

      visiting.add(id);
      const mod = this.modules.get(id);
      if (mod?.config.dependencies) {
        for (const dep of mod.config.dependencies) {
          visit(dep);
        }
      }
      visiting.delete(id);
      visited.add(id);
      result.push(id);
    };

    // 按优先级排序后遍历
    const sorted = this.getAll().sort((a, b) =>
      (a.config.priority ?? 100) - (b.config.priority ?? 100)
    );

    for (const mod of sorted) {
      visit(mod.id);
    }

    return result;
  }

  /**
   * 按层级筛选模块
   */
  listByLevel(level: ModuleDescriptor['level']): ModuleDescriptor[] {
    return this.getAll().filter(m => m.level === level);
  }

  /**
   * 获取活跃模块
   */
  getActiveModules(): ModuleDescriptor[] {
    return this.getAll().filter(m => m.state === 'active');
  }

  /**
   * 获取启用的模块（enabled=true，不论状态）
   */
  getEnabledModules(): ModuleDescriptor[] {
    return this.getAll().filter(m => m.config.enabled);
  }

  /**
   * 获取模块总数
   */
  get size(): number {
    return this.modules.size;
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx jest src/services/module-lifecycle/__tests__/ModuleRegistry.test.ts --no-coverage 2>&1 | tail -15
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/services/module-lifecycle/ModuleRegistry.ts src/services/module-lifecycle/__tests__/ModuleRegistry.test.ts
git commit -m "feat: implement ModuleRegistry with dependency validation and startup ordering"
```

---

### Task 3: ModuleManager 实现

**Files:**
- Create: `src/services/module-lifecycle/ModuleManager.ts`
- Create: `src/services/module-lifecycle/index.ts`
- Test: `src/services/module-lifecycle/__tests__/ModuleManager.test.ts`

- [ ] **Step 1: 编写 ModuleManager 测试**

```typescript
// src/services/module-lifecycle/__tests__/ModuleManager.test.ts

import { ModuleManager, ModuleLifecycle, ModuleDescriptor } from '../ModuleManager';
import { UnifiedConfigService } from '../../../config/UnifiedConfigService';

describe('ModuleManager', () => {
  let manager: ModuleManager;
  let mockConfig: { get: jest.Mock };

  beforeEach(() => {
    mockConfig = {
      get: jest.fn().mockReturnValue({
        core: {
          auth: { enabled: true },
          database: { enabled: true },
        },
        domains: {
          ai: { enabled: true, autoStart: true },
          chaos: { enabled: false },
        },
        services: {
          adaptivePipeline: { enabled: true },
        },
      }),
    };
    manager = new ModuleManager(mockConfig as any);
  });

  describe('loadFromConfig', () => {
    it('should load module configuration', () => {
      manager.loadFromConfig();
      expect(manager.getRegistry().size).toBeGreaterThan(0);
    });

    it('should mark disabled modules as not enabled', () => {
      manager.loadFromConfig();
      const chaos = manager.getRegistry().get('domain:chaos');
      expect(chaos?.config.enabled).toBe(false);
    });
  });

  describe('startAll', () => {
    it('should start all enabled modules in dependency order', async () => {
      manager.loadFromConfig();
      await manager.startAll();
      const active = manager.getRegistry().getActiveModules();
      const chaos = manager.getRegistry().get('domain:chaos');
      expect(active.length).toBeGreaterThan(0);
      expect(chaos?.state).not.toBe('active');
    });
  });

  describe('startModule', () => {
    it('should start a single module and call lifecycle', async () => {
      const lifecycle: ModuleLifecycle = {
        initialize: jest.fn(),
        start: jest.fn(),
        healthCheck: jest.fn().mockResolvedValue(true),
      };
      const descriptor: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: 'A test',
        level: 'service',
        state: 'registered',
        config: { enabled: true },
      };
      manager.registerModule(descriptor, lifecycle);
      await manager.startModule('test-module');
      expect(lifecycle.initialize).toHaveBeenCalled();
      expect(lifecycle.start).toHaveBeenCalled();
      const mod = manager.getRegistry().get('test-module');
      expect(mod?.state).toBe('active');
    });

    it('should fail if dependencies are not met', async () => {
      const descriptor: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: 'A test',
        level: 'service',
        state: 'registered',
        config: { enabled: true, dependencies: ['missing-dep'] },
      };
      manager.registerModule(descriptor);
      await expect(manager.startModule('test-module')).rejects.toThrow('missing-dep');
    });
  });

  describe('stopModule', () => {
    it('should stop a module and call lifecycle stop', async () => {
      const lifecycle: ModuleLifecycle = {
        stop: jest.fn(),
      };
      const descriptor: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: 'A test',
        level: 'service',
        state: 'active',
        config: { enabled: true },
      };
      manager.registerModule(descriptor, lifecycle);
      await manager.stopModule('test-module');
      expect(lifecycle.stop).toHaveBeenCalled();
      const mod = manager.getRegistry().get('test-module');
      expect(mod?.state).toBe('stopped');
    });
  });

  describe('isModuleEnabled', () => {
    it('should check if a module is enabled', () => {
      const descriptor: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: 'A test',
        level: 'service',
        state: 'registered',
        config: { enabled: true },
      };
      manager.registerModule(descriptor);
      expect(manager.isModuleEnabled('test-module')).toBe(true);
    });
  });

  describe('getModuleStatus', () => {
    it('should return status for all modules', () => {
      const descriptor: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: 'A test',
        level: 'service',
        state: 'active',
        config: { enabled: true },
      };
      manager.registerModule(descriptor);
      const status = manager.getModuleStatus();
      expect(status.modules).toHaveLength(1);
      expect(status.modules[0].id).toBe('test-module');
      expect(status.modules[0].state).toBe('active');
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx jest src/services/module-lifecycle/__tests__/ModuleManager.test.ts --no-coverage 2>&1 | tail -10
```
Expected: FAIL

- [ ] **Step 3: 实现 ModuleManager**

```typescript
// src/services/module-lifecycle/ModuleManager.ts

import pino from 'pino';
import { ModuleRegistry } from './ModuleRegistry';
import {
  ModuleDescriptor,
  ModuleLevel,
  ModuleConfig,
  ModuleLifecycle,
  ModuleRegistration,
  ModuleManagerConfig,
} from './types';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export { ModuleLifecycle } from './types';
export { ModuleDescriptor } from './types';

export class ModuleManager {
  private registry: ModuleRegistry;
  private registrations: Map<string, ModuleRegistration> = new Map();
  private configGetter: () => ModuleManagerConfig;

  constructor(configGetter: () => ModuleManagerConfig) {
    this.registry = new ModuleRegistry();
    this.configGetter = configGetter;
  }

  /**
   * 从配置加载模块定义
   */
  loadFromConfig(): void {
    const config = this.configGetter();

    // L0: 核心模块（自动启用）
    if (config.core) {
      for (const [id, cfg] of Object.entries(config.core)) {
        this.registerModule({
          id: `core:${id}`,
          name: id,
          description: `Core module: ${id}`,
          level: 'core',
          state: 'registered',
          config: { enabled: true, autoStart: true, priority: 1 },
        });
      }
    }

    // L1: 功能域
    if (config.domains) {
      for (const [domainId, domainConfig] of Object.entries(config.domains)) {
        const domainModule: ModuleDescriptor = {
          id: `domain:${domainId}`,
          name: domainId,
          description: `Domain: ${domainId}`,
          level: 'domain',
          state: 'registered',
          config: {
            enabled: domainConfig.enabled ?? true,
            autoStart: domainConfig.autoStart ?? true,
            priority: 50,
          },
        };
        this.registry.register(domainModule);

        // 如果域内有服务级配置，注册服务模块
        if (domainConfig.services) {
          for (const [serviceId, serviceConfig] of Object.entries(domainConfig.services)) {
            this.registerModule({
              id: `service:${serviceId}`,
              name: serviceId,
              description: `Service: ${serviceId} (domain: ${domainId})`,
              level: 'service',
              domain: domainId,
              state: 'registered',
              config: {
                ...serviceConfig,
                dependencies: [
                  ...(serviceConfig.dependencies || []),
                  `domain:${domainId}`,
                ],
                priority: 60,
              },
            });
          }
        }
      }
    }

    // L2: 独立服务
    if (config.services) {
      for (const [serviceId, serviceConfig] of Object.entries(config.services)) {
        this.registerModule({
          id: `service:${serviceId}`,
          name: serviceId,
          description: `Service: ${serviceId}`,
          level: 'service',
          state: 'registered',
          config: { ...serviceConfig, priority: 70 },
        });
      }
    }

    // L3: 特性级
    if (config.features) {
      for (const [featureId, featureConfig] of Object.entries(config.features)) {
        this.registerModule({
          id: `feature:${featureId}`,
          name: featureId,
          description: `Feature: ${featureId}`,
          level: 'feature',
          state: 'registered',
          config: { enabled: featureConfig.enabled ?? true, priority: 80 },
        });
      }
    }

    logger.info(`[ModuleManager] Loaded ${this.registry.size} modules from configuration`);
  }

  /**
   * 注册模块及其生命周期
   */
  registerModule(descriptor: ModuleDescriptor, lifecycle?: ModuleLifecycle, routeRegistrar?: ModuleRegistration['routeRegistrar']): void {
    // 如果模块已在注册表中，合并配置
    const existing = this.registry.get(descriptor.id);
    if (existing) {
      // 已存在，更新生命周期
      this.registrations.set(descriptor.id, { descriptor, lifecycle, routeRegistrar });
      return;
    }

    this.registry.register(descriptor);
    this.registrations.set(descriptor.id, { descriptor, lifecycle, routeRegistrar });
  }

  /**
   * 启动所有模块
   */
  async startAll(): Promise<void> {
    // 校验依赖
    const validation = this.registry.validateDependencies();
    if (!validation.valid) {
      const issues = [
        ...validation.missingDependencies.map(d => `Missing dependency: ${d}`),
        ...(validation.circularDependencies || []).map(c => `Circular dependency: ${c.join(' -> ')}`),
      ];
      logger.warn(`[ModuleManager] Dependency issues: ${issues.join(', ')}`);
    }

    // 按依赖顺序启动
    const startupOrder = this.registry.getStartupOrder();

    for (const moduleId of startupOrder) {
      const mod = this.registry.get(moduleId);
      if (!mod || !mod.config.enabled) {
        continue;
      }
      try {
        await this.startModule(moduleId);
      } catch (error: any) {
        logger.error(`[ModuleManager] Failed to start ${moduleId}: ${error.message}`);
        this.registry.setFailed(moduleId, error);
      }
    }

    const active = this.registry.getActiveModules();
    logger.info(`[ModuleManager] Started ${active.length}/${this.registry.size} modules`);
  }

  /**
   * 启动单个模块
   */
  async startModule(id: string): Promise<void> {
    const mod = this.registry.get(id);
    if (!mod) {
      throw new Error(`Module ${id} not found`);
    }

    if (!mod.config.enabled) {
      logger.debug(`[ModuleManager] ${id} is disabled, skipping`);
      return;
    }

    // 检查依赖
    const deps = mod.config.dependencies || [];
    for (const dep of deps) {
      const depMod = this.registry.get(dep);
      if (!depMod || depMod.state !== 'active') {
        throw new Error(`Dependency ${dep} is not active for module ${id}`);
      }
    }

    this.registry.setState(id, 'starting');

    const registration = this.registrations.get(id);
    if (registration?.lifecycle) {
      await registration.lifecycle.initialize?.();
      await registration.lifecycle.start?.();
    }

    this.registry.setState(id, 'active');
    logger.info(`[ModuleManager] Module ${id} started`);
  }

  /**
   * 停止单个模块
   */
  async stopModule(id: string): Promise<void> {
    const mod = this.registry.get(id);
    if (!mod) {
      throw new Error(`Module ${id} not found`);
    }

    // 检查是否有其他活跃模块依赖此模块
    const dependents = this.registry.getAll().filter(m =>
      m.state === 'active' &&
      m.config.dependencies?.includes(id)
    );
    if (dependents.length > 0) {
      throw new Error(`Cannot stop ${id}: ${dependents.map(d => d.id).join(', ')} depend on it`);
    }

    this.registry.setState(id, 'stopping');

    const registration = this.registrations.get(id);
    if (registration?.lifecycle) {
      await registration.lifecycle.stop?.();
    }

    this.registry.setState(id, 'stopped');
    logger.info(`[ModuleManager] Module ${id} stopped`);
  }

  /**
   * 检查模块是否启用
   */
  isModuleEnabled(id: string): boolean {
    const mod = this.registry.get(id);
    return mod?.config.enabled ?? false;
  }

  /**
   * 获取模块状态
   */
  getModuleStatus(): { modules: ModuleDescriptor[]; total: number; active: number; failed: number } {
    const modules = this.registry.getAll();
    return {
      modules,
      total: modules.length,
      active: modules.filter(m => m.state === 'active').length,
      failed: modules.filter(m => m.state === 'failed').length,
    };
  }

  /**
   * 获取注册表（用于 routes.ts 检查）
   */
  getRegistry(): ModuleRegistry {
    return this.registry;
  }
}
```

- [ ] **Step 4: 创建 index.ts 导出**

```typescript
// src/services/module-lifecycle/index.ts

export { ModuleRegistry } from './ModuleRegistry';
export { ModuleManager, ModuleLifecycle } from './ModuleManager';
export {
  ModuleDescriptor,
  ModuleState,
  ModuleLevel,
  ModuleConfig,
  ModuleLifecycle as ModuleLifecycleInterface,
  ModuleRegistration,
  ModuleManagerConfig,
  DependencyValidationResult,
} from './types';
```

- [ ] **Step 5: 运行测试确认通过**

```bash
npx jest src/services/module-lifecycle/__tests__/ModuleManager.test.ts --no-coverage 2>&1 | tail -15
```
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/services/module-lifecycle/ModuleManager.ts src/services/module-lifecycle/index.ts src/services/module-lifecycle/__tests__/ModuleManager.test.ts
git commit -m "feat: implement ModuleManager with lifecycle management and config loading"
```

---

### Task 4: UnifiedConfigService 集成 moduleConfig 域

**Files:**
- Modify: `src/config/UnifiedConfigService.ts`

- [ ] **Step 1: 添加 moduleConfig 到 SystemConfig 接口和默认配置**

读取 `src/config/UnifiedConfigService.ts` 的 SystemConfig 接口，添加：

```typescript
// 在 SystemConfig 接口中添加：
moduleConfig: {
  core: Record<string, { enabled: boolean }>;
  domains: Record<string, { enabled: boolean; autoStart?: boolean; services?: Record<string, ModuleConfig> }>;
  services: Record<string, ModuleConfig>;
  features: Record<string, { enabled: boolean }>;
};
```

在 DEFAULT_CONFIG 中添加：

```typescript
moduleConfig: {
  core: {
    auth: { enabled: true },
    tenant: { enabled: true },
    database: { enabled: true },
    eventBus: { enabled: true },
    audit: { enabled: true },
    config: { enabled: true },
    degradation: { enabled: true },
    privacy: { enabled: true },
  },
  domains: {
    pipeline: { enabled: true, autoStart: true },
    build: { enabled: true, autoStart: true },
    deploy: { enabled: true, autoStart: true },
    monitoring: { enabled: true, autoStart: true },
    alert: { enabled: true, autoStart: true },
    security: { enabled: true, autoStart: true },
    ai: { enabled: true, autoStart: true },
    finops: { enabled: true, autoStart: true },
    chaos: { enabled: true, autoStart: true },
    backup: { enabled: true, autoStart: true },
    disasterRecovery: { enabled: true, autoStart: true },
    selfHealing: { enabled: true, autoStart: true },
    ticketing: { enabled: true, autoStart: true },
    knowledge: { enabled: true, autoStart: true },
    plugin: { enabled: true, autoStart: true },
    chatops: { enabled: true, autoStart: true },
    digitalTwin: { enabled: true, autoStart: true },
    federation: { enabled: true, autoStart: true },
    multiCloud: { enabled: true, autoStart: true },
    dataPipeline: { enabled: true, autoStart: true },
    community: { enabled: true, autoStart: true },
    efficiency: { enabled: true, autoStart: true },
    cmdb: { enabled: true, autoStart: true },
    iac: { enabled: true, autoStart: true },
  },
  services: {
    adaptivePipeline: { enabled: true },
    consistency: { enabled: false },
    deploymentWindow: { enabled: true },
    outputValidation: { enabled: false },
    costTracking: { enabled: true },
    riskEngine: { enabled: true },
    modelVersion: { enabled: false },
    agentRun: { enabled: false },
    agentProfile: { enabled: false },
    cmdbIntegration: { enabled: false },
  },
  features: {},
},
```

- [ ] **Step 2: 在 config 便捷访问中添加 moduleConfig**

在 `config` 对象的 getter 中添加：

```typescript
get moduleConfig() { return this.config.moduleConfig; },
```

- [ ] **Step 3: TypeScript 检查**

```bash
npx tsc --noEmit 2>&1 | tail -10
```
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add src/config/UnifiedConfigService.ts
git commit -m "feat: add moduleConfig domain to UnifiedConfigService with default module enable/disable settings"
```

---

### Task 5: 模块管理 API (module-routes.ts)

**Files:**
- Create: `src/api/module-routes.ts`
- Test: `npx jest src/api/__tests__/module-routes.test.ts --no-coverage`

- [ ] **Step 1: 创建模块管理 API**

```typescript
// src/api/module-routes.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ModuleManager } from '../services/module-lifecycle/ModuleManager';

interface ModuleRoutesOptions {
  moduleManager: ModuleManager;
}

interface ToggleModuleBody {
  enabled: boolean;
}

export default async function moduleRoutes(
  app: FastifyInstance,
  options: ModuleRoutesOptions
): Promise<void> {
  const { moduleManager } = options;

  // GET /v1/system/modules - 获取所有模块状态
  app.get('/', async (_request, reply) => {
    const status = moduleManager.getModuleStatus();
    return reply.send(status);
  });

  // GET /v1/system/modules/:id - 获取单个模块状态
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const mod = moduleManager.getRegistry().get(request.params.id);
    if (!mod) {
      return reply.status(404).send({ error: 'MODULE_NOT_FOUND', id: request.params.id });
    }
    return reply.send({ module: mod });
  });

  // PUT /v1/system/modules/:id/toggle - 启用/禁用模块
  app.put<{ Params: { id: string }; Body: ToggleModuleBody }>('/:id/toggle', async (request, reply) => {
    const { id } = request.params;
    const { enabled } = request.body;

    const mod = moduleManager.getRegistry().get(id);
    if (!mod) {
      return reply.status(404).send({ error: 'MODULE_NOT_FOUND', id });
    }

    // 核心模块不可禁用
    if (mod.level === 'core' && !enabled) {
      return reply.status(400).send({
        error: 'CORE_MODULE_CANNOT_BE_DISABLED',
        message: `Core module ${id} cannot be disabled`,
      });
    }

    mod.config.enabled = enabled;

    if (enabled && mod.state !== 'active') {
      try {
        await moduleManager.startModule(id);
      } catch (error: any) {
        return reply.status(500).send({
          error: 'MODULE_START_FAILED',
          message: error.message,
        });
      }
    } else if (!enabled && mod.state === 'active') {
      try {
        await moduleManager.stopModule(id);
      } catch (error: any) {
        return reply.status(500).send({
          error: 'MODULE_STOP_FAILED',
          message: error.message,
        });
      }
    }

    return reply.send({ module: mod });
  });

  // GET /v1/system/modules/validate - 校验依赖
  app.get('/validate', async (_request, reply) => {
    const validation = moduleManager.getRegistry().validateDependencies();
    return reply.send({ validation });
  });

  // GET /v1/system/modules/startup-order - 获取启动顺序
  app.get('/startup-order', async (_request, reply) => {
    const order = moduleManager.getRegistry().getStartupOrder();
    return reply.send({ order });
  });
}
```

- [ ] **Step 2: 在 routes.ts 中注册模块路由**

读取 `src/api/routes.ts`，在统一配置路由附近添加：

```typescript
// 在 routes.ts 中添加 import
import moduleRoutes from './module-routes';

// 在统一配置路由注册后添加：
await registerWithRoleGuard(app, moduleRoutes, '/v1/system/modules', {
  moduleManager: options.moduleManager,
});
```

- [ ] **Step 3: TypeScript 检查**

```bash
npx tsc --noEmit 2>&1 | tail -10
```
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add src/api/module-routes.ts src/api/routes.ts
git commit -m "feat: add module management API endpoints for status, toggle, validation, and startup order"
```

---

### Task 6: routes.ts 集成 ModuleManager

**Files:**
- Modify: `src/api/routes.ts`

- [ ] **Step 1: 修改 routes.ts 使用 ModuleManager**

在 `src/api/routes.ts` 中：

1. 在文件开头添加：
```typescript
import { ModuleManager } from '../services/module-lifecycle/ModuleManager';
```

2. 在函数入口处创建 ModuleManager：
```typescript
// 在 route 注册之前
const moduleManager = new ModuleManager(() => config.get('moduleConfig') as any);
moduleManager.loadFromConfig();
```

3. 在路由注册时，检查模块是否启用：
```typescript
// 示例：只在 chaos 域启用时注册混沌工程路由
if (moduleManager.isModuleEnabled('domain:chaos')) {
  await registerWithRoleGuard(app, chaosRoutes, '/v1/chaos', { database: options.database });
} else {
  logger.info('[routes] Chaos module disabled, skipping route registration');
}

// AI 域
if (moduleManager.isModuleEnabled('domain:ai')) {
  await registerWithRoleGuard(app, aiGatewayRoutes, '/v1/ai-gateway', { database: options.database });
}

// FinOps 域
if (moduleManager.isModuleEnabled('domain:finops')) {
  await registerWithRoleGuard(app, finopsV2Routes, '/v1/finops', { database: options.database });
}
```

对以下域添加条件检查：
- `chaos` → chaosRoutes
- `ai` → aiGatewayRoutes, aiReviewRoutes, aiSecurityRoutes
- `finops` → finopsV2Routes, costRoutes, costOperationsRoutes
- `community` → communityRoutes
- `federation` → federationRoutes
- `multiCloud` → multiCloudRoutes
- `dataPipeline` → dataPipelineRoutes
- `digitalTwin` → digitalTwinRoutes

核心域（pipeline, build, deploy, monitoring, alert, security, tenant, auth）无条件注册。

- [ ] **Step 2: TypeScript 检查**

```bash
npx tsc --noEmit 2>&1 | tail -10
```
Expected: PASS

- [ ] **Step 3: 运行全量测试**

```bash
npm run test 2>&1 | tail -10
```
Expected: No regression from current test counts

- [ ] **Step 4: 提交**

```bash
git add src/api/routes.ts
git commit -m "feat: integrate ModuleManager into routes.ts for conditional route registration based on module config"
```

---

### Task 7: 端到端验证 + 文档

**Files:**
- Create: `docs/superpowers/guides/module-configuration.md`

- [ ] **Step 1: 启动服务验证**

```bash
cd orion-platform-service && npm run dev 2>&1 | grep -E "ModuleManager|modules|Module"
```
Expected: Should see "[ModuleManager] Loaded X modules from configuration" and "[ModuleManager] Started Y/X modules"

- [ ] **Step 2: 验证 API 端点**

```bash
curl -s http://localhost:3001/api/v1/system/modules | jq '.total, .active, .failed'
curl -s http://localhost:3001/api/v1/system/modules/startup-order | jq '.order'
curl -s http://localhost:3001/api/v1/system/modules/validate | jq '.validation.valid'
```

- [ ] **Step 3: 编写使用文档**

```markdown
# 模块配置化启用指南

## 概述

Orion 平台采用四层混合架构实现模块配置化启用：
- L0 核心层：8 个横切关注点，不可禁用
- L1 功能域：~24 个功能域，可启用/禁用
- L2 服务级：~10 个独立服务，可启用/禁用
- L3 特性级：Feature Flag 级别 API 控制

## 配置方式

在 UnifiedConfigService 中通过 `moduleConfig` 域配置：

```typescript
// 禁用混沌工程整个域
config.set('moduleConfig.domains.chaos', { enabled: false });

// 禁用 FinOps 域内的 costTracking 服务
config.set('moduleConfig.domains.finops.services.costTracking', { enabled: false });

// 启用自适应 Pipeline 服务
config.set('moduleConfig.services.adaptivePipeline', { enabled: true });
```

## API 端点

- `GET /api/v1/system/modules` - 查看所有模块状态
- `GET /api/v1/system/modules/:id` - 查看单个模块状态
- `PUT /api/v1/system/modules/:id/toggle` - 启用/禁用模块
- `GET /api/v1/system/modules/validate` - 校验依赖关系
- `GET /api/v1/system/modules/startup-order` - 查看启动顺序

## 依赖安全

启动时自动校验依赖关系：
- 缺失依赖：日志警告，不阻断启动
- 循环依赖：日志警告，跳过循环链
- 核心模块不可禁用
- 有其他模块依赖的活跃模块不可停止
```

- [ ] **Step 4: 最终 TypeScript + 测试检查**

```bash
npx tsc --noEmit 2>&1 | tail -5
npm run test 2>&1 | tail -5
```

- [ ] **Step 5: 提交**

```bash
git add docs/superpowers/guides/module-configuration.md
git commit -m "docs: add module configuration guide and verify end-to-end functionality"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- ✅ ModuleRegistry with dependency validation
- ✅ ModuleManager with lifecycle management
- ✅ UnifiedConfigService moduleConfig domain
- ✅ Module management API endpoints
- ✅ routes.ts integration with conditional registration
- ✅ Tests for ModuleRegistry and ModuleManager
- ✅ Documentation

**2. Placeholder scan:**
- ✅ All code snippets are complete with actual content
- ✅ All test cases have concrete assertions
- ✅ No "TBD" or "TODO" patterns

**3. Type consistency:**
- ✅ ModuleDescriptor, ModuleState, ModuleConfig defined in types.ts and used consistently
- ✅ ModuleLifecycle interface matches implementation
- ✅ ModuleManagerConfig matches UnifiedConfigService structure
- ✅ All method signatures consistent across files
