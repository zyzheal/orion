# Plan 14 — Swagger/OpenAPI 自动生成

> **状态**: 已合并到 [plan-38-swagger-gen/](../plan-38-swagger-gen/)
>
> 本方案的设计内容已由 plan-38 覆盖。

## 本地代码扫描结果

- **本地模块**: 无 swaggo 集成，无 Swagger UI
- **缺口**: 无 API 文档自动生成管线
- **合并方向**: plan-38-swagger-gen/ 包含 Makefile 生成 + redocly lint + CI 检查

## 详细设计

参见 [plan-38-swagger-gen/Makefile](../plan-38-swagger-gen/Makefile) + [router_patch.go](../plan-38-swagger-gen/router_patch.go)
