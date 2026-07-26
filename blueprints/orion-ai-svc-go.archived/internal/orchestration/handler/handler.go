package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"orion/ai-svc-go/internal/orchestration/models"
	"orion/ai-svc-go/internal/orchestration/service"
	"orion/go-common/pkg/auth"
)

type OrchestrationHandler struct {
	svc *service.OrchestrationService
}

func NewOrchestrationHandler(svc *service.OrchestrationService) *OrchestrationHandler {
	return &OrchestrationHandler{svc: svc}
}

func (h *OrchestrationHandler) GetTenantID(c *gin.Context) string {
	return c.GetString("tenantId")
}

// RegisterRoutes registers orchestration routes.
func (h *OrchestrationHandler) RegisterRoutes(rg *gin.RouterGroup) {
	orch := rg.Group("/orchestration")

	orch.GET("", auth.RequirePermission("ai", "read"), h.List)
	orch.POST("", auth.RequirePermission("ai", "write"), h.Create)
	orch.GET("/:id", auth.RequirePermission("ai", "read"), h.Get)
	orch.DELETE("/:id", auth.RequirePermission("ai", "delete"), h.Delete)

	runs := rg.Group("/orchestration/:orch_id/runs")
	runs.GET("", auth.RequirePermission("ai", "read"), h.ListRuns)
	runs.POST("", auth.RequirePermission("ai", "execute"), h.Run)

	rg.GET("/orchestration/runs/:run_id", auth.RequirePermission("ai", "read"), h.GetRun)
}

// List returns paginated orchestrations.
func (h *OrchestrationHandler) List(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	resp, err := h.svc.Query(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "total": resp.Total, "data": resp.Data})
}

// Create creates a new orchestration.
func (h *OrchestrationHandler) Create(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	var req struct {
		Name        string                `json:"name" binding:"required"`
		Description string                `json:"description"`
		Agents      []models.AgentConfig  `json:"agents" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}

	orch, err := h.svc.Create(c.Request.Context(), tenantID, req.Name, req.Description, req.Agents)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "message": "created", "data": orch})
}

// Get returns a single orchestration.
func (h *OrchestrationHandler) Get(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	orch, err := h.svc.Get(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": orch})
}

// Delete removes an orchestration.
func (h *OrchestrationHandler) Delete(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	 id := c.Param("id")

	if err := h.svc.Delete(c.Request.Context(), tenantID, id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

// Run executes an orchestration.
func (h *OrchestrationHandler) Run(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	var req models.RunRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}

	run, err := h.svc.Run(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"code": 0, "data": gin.H{"run": run}})
}

// ListRuns returns paginated runs.
func (h *OrchestrationHandler) ListRuns(c *gin.Context) {
	orchID := c.Param("orch_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	runs, total, err := h.svc.QueryRuns(c.Request.Context(), orchID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "total": total, "data": runs})
}

// GetRun returns a single run.
func (h *OrchestrationHandler) GetRun(c *gin.Context) {
	id := c.Param("run_id")

	run, err := h.svc.GetRun(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": run})
}
