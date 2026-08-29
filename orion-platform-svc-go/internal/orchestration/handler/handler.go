package handler

import (
	"go.opentelemetry.io/otel"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/orchestration/models"
	"orion/platform-svc-go/internal/orchestration/service"
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

func (h *OrchestrationHandler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListOrchestrations")
	defer span.End()
	tenantID := h.GetTenantID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.svc.Query(ctx, tenantID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "total": resp.Total, "data": resp.Data})
}

func (h *OrchestrationHandler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateOrchestration")
	defer span.End()
	tenantID := h.GetTenantID(c)
	var req struct {
		Name        string               `json:"name" binding:"required"`
		Description string               `json:"description"`
		Agents      []models.AgentConfig `json:"agents" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}
	orch, err := h.svc.Create(ctx, tenantID, req.Name, req.Description, req.Agents)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "message": "created", "data": orch})
}

func (h *OrchestrationHandler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetOrchestration")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id := c.Param("id")
	orch, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": orch})
}

func (h *OrchestrationHandler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteOrchestration")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id := c.Param("id")
	if err := h.svc.Delete(ctx, tenantID, id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

func (h *OrchestrationHandler) Run(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RunOrchestration")
	defer span.End()
	tenantID := h.GetTenantID(c)
	var req models.RunRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}
	run, err := h.svc.Run(ctx, tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"code": 0, "data": gin.H{"run": run}})
}

func (h *OrchestrationHandler) ListRuns(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListOrchestrationRuns")
	defer span.End()
	orchID := c.Param("orch_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	runs, total, err := h.svc.QueryRuns(ctx, orchID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "total": total, "data": runs})
}

func (h *OrchestrationHandler) GetRun(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetOrchestrationRun")
	defer span.End()
	id := c.Param("run_id")
	run, err := h.svc.GetRun(ctx, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": run})
}
