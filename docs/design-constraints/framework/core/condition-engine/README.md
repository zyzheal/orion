# 条件表达式引擎设计方案

> **版本**: v1.0  
> **日期**: 2026-07-24  
> **作者**: 架构设计 Agent  
> **状态**: 设计完成 + 代码实现

---

## 1. 背景与目标

### 1.1 背景

- **NeatLogic 标杆**: `IConditionHandler` + `ConditionGroupBaseVo` + `ConditionConfigVo`
- **现有代码问题**: 现有规则引擎（rule-engine）条件处理过于简单（字符串拼接），不具备可组合的 AND/OR 条件组能力
- **多模块需求**: 审批流条件、告警规则、自动派单、SLA 策略都需要统一的条件表达式引擎

### 1.2 设计目标

1. 支持 `Condition` 原子条件 + `ConditionGroup` AND/OR 组合
2. 支持声明式 DSL（JSON）描述条件规则
3. 支持常用条件类型（比较、范围、字符串、时间）
4. 支持自定义函数扩展
5. 纯 Go 实现，无外部依赖，高性能

---

## 2. 架构设计

### 2.1 整体架构

```
┌──────────────────────────────────────────────────────────────────┐
│                      Condition Engine                             │
│                                                                    │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────────┐   │
│  │  DSL 解析器   │───▶│ AST 构建器    │───▶│  Condition Engine │   │
│  │  (JSON → AST)│    │ (Condition)   │    │  (Evaluate)       │   │
│  └──────────────┘    └──────────────┘    └───────────────────┘   │
│         │                   │                     │               │
│         ▼                   ▼                     ▼               │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────────┐   │
│  │  验证器        │    │  调试器        │    │  函数注册表         │   │
│  │ (Validate)    │    │ (Inspect)     │    │  (FunctionMap)   │   │
│  └──────────────┘    └──────────────┘    └───────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 核心类型

```
Condition           // 原子条件
  ├── FieldPath     // 字段路径 (支持嵌套: alert.severity)
  ├── Operator      // 运算符 (==, !=, >, <, >=, <=, in, not_in, contains, regex, between)
  └── Values        // 期望值

ConditionGroup      // 条件组
  ├── Operator      // 组合方式 (AND, OR)
  └── Conditions    // 子条件列表 (Condition | ConditionGroup)

ConditionEngine     // 执行引擎
  ├── Compile(DSL)   // JSON → AST
  ├── Validate()    // 结构校验
  └── Evaluate(ctx, data)  // 执行评估
```

---

## 3. DSL 定义

### 3.1 JSON DSL 格式

```json
{
  "operator": "AND",
  "conditions": [
    {
      "field": "alert.severity",
      "operator": "in",
      "values": ["P0", "P1"]
    },
    {
      "operator": "OR",
      "conditions": [
        {
          "field": "alert.status",
          "operator": "==",
          "values": ["open"]
        },
        {
          "field": "alert.duration_minutes",
          "operator": ">",
          "values": [30]
        }
      ]
    }
  ]
}
```

### 3.2 支持的运算符

| 运算符 | 类型 | 说明 |
|--------|------|------|
| `==` / `eq` | 比较 | 精确相等 |
| `!=` / `neq` | 比较 | 不等于 |
| `>` / `gt` | 比较 | 大于 |
| `<` / `lt` | 比较 | 小于 |
| `>=` / `gte` | 比较 | 大于等于 |
| `<=` / `lte` | 比较 | 小于等于 |
| `in` | 集合 | 值在列表中 |
| `not_in` / `nin` | 集合 | 值不在列表中 |
| `between` | 范围 | 值在两个值之间 (values: [min, max]) |
| `contains` | 字符串 | 字符串包含 |
| `not_contains` | 字符串 | 字符串不包含 |
| `starts_with` | 字符串 | 字符串前缀 |
| `ends_with` | 字符串 | 字符串后缀 |
| `regex` | 字符串 | 正则匹配 |
| `is_null` | 空值 | 值为空/缺失 |
| `is_not_null` | 空值 | 值不为空 |
| `func` | 函数 | 自定义函数调用 |

---

## 4. NeatLogic 对比

| 维度 | NeatLogic | Orion |
|------|-----------|-------|
| 数据结构 | `ConditionConfigVo` (三层: config→group→condition) | 扁平 JSON AST |
| 运算符 | `equal/like/greater/less` (4 种) | 16+ 种运算符 |
| 组合方式 | 固定 AND 内、OR 间 | 任意嵌套 AND/OR |
| 评估方式 | `JavascriptUtil.runScript()` | 纯 Go 评估器 |
| 字段支持 | 扁平字段 | 支持嵌套字段路径 |
| 扩展性 | `IConditionHandler` SPI | 函数注册表 |
| 执行环境 | 沙箱 JS | 无沙箱，纯 Go |

**Orion 优势**:
1. 无需 JS 沙箱，性能更好
2. 声明式 DSL，前端可直接操作
3. 任意嵌套深度
4. 零外部依赖

---

## 5. 使用场景

### 5.1 审批流条件

```json
{
  "operator": "AND",
  "conditions": [
    {"field": "ticket.amount", "operator": ">", "values": [10000]},
    {"field": "applicant.department", "operator": "not_in", "values": ["finance"]}
  ]
}
```

### 5.2 告警规则条件

```json
{
  "operator": "OR",
  "conditions": [
    {"field": "metric.cpu", "operator": ">", "values": [90]},
    {"field": "metric.memory", "operator": ">", "values": [85]}
  ]
}
```

### 5.3 自动派单条件

```json
{
  "operator": "AND",
  "conditions": [
    {"field": "ticket.type", "operator": "==", "values": ["incident"]},
    {"field": "ticket.priority", "operator": "between", "values": [1, 2]},
    {"field": "ticket.tags", "operator": "contains", "values": ["network"]}
  ]
}
```

---

## 6. 实现文件清单

```
orion-go-common/pkg/condition/
├── condition.go      # Condition / ConditionGroup 数据结构
├── engine.go         # ConditionEngine 执行引擎
├── parser.go         # DSL JSON 解析器
├── evaluator.go      # 运算符评估器
├── validator.go      # DSL 结构验证器
├── function.go       # 自定义函数注册表
└── *_test.go         # 测试文件

docs/design-constraints/framework/core/condition-engine/
├── README.md         # 本设计方案
```

---

## 7. 后续工作

1. 集成到审批流、告警规则、自动派单模块
2. 增加单元测试覆盖
3. 增加 DSL 编辑器前端组件
