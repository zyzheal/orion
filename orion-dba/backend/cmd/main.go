package main

import (
	"log"
	"net/http"
	"os"
	
	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()
	
	// 全局中间件
	r.Use(CORSMiddleware())
	r.Use(RecoveryMiddleware())
	r.Use(AuthMiddleware())
	
	// 健康检查
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"service": "orion-dba-service",
			"status":  "ok",
		})
	})

	// 登录相关 API（Mock）
	r.POST("/login", func(c *gin.Context) {
		var req struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(200, gin.H{"code": 1202, "text": "用户名或密码错误", "payload": nil})
			return
		}
		// Mock 登录成功
		c.JSON(200, gin.H{"code": 0, "text": "", "payload": gin.H{
			"token": "mock-jwt-token-" + req.Username,
			"user": gin.H{"username": req.Username, "role": "admin"},
		}})
	})

	// 获取系统注册状态（Mock）
	r.GET("/fetch", func(c *gin.Context) {
		c.JSON(200, gin.H{"code": 0, "text": "", "payload": gin.H{
			"reg": false,
		}})
	})

	// 国际化语言包（Mock）
	r.GET("/lang", func(c *gin.Context) {
		c.JSON(200, gin.H{"code": 0, "text": "", "payload": gin.H{
			"user": gin.H{
				"form": gin.H{"title": "登录", "username": "用户名", "password": "密码"},
			},
			"common": gin.H{
				"signin": "登录", "about": "关于", "community": "社区",
				"sponsor": "赞助", "statement": "声明",
			},
		}})
	})

	// OIDC 状态（Mock）
	r.GET("/oidc/state", func(c *gin.Context) {
		c.JSON(200, gin.H{"code": 0, "text": "", "payload": gin.H{"enabled": false}})
	})
	
	// API 路由
	api := r.Group("/api/v1")
	{
		// SQL 审核
		audit := api.Group("/audit")
		{
			audit.POST("/submit", SubmitAudit)
			audit.POST("/review", ReviewAudit)
			audit.POST("/execute", ExecuteAudit)
			audit.GET("/list", ListAudits)
			audit.GET("/:id", GetAuditDetail)
			audit.POST("/:id/rollback", RollbackAudit)
		}
		
		// SQL 查询
		query := api.Group("/query")
		{
			query.POST("/execute", ExecuteQuery)
			query.GET("/history", QueryHistory)
			query.GET("/export", ExportQuery)
		}
		
		// SQL 工单
		ticket := api.Group("/ticket")
		{
			ticket.POST("/create", CreateTicket)
			ticket.GET("/list", ListTickets)
			ticket.POST("/approve", ApproveTicket)
			ticket.POST("/reject", RejectTicket)
		}
		
		// 数据源
		source := api.Group("/source")
		{
			source.POST("/create", CreateSource)
			source.GET("/list", ListSources)
			source.PUT("/:id", UpdateSource)
			source.DELETE("/:id", DeleteSource)
			source.POST("/test", TestSource)
		}
		
		// 审核规则
		rule := api.Group("/rule")
		{
			rule.GET("/list", ListRules)
			rule.POST("/create", CreateRule)
			rule.PUT("/:id", UpdateRule)
			rule.DELETE("/:id", DeleteRule)
		}
	}
	
	// 插件管理
	plugins := r.Group("/api/v1/plugins")
	{
		plugins.GET("/dba/health", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"plugin": "orion-dba",
				"status": "healthy",
			})
		})
	}
	
	port := os.Getenv("PORT")
	if port == "" {
		port = "8090"
	}
	
	log.Printf("orion-dba-service starting on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}

// 中间件实现 (简化版)
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Orion-Token")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}

func RecoveryMiddleware() gin.HandlerFunc {
	return gin.Recovery()
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从 Orion Gateway 获取用户信息
		token := c.GetHeader("X-Orion-Token")
		if token == "" {
			// 允许健康检查等公开路由通过
			if c.Request.URL.Path == "/health" {
				c.Next()
				return
			}
			c.AbortWithStatusJSON(401, gin.H{"error": "Unauthorized"})
			return
		}
		
		// TODO: 验证 Orion Token
		// user, err := verifyOrionToken(token)
		
		c.Next()
	}
}

// Handler 占位函数 (实际实现从 Yearning 迁移)
func SubmitAudit(c *gin.Context)           { c.JSON(200, gin.H{"status": "ok"}) }
func ReviewAudit(c *gin.Context)           { c.JSON(200, gin.H{"status": "ok"}) }
func ExecuteAudit(c *gin.Context)          { c.JSON(200, gin.H{"status": "ok"}) }
func ListAudits(c *gin.Context)            { c.JSON(200, gin.H{"data": []}) }
func GetAuditDetail(c *gin.Context)        { c.JSON(200, gin.H{"data": nil}) }
func RollbackAudit(c *gin.Context)         { c.JSON(200, gin.H{"status": "ok"}) }
func ExecuteQuery(c *gin.Context)          { c.JSON(200, gin.H{"data": []}) }
func QueryHistory(c *gin.Context)          { c.JSON(200, gin.H{"data": []}) }
func ExportQuery(c *gin.Context)           { c.JSON(200, gin.H{"url": ""}) }
func CreateTicket(c *gin.Context)          { c.JSON(200, gin.H{"status": "ok"}) }
func ListTickets(c *gin.Context)           { c.JSON(200, gin.H{"data": []}) }
func ApproveTicket(c *gin.Context)         { c.JSON(200, gin.H{"status": "ok"}) }
func RejectTicket(c *gin.Context)          { c.JSON(200, gin.H{"status": "ok"}) }
func CreateSource(c *gin.Context)          { c.JSON(200, gin.H{"status": "ok"}) }
func ListSources(c *gin.Context)           { c.JSON(200, gin.H{"data": []}) }
func UpdateSource(c *gin.Context)          { c.JSON(200, gin.H{"status": "ok"}) }
func DeleteSource(c *gin.Context)          { c.JSON(200, gin.H{"status": "ok"}) }
func TestSource(c *gin.Context)            { c.JSON(200, gin.H{"status": "ok"}) }
func ListRules(c *gin.Context)             { c.JSON(200, gin.H{"data": []}) }
func CreateRule(c *gin.Context)            { c.JSON(200, gin.H{"status": "ok"}) }
func UpdateRule(c *gin.Context)            { c.JSON(200, gin.H{"status": "ok"}) }
func DeleteRule(c *gin.Context)            { c.JSON(200, gin.H{"status": "ok"}) }
