# Wiring 模板 — Agent 遵循此模式

## 包索引（供 Agent 查询，禁止编造包路径）

见 `WIRING_PACKAGE_INDEX.md`（282 模块的 handler/service/repo 包路径 + 构造函数签名）。

## Wiring 独立文件模板

每个域一个独立文件 `cmd/server/wiring-<domain>.go`：

```go
package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	<module>_handler "orion/platform-svc-go/internal/<module>/handler"
	<module>_repo "orion/platform-svc-go/internal/<module>/repository"
	<module>_service "orion/platform-svc-go/internal/<module>/service"
)

func wire<Domain>(db *database.DB, logger *zap.Logger) {
	_ = logger

	// <module>: repo -> service -> handler
	{
		repo := <module>_repo.NewRepository(db.DB)
		svc := <module>_service.NewService(repo)
		<module>H = <module>_handler.NewHandler(svc)
	}
}

// Handler variables (local to this file, consumed by wiring.go initWiring)
var (
	<module>H *<module>_handler.Handler
)
```

## 注册流程

### 1. 在 wiring.go initWiring() 末尾加 call：

```go
	wire<Domain>(db, logger)
```

### 2. 在 router.go setupRouter() 末尾加 route：

```go
  if <module>H != nil {
    <module>H.RegisterRoutes(api)
  }
```

## 关键约束

1. **包路径** 必须查 `WIRING_PACKAGE_INDEX.md`，禁止编造
2. **构造函数签名** 用 `grep "^func New" internal/<module>/service/*.go` 确认
3. **var 声明** 放在独立 wire 文件末尾，不写 wiring.go
4. **initWiring() call** 在 wiring.go 末尾添加
5. **RegisterRoutes** 在 router.go 末尾添加
6. 每个 wire 文件只处理一个域（如 governance / security / identity / ticket）

## 当前已有独立 wire 文件

| 文件 | 处理域 | 模块数 |
|------|--------|--------|
| wiring-core-domains.go | governance + security + identity + ticket | 15 子模块 ✅ |
| core_infra_wiring.go | feature-flag, role, artifact, etc. | 43 模块 |
| cicd_domain_wiring.go | CI/CD | 29 模块 |
| notification_auth_wiring.go | notification + auth | 20 模块 |
| pipeline_wave_wiring.go | pipeline | 21 模块 |
| ai_wiring.go | AI | 10 模块 |
| blueprint_batch_wiring.go | P2 batch | 47 模块 |

## 新 P0 wiring 任务的目标文件

创建 `cmd/server/wiring-<domain>.go`，不要改现有文件。

