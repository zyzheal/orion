package handler

import (

	"github.com/gin-gonic/gin"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/crossover/models"
	"orion/platform-svc-go/internal/crossover/service"
)

type Handler struct { svc *service.CrossoverService }

func NewHandler(svc *service.CrossoverService) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	g := rg.Group("/crossover")
	g.POST("/operations", auth.RequirePermission("crossover", "write"), h.RegisterOperation)
	g.DELETE("/operations/:module/:name", auth.RequirePermission("crossover", "delete"), h.UnregisterOperation)
	g.GET("/operations", auth.RequirePermission("crossover", "read"), h.ListOperations)
	g.GET("/operations/:module/:name", auth.RequirePermission("crossover", "read"), h.GetOperation)
	g.POST("/invoke", auth.RequirePermission("crossover", "execute"), h.Invoke)
	g.POST("/async", auth.RequirePermission("crossover", "execute"), h.CreateAsyncJob)
	g.GET("/async/:id", auth.RequirePermission("crossover", "read"), h.GetAsyncJob)
	g.POST("/batch", auth.RequirePermission("crossover", "execute"), h.DispatchBatch)
}

func (h *Handler) RegisterOperation(c *gin.Context) {
	var req models.RegisterOperationRequest
	if err := c.ShouldBindJSON(&req); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
	_, err := h.svc.RegisterOperation(c.Request.Context(), c.GetString("tenant_id"), &req)
	if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
	c.JSON(201, gin.H{"status": "registered"})
}

func (h *Handler) UnregisterOperation(c *gin.Context) {
	err := h.svc.UnregisterOperation(c.Request.Context(), c.GetString("tenant_id"), c.Param("module"), c.Param("name"))
	if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
	c.JSON(200, gin.H{"status": "deleted"})
}

func (h *Handler) ListOperations(c *gin.Context) {
	module := c.Query("module")
	tenantID := c.GetString("tenant_id")
	if module != "" {
		ops, err := h.svc.ListOperationsByModule(c.Request.Context(), tenantID, module)
		if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
		c.JSON(200, gin.H{"data": ops}); return
	}
	ops, err := h.svc.ListOperations(c.Request.Context(), tenantID, nil)
	if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
	c.JSON(200, gin.H{"data": ops})
}

func (h *Handler) GetOperation(c *gin.Context) {
	op, err := h.svc.GetOperation(c.Request.Context(), c.GetString("tenant_id"), c.Param("module"), c.Param("name"))
	if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
	c.JSON(200, gin.H{"data": op})
}

func (h *Handler) Invoke(c *gin.Context) {
	var req models.CreateCrossoverCallRequest
	if err := c.ShouldBindJSON(&req); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
	result, err := h.svc.Invoke(c.Request.Context(), c.GetString("tenant_id"), &req)
	if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
	c.JSON(200, gin.H{"data": result})
}

func (h *Handler) CreateAsyncJob(c *gin.Context) {
	var req models.CreateAsyncJobRequest
	if err := c.ShouldBindJSON(&req); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
	job, err := h.svc.CreateAsyncJob(c.Request.Context(), c.GetString("tenant_id"), &req)
	if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
	c.JSON(201, gin.H{"data": job})
}

func (h *Handler) GetAsyncJob(c *gin.Context) {
	job, err := h.svc.GetAsyncJob(c.Param("id"))
	if err != nil || job == nil { c.JSON(404, gin.H{"error": "job not found"}); return }
	c.JSON(200, gin.H{"data": job})
}

func (h *Handler) DispatchBatch(c *gin.Context) {
	var req struct { Calls []*models.CrossoverCall `json:"calls" binding:"required"` }
	if err := c.ShouldBindJSON(&req); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
	ids, err := h.svc.DispatchBatch(c.Request.Context(), c.GetString("tenant_id"), req.Calls)
	if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
	c.JSON(201, gin.H{"job_ids": ids})
}
