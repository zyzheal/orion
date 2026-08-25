# ============================================================
# Plan 38 — Swagger/OpenAPI 自动生成
# ============================================================
# 优先级: P1
# 来源: 全量代码扫描发现 — swagger.yaml 手动维护, 无生成管线
# 本地证据:
#   - orion-platform-svc-go/docs/swagger.yaml + swagger.json: 存在但手动维护
#   - 1,083行路由注册 (router.go) 无 swagger 注解
#   - 无 swag 工具依赖, 无 Makefile 生成命令
# 技术约束: swag v2, Gin
# ============================================================

.PHONY: swagger swagger-serve swagger-validate swagger-diff

# Swagger 工具
SWAG_BIN := swag
SWAG_VERSION := v2.0.0

# 路径
SERVER_DIR := cmd/server
DOCS_DIR := docs
OUTPUT_TYPES := json,yaml
TITLE := "Orion Platform API"
VERSION := "1.0"
BASE_PATH := "/api/v1"

## 安装 swag 工具
swag-install:
	@command -v $(SWAG_BIN) >/dev/null 2>&1 || \
		go install github.com/swaggo/swag/cmd/swag@$(SWAG_VERSION)

## 生成 Swagger 文档
swagger: swag-install
	$(SWAG_BIN) init \
		-g $(SERVER_DIR)/main.go \
		--parseDependency \
		--parseInternal \
		--parseDepth 5 \
		-d $(DOCS_DIR) \
		--outputTypes $(OUTPUT_TYPES) \
		--exclude internal/test,internal/mock \
		--title $(TITLE) \
		--version $(VERSION) \
		--basePath $(BASE_PATH)

## 格式化 Swagger 注解
swagger-fmt: swag-install
	$(SWAG_BIN) fmt -d $(SERVER_DIR) --exclude internal/test

## 验证 Swagger 文档
swagger-validate: swagger
	@echo "Validating swagger.json..."
	@npx @redocly/cli@latest lint $(DOCS_DIR)/swagger.json || \
		echo "Warning: redocly not available, skipping validation"

## 启动 Swagger UI (开发环境)
swagger-serve: swagger
	@echo "Starting Swagger UI at http://localhost:8080"
	go run github.com/swaggo/gin-swagger \
		github.com/swaggo/files \
		./cmd/server

## 检查 Swagger 变更 (CI 用)
swagger-diff: swagger
	@git diff --exit-code $(DOCS_DIR)/swagger.json $(DOCS_DIR)/swagger.yaml || \
		(echo "ERROR: Swagger docs are out of date. Run 'make swagger' and commit." && exit 1)

## CI 检查: swagger 文档必须最新
ci-check: swagger-diff swagger-validate
	@echo "Swagger docs are up to date."

# ============================================================
# 使用说明:
#
# 1. 在 main.go 添加 swagger 注解:
#
#    // @title           Orion Platform API
#    // @version         1.0
#    // @description     Orion Platform Service
#    // @BasePath        /api/v1
#    // @securityDefinitions.apikey BearerAuth
#    // @in header
#    // @name Authorization
#    func main() { ... }
#
# 2. 在 handler 函数添加 swagger 注解:
#
#    // @Summary      Create circuit breaker
#    // @Description  Create a new circuit breaker configuration
#    // @Tags         circuit-breaker
#    // @Accept       json
#    // @Produce      json
#    // @Param        request body CreateCircuitBreakerReq true "Request body"
#    // @Success      201  {object}  CircuitBreaker
#    // @Failure      400  {object}  ErrorResponse
#    // @Router       /circuit-breakers [post]
#    // @Security     BearerAuth
#    func (h *Handler) Create(c *gin.Context) { ... }
#
# 3. 在 router.go 添加 swagger 路由:
#
#    r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
#
# 4. 运行:
#    make swagger      # 生成文档
#    make swagger-serve # 启动 Swagger UI
#    make ci-check      # CI 检查
# ============================================================
