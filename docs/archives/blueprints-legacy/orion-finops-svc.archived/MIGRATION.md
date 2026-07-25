# orion-finops-svc → orion-finops-svc-go 迁移记录

> **迁移日期**: 2026-07-24
> **迁移类型**: TS→Go 归档（Go 已覆盖全部功能）

## 源服务
- **名称**: orion-finops-svc
- **TS 文件数**: 25
- **状态**: 已归档 ✅

## 目标服务
- **名称**: orion-finops-svc-go
- **Go 文件数**: 71
- **覆盖域**: finops, finops-v2, cost, cost-allocation, billing, bi-dashboard, efficiency, report-designer

## 功能对照
| TS 路由 | Go Handler | 状态 |
|---------|-----------|------|
| 全部路由 | 对应 handler | ✅ 已覆盖 |

## 注意事项
- Go 版在 handler/service/repository/models 四层架构上更完整
- 统一使用 response_writer.go 响应格式
- 统一使用 NATS 订阅器
- 统一使用 config 包管理配置
