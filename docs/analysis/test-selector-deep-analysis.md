# Test Selector 模块深度分析

**生成日期**: 2026-07-03  
**分析范围**: `orion-platform-service/src/services/test-selector/` + `src/api/test-selector-routes.ts`  
**路由前缀**: `/api/v1/test-selector`  

---

## 一、现状概述

### 模块定位

智能测试选择器（Intelligent Test Selector），用于在 CI/CD 流程中智能选择需要执行的测试用例。核心能力包括：
1. **测试依赖分析** — 解析测试文件与源代码的依赖关系（通过 import 语句）
2. **影响分析** — 根据代码变更评估哪些测试受到影响
3. **失败预测** — 基于历史数据预测哪些测试容易失败
4. **执行优化** — 分组并行、fail-fast 排序、时间预算裁剪

### 文件结构

```
services/test-selector/
├── __tests__/
│   ├── index.test.ts
│   ├── TestDependencyAnalyzer.test.ts
│   ├── TestExecutionOptimizer.test.ts
│   ├── TestFailurePredictor.test.ts
│   ├── TestImpactAnalyzer.test.ts
│   ├── TestSelectorService.test.ts
│   └── types.test.ts
├── index.ts                           # 统一导出
├── types.ts                           # 类型定义 (~253 行)
├── TestDependencyAnalyzer.ts          # 测试依赖分析器 (~542 行)
├── TestExecutionOptimizer.ts          # 执行优化器 (~388 行)
├── TestFailurePredictor.ts            # 失败预测器 (~380 行)
├── TestImpactAnalyzer.ts              # 影响分析器 (~292 行)
└── TestSelectorService.ts             # 主编排服务 (~346 行)

api/test-selector-routes.ts           # 路由定义 (~416 行)
```

### 核心数据模型

| 类型 | 用途 |
|------|------|
| `TestSuite` | 测试套件（测试文件，如 `*.test.ts`） |
| `TestCase` | 单个测试用例（describe/it 块） |
| `TestDependency` | 测试到源码的依赖关系 |
| `TestImpact` | 变更对测试的影响分析 |
| `TestExecutionPlan` | 执行计划（选中/跳过的测试 + 分组） |
| `TestFailurePrediction` | 失败概率预测 |
| `TestGroup` | 并行执行分组 |
| `PRChange` | PR 变更信息 |

### 持久化方式

所有数据通过 PostgreSQL Repository 模式持久化：

| Repository | 用途 |
|-----------|------|
| `TestSuiteDependencyRepository` | 测试套件依赖数据 |
| `TestCaseDependencyRepository` | 测试用例依赖数据 |
| `TestCodeMappingDependencyRepository` | 测试-源码映射数据 |
| `TestExecutionHistoryDependencyRepository` | 执行历史记录 |
| `PRTestResultDependencyRepository` | PR 测试结果 |
| `TestSuiteRepository` | 套件管理（路由中独立使用） |
| `TestCaseRepository` | 用例管理（路由中独立使用） |

---

## 二、功能矩阵

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 测试文件扫描 | ✅ 完整 | 递归遍历目录，匹配 `.test.` 模式 |
| import 语句解析 | ✅ 完整 | ES6 import + require 两种语法 |
| 测试到源码映射 | ✅ 完整 | 基于 import 路径解析 + 命名约定推断 |
| 测试用例数量统计 | ✅ 完整 | 正则匹配 it/test 函数 |
| 变更影响分析 | ✅ 完整 | 基于文件类型/变更行数/测试数量评分 |
| 影响评分公式 | ✅ 完整 | 四维加权（变更类型+行数+数量+文件类型） |
| 执行计划生成 | ✅ 完整 | 选中/跳过 + 分组 + 排序 |
| Fail-fast 排序 | ✅ 完整 | 优先级→失败概率→执行时间 |
| 并行分组算法 | ✅ 完整 | 最佳适配（Best-Fit）负载均衡 |
| 时间预算裁剪 | ✅ 完整 | 超时测试自动跳过 |
| 测试失败预测 | ✅ 完整 | 基于历史率+连续失败+抖动评分+波动趋势 |
| 抖动测试检测 | ✅ 完整 | 交替模式检测 + 通过率 50%-95% |
| 历史数据清理 | ✅ 完整 | 按保留天数自动清理 |
| PR 事件集成（可选的 EventBus） | ⚠️ 部分实现 | 订阅 `code.pr.opened` 事件，但事件处理未实现完整逻辑 |
| 测试执行结果记录 | ✅ 完整 | 更新历史数据改改进预测模型 |

---

## 三、API 端点

| 方法 | 路径 | 说明 | ACL |
|------|------|------|-----|
| POST | `/api/v1/test-selector/select` | 为 PR 选择测试 | test:write |
| GET | `/api/v1/test-selector/plan/:planId` | 获取测试计划 | test:read |
| GET | `/api/v1/test-selector/pr/:prId` | 获取 PR 测试结果 | test:read |
| GET | `/api/v1/test-selector/history/:testId` | 测试历史统计 | test:read |
| GET | `/api/v1/test-selector/history` | 全部测试历史汇总 | test:read |
| POST | `/api/v1/test-selector/record` | 记录执行结果 | test:write |
| GET | `/api/v1/test-selector/flaky` | 抖动测试列表 | test:read |
| GET | `/api/v1/test-selector/coverage` | 测试覆盖率统计 | test:read |
| GET | `/api/v1/test-selector/suites` | 测试套件列表 | test:read |
| GET | `/api/v1/test-selector/cases` | 测试用例列表 | test:read |
| POST | `/api/v1/test-selector/reanalyze` | 重新分析依赖 | test:write |

---

## 四、依赖关系

| 依赖 | 类型 | 说明 |
|------|------|------|
| `TestDependencyAnalyzer` | 内部依赖 | 文件扫描 + import 解析 |
| `TestImpactAnalyzer` | 内部依赖 | 变更影响评估 |
| `TestExecutionOptimizer` | 内部依赖 | 执行策略优化 |
| `TestFailurePredictor` | 内部依赖 | 历史数据 + 失败预测 |
| `EventBusService` | 外部可选 | PR 事件订阅 |
| `fs` / `path` | Node.js 内置 | 文件系统扫描与路径解析 |

---

## 五、风险与改进建议

| 风险 | 级别 | 建议 |
|------|------|------|
| **`TestExecutionOptimizer` 通过 `private` 属性访问 `dependencyAnalyzer`**（`this.impactAnalyzer['dependencyAnalyzer']`） | P1 | 添加公有方法或注入依赖，避免 `private` 属性访问 |
| **`analyzeSingleTestFile` 使用同步 `fs.readFileSync`** | P1 | 替换为异步 `fs.promises.readFile`，避免事件循环阻塞 |
| **测试文件扫描使用 `fs.readdirSync` 递归** | P1 | 替换为异步递归或使用 `fast-glob` 包 |
| **依赖分析基于命名约定推断**，如果源码文件名与测试文件名不同则无法匹配 | P2 | 补充基于 import 语句的精确匹配作为主要手段，命名约定作为 fallback |
| **`analyzeImpactForFiles` 仅通过反向索引匹配**，未分析多级传递影响 | P2 | 增加传递影响分析（A→B→C 的间接依赖） |
| **缺少种子默认策略配置**，新用户首次使用无法选择测试 | P2 | 添加默认配置，让新场景能立即使用 |
| **事件订阅处理 `code.pr.opened` 但无文件变更数据** | P2 | 补充从 PR 事件中提取 changedFiles 的逻辑 |

---

## 六、总结

Test Selector 是 Orion 中架构最成熟的模块之一，完整实现了"依赖分析→影响分析→失败预测→执行优化"的端到端流水线。代码质量高，类型定义完善（7 个类型文件），测试覆盖全面（7 个测试文件），数据库 Repository 模式统一，5 个 Repository 覆盖所有数据实体。

**亮点**：
1. 四层架构清晰：Analyzer → ImpactAnalyzer → FailurePredictor → Optimizer
2. `TestFailurePredictor` 的抖动检测算法较完善（交替模式 + 通过率区间）
3. `TestExecutionOptimizer` 的 Best-Fit 负载均衡分组算法
4. 完整的 PR 测试结果持久化（`PRTestResultDependencyRepository`）

**主要问题**：
1. `Optimizer` 访问 `Analyzer` 使用了不安全的 `private` 属性绕过
2. 文件操作为同步 API，在大项目中有性能风险
3. 传递依赖分析缺失

**评分**: 8/10 — 架构和算法优秀（9分），但同步文件 IO 和私有属性访问是明显缺陷（7分）。
