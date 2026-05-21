---
name: design-constraint
description: 自动执行设计约束体系检查，支持 14 维 196 项检查项。无参数调用时自动识别当前模块。
category: quality
---

# Design Constraint Skill

## 触发条件

- `/skill design-constraint:check`
- `/skill design-constraint:scan`
- 用户提到"设计约束检查"、"完整性检查"、"交互审查"

## 调用方式

```bash
# 无参数 → 自动全量检查
/skill design-constraint:check

# 指定模块
/skill design-constraint:check --module pipeline

# 强制指定类型
/skill design-constraint:check --type frontend

# 全量扫描
/skill design-constraint:check --scan-mode full

# 增量扫描（仅检查变更）
/skill design-constraint:check --scan-mode changed

# 跳过某层
/skill design-constraint:check --skip verification

# 覆盖自动识别
/skill design-constraint:check --override frontend
```

## 执行流程

1. 加载 `framework/core/detector.ts` 识别当前上下文
2. 加载对应 profiles 配置
3. 执行 `framework/core/checker.ts` 检查
4. 生成 `framework/core/reporter.ts` 报告
5. 输出结果

## 14 维体系

| 层级 | 维度 | 检查项 |
|------|------|--------|
| **A. 设计** | A1 数据结构 (14) + A2 交互逻辑 (15) + A3 流程细节 (16) | 45 |
| **B. 开发** | B1 修复规范 (12) + B2 优化规范 (15) | 27 |
| **C. 运维** | C1-C8 (兼容性/扩展性/生态/可观测/灾备/容量/部署/自动化) | 58 |
| **D. 体验** | D1-D5 (可用性/可访问性/一致性/性能感知/情感化) | 35+ |
| **S. 安全** | S1-S5 (身份认证/数据安全/基础设施/审计/第三方) | 25+ |
| **合计** | **14 维** | **~196 项** |

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

### 检查结果报告
```
┌────────────────────────────────────────────────────────────┐
│  Design Constraint Check Report                            │
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
│    ✗ A2-12: 异步操作有 loading 状态                         │
│    ✗ A2-14: 空数据有引导                                   │
├────────────────────────────────────────────────────────────┤
│  Next Steps:                                               │
│    [P0] 为 Button 组件添加 loading 状态                    │
│    [P0] 为列表添加 Empty + 引导按钮                         │
└────────────────────────────────────────────────────────────┘
```

## 配置覆盖

用户可以通过 `--override` 参数覆盖自动识别结果：

```bash
/skill design-constraint:check --type frontend --module artifact
```

## 示例使用场景

1. **开发新功能后检查**
   ```
   /skill design-constraint:check
   ```

2. **批量扫描某个模块**
   ```
   /skill design-constraint:check --module pipeline --scan-mode full
   ```

3. **只检查前端交互**
   ```
   /skill design-constraint:check --type frontend
   ```

4. **查看当前模块的检查项**
   ```
   /skill design-constraint:check --list-profiles
   ```