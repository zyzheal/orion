# Test Selector Service Design

> 状态: ✅ 后端已实现 | 数据存储: PostgreSQL Repository 模式
> 创建日期: 2026-04-23 | 关联: M14 构建环境

---

## 1. 服务概述

Test Selector Service (测试选择器服务) 是 Orion 平台的智能测试选择引擎，基于代码变更分析、测试依赖图、失败预测等技术，智能选择最小测试集以验证变更。

## 2. 代码位置

```
orion-platform-service/src/services/test-selector/
├── TestDependencyAnalyzer.ts     # 测试依赖分析
├── TestExecutionOptimizer.ts     # 测试执行优化
├── TestFailurePredictor.ts       # 测试失败预测
├── TestImpactAnalyzer.ts         # 影响分析
├── TestSelectorService.ts        # 主服务
├── types.ts                      # 类型定义
└── index.ts                      # 模块导出
```

## 3. 核心功能

### 3.1 TestDependencyAnalyzer

| 功能 | 说明 | 状态 |
|------|------|------|
| buildDependencyGraph() | 构建测试依赖图 | ✅ 已实现 |
| findDependentTests() | 查找依赖测试 | ✅ 已实现 |
| findAffectedModules() | 查找受影响模块 | ✅ 已实现 |
| getTestCoverage() | 获取测试覆盖率 | ✅ 已实现 |

**依赖分析策略**:
- 基于 import 语句分析
- 基于文件路径匹配
- 基于测试注解 (@Test, describe)

### 3.2 TestExecutionOptimizer

| 功能 | 说明 |
|------|------|
| optimizeExecutionOrder() | 优化执行顺序 |
| parallelizeTests() | 并行化测试 |
| splitTestSuites() | 拆分测试套件 |
| estimateExecutionTime() | 预估执行时间 |

**优化策略**:
- 快速失败优先 (Fast Failure First)
- 资源感知调度
- 历史执行时间加权

### 3.3 TestFailurePredictor

| 功能 | 说明 |
|------|------|
| predictFailure() | 预测测试失败 |
| analyzeChangeImpact() | 分析变更影响 |
| getRiskyTests() | 获取高风险测试 |
| trainModel() | 训练预测模型 |

**预测算法**:
- 基于历史失败率
- 基于变更类型 (新增/修改/删除)
- 基于代码复杂度

### 3.4 TestImpactAnalyzer

| 功能 | 说明 |
|------|------|
| analyzeImpact() | 分析影响范围 |
| getChangedFiles() | 获取变更文件 |
| traceExecution() | 追踪执行路径 |
| categorizeTests() | 分类测试 |

## 4. 数据模型

```typescript
interface TestCase {
  id: string;
  name: string;
  path: string;
  module: string;
  dependencies: string[];
  executionTime: number;      // 历史平均执行时间
  failureRate: number;        // 历史失败率
  lastRunTime?: Date;
  lastResult?: 'pass' | 'fail';
}

interface TestSelectionRequest {
  changedFiles: string[];
  baseCommit: string;
  headCommit: string;
  strategy: 'minimal' | 'regression' | 'full';
  maxExecutionTime?: number;
}

interface TestSelectionResult {
  selectedTests: TestCase[];
  excludedTests: TestCase[];
  executionOrder: string[];
  estimatedTime: number;
  coverage: number;
}
```

## 5. API 路由

- 路由文件: `test-selector-routes.ts`
- 前端 API: 无 (缺失)
- 需补充前端客户端

## 6. 已知问题

- ⚠️ 数据存储使用 `Map()` 内存模拟
- ⚠️ 无前端 API 客户端
- ⚠️ ML 预测模型为 Mock 实现
- ⚠️ 需与 M14 构建环境深度集成

## 7. 后续计划

- [ ] 补充前端 API 客户端
- [ ] 集成真实 ML 模型
- [ ] 添加测试历史分析
- [ ] 与 CI/CD 流水线集成