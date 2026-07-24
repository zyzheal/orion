---
name: design-constraint
description: Use when user wants to check code quality, fix issues, or recheck after changes. Single entry point that auto-detects intent: "评审"→check, "修复"→fix, "复查"→recheck. Routes to three AI skills for deep analysis and fix generation.
category: quality
---

# Design Constraint Skill

## 定位

**一个技能，三阶段自动流转。** 用户只需说自然语言指令，不需要记参数。

```
评审 xxx  →  扫描出报告  →  引导"要修复吗?"
    ↓
修复      →  生成完整方案  →  引导"按方案实施"
    ↓
复查      →  验证是否清零  →  输出提升幅度
```

## 触发方式（自然语言）

### 按执行对象分类

| 用户说 | 执行对象 | 实际执行内容 | 输出 |
|:---|:---|:---|:---|
| **评审 xxx 文档** | 📄 文档 | 检查设计文档是否包含交互流程、API定义、运维手册 | 文档缺失清单 |
| **评审 xxx 代码** | 💻 代码 | AST扫描前端交互 + 检查后端规范 | 代码违规清单 |
| **评审全部** | 📄+💻 两者 | 196项全量扫描（文档+代码） | 总Score + 分项Score |
| **检查前端** | 💻 前端代码 | 15项AST交互检测 | 前端违规清单 |
| **检查后端** | 💻 后端代码 | 检查日志/错误码/租户隔离 | 后端违规清单 |
| **修复文档** | 📄 文档 | 生成文档级内容补全（交互流程、API规格） | Markdown文本 |
| **修复代码** | 💻 代码 | 生成代码Patch（Token替换、错误处理） | 代码修改建议 |
| **修复** | 📄+💻 两者 | 三技能并行生成完整修复方案 | 交互规格+Patch+子任务表 |
| **修复 P0** | 📄+💻 两者 | 仅修复P0级别问题 | 同上（仅P0） |
| **复查** | 📄+💻 两者 | git diff 扫描变更文件，验证修复结果 | Score提升幅度 |

### 执行对象判断逻辑

```
用户指令关键词 → 自动识别执行对象：

包含"文档" → 📄 仅检查/修复文档
包含"代码" → 💻 仅检查/修复代码
包含"前端" → 💻 前端代码
包含"后端" → 💻 后端代码
其他/默认   → 📄+💻 文档+代码全量
```

### 触发词列表

**检查阶段**：评审、检查、扫描、检查质量、完整性检查、交互审查
**修复阶段**：修复、修补、改进、优化这些问题、生成修复方案
**复查阶段**：复查、再看一遍、验证修复、check again

## 实际执行示例

### 示例 1：仅检查文档
```
用户: 评审子应用文档
  → 📄 检查 docs/architecture/子应用接入设计.md
  → 输出: 文档缺失清单（缺交互流程、缺运维手册）
  → 引导: "💡 回复'修复文档'生成文档级补全方案"
```

### 示例 2：仅检查代码
```
用户: 评审子应用代码
  → 💻 扫描 orion-frontend/src/pages/SubApps/ + orion-platform-service/src/services/subapp/
  → AST扫描前端 + 检查后端规范
  → 输出: 代码违规清单（硬编码色值、缺loading状态）
  → 引导: "💡 回复'修复代码'生成代码Patch"
```

### 示例 3：文档+代码全量扫描
```
用户: 评审子应用模块
  → 📄+💻 同时扫描文档和代码
  → 输出: 总Score 68/100（文档72 + 代码55）
  → 引导: "💡 回复'修复'生成完整修复方案"
```

### 示例 4：仅修复文档
```
用户: 修复文档
  → 📄 design-doc-reviewer 生成文档级补全方案
  → 输出: 交互流程10步 + API规格 + 运维手册（Markdown文本）
  → 引导: "📋 将方案复制到设计文档中，完成后回复'复查'"
```

### 示例 5：仅修复代码
```
用户: 修复代码
  → 💻 code-design-analyzer 生成代码Patch
  → 输出: Token替换映射 + 错误处理代码（具体代码修改建议）
  → 引导: "📋 按Patch修改代码，完成后回复'复查'"
```

### 示例 6：文档+代码全量修复
```
用户: 修复
  → 📄+💻 三技能并行：
     → design-doc-reviewer 输出文档规格
     → code-design-analyzer 输出代码Patch
     → task-decomposer 输出子任务表
  → 输出: 完整修复方案
  → 引导: "📋 按方案实施后回复'复查'验证"
```

### 示例 7：复查
```
用户: 复查
  → 📄+💻 git diff 扫描变更文件，仅检查修改过的文件
  → 对比上次 Score
  → 输出: Score 71 → 92 (+21) → "✅ 复查完成"
```

## 完整调用方式

```bash
# 简单模式：自然语言（推荐）
评审子应用模块
修复这些问题
复查一下

# 高级模式：带参数
/skill design-constraint:check --module pipeline --scan-mode full
/skill design-constraint:fix --level P0 --dimension A2
/skill design-constraint:check --scan-mode changed
```

## 执行流程（自动三阶段）

```
用户: 评审子应用模块
  → Stage 1: 扫描 (check)
  → 输出: Score 71/100, 12项违规
  → 引导: "💡 要修复这些问题吗？回复'修复'即可自动生成完整方案"

用户: 修复
  → Stage 2: 修复 (fix)
  → 输出: 交互规格 + Token映射 + 子任务表
  → 引导: "📋 修复方案已生成，按方案实施后回复'复查'验证"

用户: 复查
  → Stage 3: 复查 (recheck)
  → 输出: Score 从 71→92 (+21)
  → 引导: "✅ 复查完成，分数提升 21 分"
```

### 底层实现

1. 加载 `framework/core/detector.ts` 识别上下文 + 用户意图
2. 加载对应 profiles 配置
3. 执行 `framework/core/checker.ts`（mode 自动选择）
   - `ast` → AST 解析器
   - `ai` → 路由到 AI 技能（检查模式返回违规清单，修复模式返回完整方案）
   - 降级 → `warning` 状态
4. 生成 `framework/core/reporter.ts` 报告（含下一步引导）

## AI 引擎路由机制

`checker.ts` 中的 `runAICheck()` 函数自动路由：

```typescript
// A 设计层 → design-doc-reviewer
// B 开发层 → code-design-analyzer
// C 运维层 → code-design-analyzer
// D 体验层 → task-decomposer
// S 安全层 → code-design-analyzer
```

## 14 维体系

| 层级 | 维度 | 检查项 | AI 路由 |
|------|------|--------|---------|
| **A. 设计** | A1-A3 (数据结构/交互/流程) | 45 | design-doc-reviewer |
| **B. 开发** | B1-B2 (修复/优化规范) | 27 | code-design-analyzer |
| **C. 运维** | C1-C8 (兼容/扩展/生态/可观测/灾备/容量/部署/自动化) | 58 | code-design-analyzer |
| **D. 体验** | D1-D5 (可用/可访问/一致/性能/情感) | 35 | task-decomposer |
| **S. 安全** | S1-S5 (认证/数据/基础设施/审计/第三方) | 25 | code-design-analyzer |
| **合计** | **14 维** | **~196 项** | |

## 输出格式

### 自动识别结果
```
┌────────────────────────────────────────────────────────────┐
│  Auto-Detection Results                                    │
├────────────────────────────────────────────────────────────┤
│  Code Type:      {frontend/backend/fullstack}              │
│  Module:         {module_name}                             │
│  Profiles:       {count} loaded                            │
│  Total Checks:   {total}                                   │
└────────────────────────────────────────────────────────────┘
```

### 检查结果报告（AI 增强版）
```
┌────────────────────────────────────────────────────────────┐
│  Design Constraint Check Report (AI Enhanced)              │
├────────────────────────────────────────────────────────────┤
│  Module:         pipeline-svc                              │
│  Code Type:      frontend                                  │
│  Total Checks:   45                                        │
│  Pass:           32                                        │
│  Fail:           5                                         │
│  Warning:        8                                         │
│  Score:          71/100                                    │
├────────────────────────────────────────────────────────────┤
│  [P0] Issues                                               │
│    ✗ A2-02: 操作后有明确反馈                                │
│       → AI修复: 在 handleSubmit 中补充 message.success()    │
│    ✗ A2-12: 异步操作有 loading 状态                         │
│       → AI修复: 按钮添加 loading={submitting} 属性           │
│    ✗ A2-14: 空数据有引导                                   │
│       → AI修复: 添加 <Empty> 组件 + 创建引导按钮             │
├────────────────────────────────────────────────────────────┤
│  [AI Generated Fix Specs]                                  │
│    A2-02: 组件交互规格 (task-decomposer)                    │
│      → 5步交互链 + 组件五态 + Token 清单                    │
│    A2-14: 交互细节补全 (design-doc-reviewer)                │
│      → 空状态布局 + 引导按钮样式 + spacing Token            │
├────────────────────────────────────────────────────────────┤
│  Next Steps:                                               │
│    [P0] 为 Button 组件添加 loading 状态                    │
│    [P0] 为列表添加 Empty + 引导按钮                         │
│    [AI] 已生成完整修复方案，可直接执行                       │
└────────────────────────────────────────────────────────────┘
```

## 配置覆盖

用户可以通过 `--override` 参数覆盖自动识别结果：

```bash
/skill design-constraint:check --type frontend --module artifact
```

## 输出格式

### 检查报告（Stage 1）
```
┌────────────────────────────────────────────────────────────┐
│  Design Constraint Check Report (AI Enhanced)              │
├────────────────────────────────────────────────────────────┤
│  Module:         pipeline-svc                              │
│  Code Type:      frontend                                  │
│  Total Checks:   45                                        │
│  Pass:           32                                        │
│  Fail:           5                                         │
│  Warning:        8                                         │
│  Score:          71/100                                    │
├────────────────────────────────────────────────────────────┤
│  [P0] Issues                                               │
│    ✗ A2-02: 操作后有明确反馈                                │
│      → AI修复: 在 handleSubmit 中补充 message.success()    │
│    ✗ A2-12: 异步操作有 loading 状态                         │
│      → AI修复: 按钮添加 loading={submitting} 属性           │
├────────────────────────────────────────────────────────────┤
│  [Next Steps]                                              │
│  💡 回复"修复"触发 AI 修复引擎                              │
│     → 三技能并行生成交互规格 + Token 映射 + 子任务表        │
│  复查: 回复"复查"验证修复结果                               │
└────────────────────────────────────────────────────────────┘
```

### 修复方案（Stage 2）
由三个 AI 技能并行输出：交互规格 + Token 映射 + 子任务表 + 验证用例。

### 复查报告（Stage 3）
```
Score: 71 → 92 (+21) | 新增通过: 10 项 | 仍失败: 2 项
```