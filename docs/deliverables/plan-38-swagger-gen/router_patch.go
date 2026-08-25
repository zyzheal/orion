// ============================================================
// Plan 38 — Swagger 路由注册 (添加到 router.go)
// ============================================================
// 将以下代码添加到 router.go 的路由注册部分
// ============================================================

package server

import (
	// 新增 import
	_ "orion/platform-svc-go/docs" // Swagger 文档
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

func RegisterSwaggerRoutes(r *gin.Engine) {
	// Swagger UI
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Swagger JSON (原始文件)
	r.GET("/swagger.json", func(c *gin.Context) {
		c.File("docs/swagger.json")
	})

	// Swagger YAML (原始文件)
	r.GET("/swagger.yaml", func(c *gin.Context) {
		c.File("docs/swagger.yaml")
	})
}
