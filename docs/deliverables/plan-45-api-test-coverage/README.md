# Plan 45 — 前端 API 测试覆盖补全

- **优先级**: P0
- **来源**: 全量代码扫描发现 — API 测试覆盖仅 7.3%

## 本地证据

| 指标 | 数值 | 证据 |
|------|------|------|
| API 模块总数 | 177 | `ls orion-frontend/src/api/*.ts \| wc -l` |
| 有测试的模块 | 13 | `ls orion-frontend/src/api/__tests__/*.test.ts \| wc -l` |
| 覆盖率 | 7.3% | 13/177 |
| 核心无测试模块 | 8+ | auth, projects, pipelines, deployments, cmdb, agents, ai-gateway, alert |

### 已有测试的模块 (13 个)
ai-security, api-key, backup, client, cron, eventbus, knowledge, llm-trace, notificationRules, plugin-spi, session, test-selector, webhook

### 可借鉴的测试模式
`src/api/__tests__/client.test.ts` — 完整测试 client.ts 拦截器、401 刷新、错误处理

## 补全计划

### Phase 1: P0 核心业务模块 (8 个)

```
src/api/__tests__/
├── auth.test.ts           # 登录、登出、刷新 token、权限
├── projects.test.ts       # 项目 CRUD、成员管理
├── pipelines.test.ts      # Pipeline CRUD、触发、状态查询
├── deployments.test.ts     # 部署 CRUD、灰度、回滚
├── cmdb.test.ts           # CI 类型、CI 实例、关系
├── agents.test.ts         # Agent 注册、心跳、状态
├── ai-gateway.test.ts     # AI 网关、模型列表、调用
└── alert.test.ts          # 告警规则、触发历史
```

### Phase 2: P1 重要业务模块 (12 个)

```
src/api/__tests__/
├── incident.test.ts       # 事件管理
├── ticketing.test.ts      # 工单系统
├── artifact.test.ts       # 制品管理
├── backup.test.ts         # 补充 backup 测试
├── chaos.test.ts          # 混沌实验
├── sbom.test.ts           # SBOM 管理
├── circuit-breaker.test.ts # 熔断器配置
├── datasource.test.ts     # 数据源管理
├── finops.test.ts         # 成本分析
├── i18n.test.ts           # 国际化 API
├── monitoring.test.ts     # 监控面板
└── workflow.test.ts       # 工作流引擎
```

### Phase 3: P2 其余模块 (144 个)

按模块分组批量补全，每组 10-15 个模块。

## 测试模板

```typescript
// src/api/__tests__/auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { authApi } from '../auth';

vi.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('authApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('returns token and user on success', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { token: 'jwt-token', user: { id: '1', name: 'admin' } },
        },
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await authApi.login({
        username: 'admin',
        password: 'password',
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/api/v1/auth/login',
        { username: 'admin', password: 'password' }
      );
      expect(result.token).toBe('jwt-token');
    });

    it('throws on invalid credentials', async () => {
      mockedAxios.post.mockRejectedValue({
        response: { status: 401, data: { error: 'Invalid credentials' } },
      });

      await expect(
        authApi.login({ username: 'wrong', password: 'wrong' })
      ).rejects.toMatchObject({ response: { status: 401 } });
    });
  });

  describe('logout', () => {
    it('calls logout endpoint', async () => {
      mockedAxios.post.mockResolvedValue({ data: { success: true } });
      await authApi.logout();
      expect(mockedAxios.post).toHaveBeenCalledWith('/api/v1/auth/logout');
    });
  });

  describe('refreshToken', () => {
    it('returns new token', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { success: true, data: { token: 'new-token' } },
      });
      const result = await authApi.refreshToken();
      expect(result.token).toBe('new-token');
    });
  });
});
```

## CI 门禁

```yaml
# vitest.config.ts coverage 配置
coverage: {
  thresholds: {
    lines: 50,
    functions: 50,
    branches: 40,
    statements: 50,
  },
  include: ['src/api/**'],
  exclude: ['src/api/__tests__/**'],
}

# CI 命令
- name: API Test Coverage
  run: cd orion-frontend && npx vitest run --coverage src/api/
```

## 预期目标

| 阶段 | 新增测试模块 | 累计覆盖率 |
|------|------------|-----------|
| 现状 | 0 | 7.3% (13/177) |
| Phase 1 | 8 | 11.9% (21/177) |
| Phase 2 | 12 | 18.6% (33/177) |
| Phase 3 | 144 | 100% (177/177) |
