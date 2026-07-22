# 归档目录说明

| 归档项 | 原始路径 | 归档时间 | 原因 | 内容 |
|--------|---------|---------|------|------|
| orion-platform-service (TS) | /Users/heal/orion-platform-service | 2026-07-22 | 已废弃，Go 版本为唯一生产版本 | 4 TS 文件 + 1 SQL 迁移（disaster-recovery） |

## 迁移记录

TS `orion-platform-service` → Go `orion-platform-svc-go` 已在 Phase 5 完成。
- 生产部署：Go 单体（225 模块, 455 迁移文件）
- TS 版本：仅余 4 个孤儿文件，已归档至此
