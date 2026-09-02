package handler

import (
	"go.opentelemetry.io/otel"
	"strconv"

	"github.com/gin-gonic/gin"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/integration-handler/models"
	"orion/platform-svc-go/internal/integration-handler/service"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	g := rg.Group("/integrations")
	g.POST("", auth.RequirePermission("integration", "write"), h.CreateIntegration)
	g.GET("/:id", auth.RequirePermission("integration", "read"), h.GetIntegration)
	g.GET("", auth.RequirePermission("integration", "read"), h.ListIntegrations)
	g.PUT("/:id", auth.RequirePermission("integration", "write"), h.UpdateIntegration)
	g.DELETE("/:id", auth.RequirePermission("integration", "delete"), h.DeleteIntegration)

	tg := rg.Group("/integration-tasks")
	tg.POST("", auth.RequirePermission("integration", "write"), h.CreateTask)
	tg.GET("/:id", auth.RequirePermission("integration", "read"), h.GetTask)
	tg.GET("", auth.RequirePermission("integration", "read"), h.ListTasks)
	tg.PUT("/:id/status", auth.RequirePermission("integration", "write"), h.UpdateTaskStatus)
	tg.DELETE("/:id", auth.RequirePermission("integration", "delete"), h.DeleteTask)
	tg.GET("/:id/logs", auth.RequirePermission("integration", "read"), h.GetLogs)
}

func (h *Handler) CreateIntegration(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateIntegration")
	defer span.End()
	var req models.CreateIntegrationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	ig, err := h.svc.CreateIntegration(ctx, c.GetString("tenant_id"), &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, ig)
}

func (h *Handler) GetIntegration(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetIntegration")
	defer span.End()
	ig, err := h.svc.GetIntegration(ctx, c.GetString("tenant_id"), c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, ig)
}

func (h *Handler) ListIntegrations(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListIntegrations")
	defer span.End()
	intType := c.Query("type")
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	items, err := h.svc.ListIntegrations(ctx, c.GetString("tenant_id"), intType, offset, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) UpdateIntegration(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateIntegration")
	defer span.End()
	var req models.UpdateIntegrationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	ig, err := h.svc.UpdateIntegration(ctx, c.GetString("tenant_id"), c.Param("id"), &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, ig)
}

func (h *Handler) DeleteIntegration(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteIntegration")
	defer span.End()
	if err := h.svc.DeleteIntegration(ctx, c.GetString("tenant_id"), c.Param("id")); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	c.JSON(200, gin.H{"status": "deleted"})
}

func (h *Handler) CreateTask(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateIntegrationTask")
	defer span.End()
	var req models.CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	t, err := h.svc.CreateTask(ctx, c.GetString("tenant_id"), &req)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(201, gin.H{"data": t})
}

func (h *Handler) GetTask(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetIntegrationTask")
	defer span.End()
	t, err := h.svc.GetTask(ctx, c.GetString("tenant_id"), c.Param("id"))
	if err != nil {
		c.JSON(404, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": t})
}

func (h *Handler) ListTasks(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListIntegrationTasks")
	defer span.End()
	integrationID := c.Query("integration_id")
	status := c.Query("status")
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	items, err := h.svc.ListTasks(ctx, c.GetString("tenant_id"), integrationID, status, offset, limit)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": items})
}

func (h *Handler) UpdateTaskStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateIntegrationTaskStatus")
	defer span.End()
	var req struct {
		Status     string `json:"status" binding:"required"`
		ErrorMsg   string `json:"error_msg"`
		Response   string `json:"response"`
		DurationMs int64  `json:"duration_ms"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	t, err := h.svc.UpdateTaskStatus(ctx, c.GetString("tenant_id"), c.Param("id"), req.Status, req.ErrorMsg, req.Response, req.DurationMs)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": t})
}

func (h *Handler) DeleteTask(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteIntegrationTask")
	defer span.End()
	if err := h.svc.DeleteTask(ctx, c.GetString("tenant_id"), c.Param("id")); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"status": "deleted"})
}

func (h *Handler) GetLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetIntegrationTaskLogs")
	defer span.End()
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	logs, err := h.svc.GetLogs(ctx, c.Param("id"), offset, limit)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": logs})
}
