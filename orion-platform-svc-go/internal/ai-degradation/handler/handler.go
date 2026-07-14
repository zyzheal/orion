package handler

import (
	"context"
	"net/http"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/ai-degradation/models"
	"orion/platform-svc-go/internal/ai-degradation/service"

	"github.com/gin-gonic/gin"
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
	tenantID := c.GetString("tenant_id")
	var req models.CreateDegradationConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	ctx := context.Background()
	config, err := h.svc.CreateConfig(ctx, tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondCreated(c, config)
}

// GetConfig retrieves a degradation configuration by ID.
func (h *Handler) GetConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	config, err := h.svc.GetConfig(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}

	respondSuccess(c, config)
}

// ListConfigs lists degradation configurations.
func (h *Handler) ListConfigs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	req := models.ListConfigsQuery{}
	if err := c.ShouldBindQuery(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if req.Limit <= 0 || req.Limit > 100 {
		req.Limit = 20
	}

	resp, err := h.svc.ListConfigs(ctx, tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, resp)
}

// UpdateConfig updates a degradation configuration.
func (h *Handler) UpdateConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	var req models.UpdateDegradationConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	config, err := h.svc.UpdateConfig(ctx, tenantID, c.Param("id"), req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, config)
}

// DeleteConfig deletes a degradation configuration.
func (h *Handler) DeleteConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()

	err := h.svc.DeleteConfig(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondNoContent(c)
}

// EnableConfig enables a degradation configuration.
func (h *Handler) EnableConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()

	config, err := h.svc.EnableConfig(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, config)
}

// DisableConfig disables a degradation configuration.
func (h *Handler) DisableConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()

	config, err := h.svc.DisableConfig(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, config)
}

// TriggerDegradation manually triggers degradation.
func (h *Handler) TriggerDegradation(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()

	var req models.TriggerDegradationRequest
	_ = c.ShouldBindJSON(&req) // optional body

	history, err := h.svc.TriggerDegradation(ctx, tenantID, c.Param("id"), req)
	if err != nil {
		if err.Error() == "config not found" {
			respondNotFound(c, err.Error())
			return
		}
		respondConflict(c, err.Error())
		return
	}
	respondCreated(c, history)
}

// RecoverService recovers a degraded service.
func (h *Handler) RecoverService(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()

	config, err := h.svc.RecoverService(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, config)
}

// GetHistory retrieves degradation history for a config.
func (h *Handler) GetHistory(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	req := models.ListHistoryQuery{}
	if err := c.ShouldBindQuery(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if req.Limit <= 0 || req.Limit > 100 {
		req.Limit = 20
	}

	resp, err := h.svc.GetHistory(ctx, tenantID, c.Param("id"), req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, resp)
}

// GetGlobalStatus returns the global degradation status.
func (h *Handler) GetGlobalStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()

	status, err := h.svc.GetGlobalStatus(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, status)
}
