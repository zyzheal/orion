---
name: design-constraint:quick
description: 快速设计约束分析，3秒内输出结果。聚焦高频问题，提供即时反馈。适合智能体开发过程中快速检查。
category: quality
---

# Design Constraint Quick Analysis Skill

## 触发条件

- `/skill design-constraint:quick`
- `/skill dc:quick`
- 用户提到"快速检查"、"即时分析"、"开发时检查"

## 快速分析流程 (3秒内完成)

```
1. 读取当前文件 (5行内)
2. 执行 8 项高频检测
3. 输出结果 + 修复建议
```

## 8 项高频检测 (P0 优先)

| 检测项 | ID | 问题 | 修复建议 |
|--------|-----|------|----------|
| 缺少 loading | A2-12 | 异步操作无 loading | 添加 `const [loading, setLoading] = useState(false)` |
| 缺少反馈 | A2-02 | 操作后无 message | 添加 `message.success/error` |
| 缺少空状态 | A2-14 | 列表无 Empty | 添加 `<Empty description="暂无数据" />` |
| 危险操作确认 | A3-16 | 删除无确认 | 添加 `<Popconfirm>` 包裹 |
| 硬编码颜色 | D3-01 | 使用 #3370E6 | 改用 `colors.primary[500]` |
| any 类型 | A1-06 | `as any` / `: any` | 添加具体类型定义 |
| 敏感信息 | B1-07 | 日志含 password/token | 使用 `***` 脱敏 |
| 缺少 key | A1-06 | map 无 key | 添加 `key={item.id}` |

## 输出格式

```
┌────────────────────────────────────────────────────────────┐
│  Quick Analysis Result                                     │
├────────────────────────────────────────────────────────────┤
│  File:     src/pages/Pipeline/List.tsx                     │
│  Issues:   3 个 (P0: 2, P1: 1)                             │
├────────────────────────────────────────────────────────────┤
│  [P0] A2-12 异步操作缺少 loading 状态                       │
│        Line 45: handleSearch                               │
│        Fix: 添加 loading state 并在请求时设置 true         │
├────────────────────────────────────────────────────────────┤
│  [P0] A3-16 删除操作缺少二次确认                            │
│        Line 78: <Button onClick={handleDelete}>            │
│        Fix: 包裹 <Popconfirm title="确认删除?">           │
├────────────────────────────────────────────────────────────┤
│  [P1] D3-01 使用硬编码颜色                                  │
│        Line 23: style={{ color: '#3370E6' }}               │
│        Fix: 改用 import { colors } from '@/tokens'        │
└────────────────────────────────────────────────────────────┘
```

## 使用方式

```bash
# 分析当前文件
/skill design-constraint:quick

# 分析指定文件
/skill design-constraint:quick --file src/pages/Agent/List.tsx

# 分析多个文件
/skill design-constraint:quick --dir src/pages/Pipeline/
```

## 智能体调用示例

```typescript
// 智能体开发时快速检查
async function quickCheck(filePath: string) {
  // 1. 读取文件前 100 行
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n').slice(0, 100);

  // 2. 高频问题检测 (正则匹配)
  const issues = [
    // A2-12: loading 状态
    ...lines.filter(l => /async\s+\w+\s*\(/.test(l) && !/loading/.test(l)),
    // A2-02: message 反馈
    ...lines.filter(l => /await\s+\w+\.(get|post|put)/.test(l) && !/message\./.test(l)),
    // A3-16: 危险操作确认
    ...lines.filter(l => /delete|remove|销毁/.test(l) && !/<Popconfirm|Modal\.confirm/.test(l)),
    // D3-01: 硬编码颜色
    ...lines.filter(l => /#[0-9a-fA-F]{6}/.test(l) && !/colors\./.test(l)),
    // A1-06: any 类型
    ...lines.filter(l => /:\s*any\b|as\s+any\b/.test(l)),
  ];

  // 3. 输出结果
  return formatQuickResult(issues);
}
```

## 修复建议模板

每个问题提供:
1. **问题描述** - 什么错了
2. **问题位置** - 文件和行号
3. **修复代码** - 直接可用的代码片段

```
[P0] {检测项}
  问题: {描述}
  位置: {file}:{line}
  修复:
  ```typescript
  {修复代码}
  ```
```

## 快速检查清单 (开发时必做)

- [ ] 异步操作有 `loading` 状态
- [ ] 操作后有 `message.success/error` 提示
- [ ] 列表有空状态 `<Empty>`
- [ ] 删除按钮有 `<Popconfirm>`
- [ ] 颜色使用 Design Token
- [ ] 无 `as any` 类型断言
- [ ] 日志无敏感信息
- [ ] map 渲染有 `key`