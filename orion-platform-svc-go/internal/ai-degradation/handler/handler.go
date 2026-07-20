package handler

import (
	"context"
	"net/http"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/ai-degradation/models"
	"orion/platform-svc-go/internal/ai-degradation/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

var _ = http.StatusOK
var _ = strconv.Itoa

// Handler exposes HTTP endpoints for the AI Degradation module.
type Handler struct {
	svc *service.DegradationService
}

// NewHandler creates a new Handler.
func NewHandler(svc *service.DegradationService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all ai-degradation routes.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/ai/degradation")

	// GET /api/v1/ai/degradation/status - 获取全局降级状态
	r.GET("/status",
		auth.RequirePermission("ai_degradation", "read"),
		h.GetGlobalStatus)

	// GET /api/v1/ai/degradation - 获取降级配置列表
	r.GET("",
		auth.RequirePermission("ai_degradation", "read"),
		h.ListConfigs)

	// POST /api/v1/ai/degradation - 创建降级配置
	r.POST("",
		auth.RequirePermission("ai_degradation", "write"),
		h.CreateConfig)

	// GET /api/v1/ai/degradation/:id - 获取降级配置详情
	r.GET("/:id",
		auth.RequirePermission("ai_degradation", "read"),
		h.GetConfig)

	// PUT /api/v1/ai/degradation/:id - 更新降级配置
	r.PUT("/:id",
		auth.RequirePermission("ai_degradation", "write"),
		h.UpdateConfig)

	// DELETE /api/v1/ai/degradation/:id - 删除降级配置
	r.DELETE("/:id",
		auth.RequirePermission("ai_degradation", "delete"),
		h.DeleteConfig)

	// POST /api/v1/ai/degradation/:id/enable - 启用降级配置
	r.POST("/:id/enable",
		auth.RequirePermission("ai_degradation", "write"),
		h.EnableConfig)

	// POST /api/v1/ai/degradation/:id/disable - 禁用降级配置
	r.POST("/:id/disable",
		auth.RequirePermission("ai_degradation", "write"),
		h.DisableConfig)

	// GET /api/v1/ai/degradation/:id/history - 获取降级历史
	r.GET("/:id/history",
		auth.RequirePermission("ai_degradation", "read"),
		h.GetHistory)

	// POST /api/v1/ai/degradation/:id/trigger - 手动触发降级
	r.POST("/:id/trigger",
		auth.RequirePermission("ai_degradation", "write"),
		h.TriggerDegradation)

	// POST /api/v1/ai/degradation/:id/recover - 恢复服务
	r.POST("/:id/recover",
		auth.RequirePermission("ai_degradation", "write"),
		h.RecoverService)
}

// CreateConfig creates a new degradation configuration.
func (h *Handler) CreateConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateDegradationConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	ctx := middleware.TimeoutContext(c)
	config, err := h.svc.CreateConfig(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	middleware.RespondCreated(c, config)
}

// GetConfig retrieves a degradation configuration by ID.
func (h *Handler) GetConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)
	config, err := h.svc.GetConfig(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}

	middleware.RespondSuccess(c, config)
}

// ListConfigs lists degradation configurations.
func (h *Handler) ListConfigs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListConfigs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)
	req := models.ListConfigsQuery{}
	if err := c.ShouldBindQuery(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Limit <= 0 || req.Limit > 100 {
		req.Limit = 20
	}

	resp, err := h.svc.ListConfigs(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, resp)
}

// UpdateConfig updates a degradation configuration.
func (h *Handler) UpdateConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)
	var req models.UpdateDegradationConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	config, err := h.svc.UpdateConfig(ctx, tenantID, c.Param("id"), req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, config)
}

// DeleteConfig deletes a degradation configuration.
func (h *Handler) DeleteConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)

	err := h.svc.DeleteConfig(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	middleware.RespondSuccess(c, nil) // c)
}

// EnableConfig enables a degradation configuration.
func (h *Handler) EnableConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EnableConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)

	config, err := h.svc.EnableConfig(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, config)
}

// DisableConfig disables a degradation configuration.
func (h *Handler) DisableConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DisableConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)

	config, err := h.svc.DisableConfig(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, config)
}

// TriggerDegradation manually triggers degradation.
func (h *Handler) TriggerDegradation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TriggerDegradation")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)

	var req models.TriggerDegradationRequest
	_ = c.ShouldBindJSON(&req) // optional body

	history, err := h.svc.TriggerDegradation(ctx, tenantID, c.Param("id"), req)
	if err != nil {
		if err.Error() == "config not found" {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondConflict(c, err.Error())
		return
	}
	middleware.RespondCreated(c, history)
}

// RecoverService recovers a degraded service.
func (h *Handler) RecoverService(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RecoverService")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)

	config, err := h.svc.RecoverService(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, config)
}

// GetHistory retrieves degradation history for a config.
func (h *Handler) GetHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetHistory")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)
	req := models.ListHistoryQuery{}
	if err := c.ShouldBindQuery(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Limit <= 0 || req.Limit > 100 {
		req.Limit = 20
	}

	resp, err := h.svc.GetHistory(ctx, tenantID, c.Param("id"), req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, resp)
}

// GetGlobalStatus returns the global degradation status.
func (h *Handler) GetGlobalStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetGlobalStatus")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)

	status, err := h.svc.GetGlobalStatus(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, status)
}
