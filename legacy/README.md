# Legacy Code (Archived)

> **状态**: 已归档，不再维护。所有活跃开发已迁移至 Go 版本。

| Project | Language | Archived | Migration Target | Status |
|---------|----------|----------|------------------|--------|
| `orion-api-gateway-ts/` | TypeScript | 2026-09-25 | `orion-api-gateway-go/` | ✅ 完整迁移完成 |
| `orion-platform-service-ts/` | TypeScript | 2026-07-16 | `orion-platform-svc-go/` | ✅ 完整迁移完成 |

## 迁移摘要

- **API Gateway**: 24,986 TS 行 → 7,783 Go 行（33 Go 文件，81 测试用例）
- **Platform Service**: 已迁移至 `orion-platform-svc-go/`

## 注意事项

1. 这些目录仅保留用于历史参考，**不要在生产环境中使用**
2. 不要修改或添加代码到这些目录
3. 未来版本可考虑完全删除这些目录以减小仓库体积
4. CI 流水线不会构建或测试这些目录
5. 不在 `go.work` 中引用这些模块
