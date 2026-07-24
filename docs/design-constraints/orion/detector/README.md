# Orion 识别规则

## 添加新模块

1. 在 `rules.ts` 中添加 `ORION_DETECTION_RULES` 条目
2. 在 `profiles/` 下创建 `{module}.json`
3. 提交 PR

## 规则格式

```typescript
{
  name: '模块名',
  pattern: /匹配路径的正则/,
  type: 'frontend' | 'backend' | 'fullstack',
  module: 'profile 文件名（不含 .json）',
}
```

## 已支持的模块

- pipeline (流水线)
- artifact (制品管理)
- monitor (监控)
- ai (AI 服务)
- platform (平台服务)
- frontend (前端通用)