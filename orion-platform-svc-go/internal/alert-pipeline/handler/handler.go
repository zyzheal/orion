// Package handler exposes HTTP endpoints for the alert pipeline.
package handler

import (
	"orion/go-common/pkg/errors"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/alert-pipeline/models"
	"orion/platform-svc-go/internal/alert-pipeline/service"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"

	"go.uber.org/zap"
)

// Handler exposes HTTP endpoints for the alert pipeline.
type Handler struct {
	svc    *service.PipelineService
	logger *zap.Logger
}

// NewHandler creates a new alert-pipeline Handler.
func NewHandler(svc *service.PipelineService, logger *zap.Logger) *Handler {
	return &Handler{svc: svc, logger: logger}
}

// RegisterRoutes mounts all alert-pipeline endpoints.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	g := rg.Group("/alerts/pipeline")

	g.POST("", auth.RequirePermission("alert", "write"), h.Execute)
	g.POST("/batch", auth.RequirePermission("alert", "write"), h.ExecuteBatch)
	g.GET("/config", auth.RequirePermission("alert", "read"), h.GetConfig)
	g.PUT("/config", auth.RequirePermission("alert", "write"), h.UpdateConfig)
	g.PUT("/:tenantId/enable", auth.RequirePermission("alert", "write"), h.Toggle)
	g.GET("/:id", auth.RequirePermission("alert", "read"), h.GetResult)
	g.GET("", auth.RequirePermission("alert", "read"), h.List)
}

// Execute handles POST /alerts/pipeline - run the pipeline for a single alert.
func (h *Handler) Execute(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var alert models.AlertEvent
	if err := c.ShouldBindJSON(&alert); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}

	if alert.ID == "" {
		alert.ID = service.GenerateAlertID()
	}

	result := h.svc.Execute(c.Request.Context(), tenantID, alert)
	middleware.RespondSuccess(c, result)
}

// ExecuteBatch handles POST /alerts/pipeline/batch - run the pipeline for multiple alerts.
func (h *Handler) ExecuteBatch(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var alerts []models.AlertEvent
	if err := c.ShouldBindJSON(&alerts); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}

	results := h.svc.ExecuteBatch(c.Request.Context(), tenantID, alerts)
	middleware.RespondSuccess(c, results)
}

// GetConfig handles GET /alerts/pipeline/config - get current pipeline configuration.
func (h *Handler) GetConfig(c *gin.Context) {
	cfg := h.svc.Config()
	middleware.RespondSuccess(c, cfg)
}

// UpdateConfig handles PUT /alerts/pipeline/config - update pipeline configuration.
func (h *Handler) UpdateConfig(c *gin.Context) {
	var cfg models.PipelineConfig
	if err := c.ShouldBindJSON(&cfg); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	if cfg.Stages == nil || len(cfg.Stages) == 0 {
		cfg.Stages = models.DefaultPipelineConfig("default").Stages
	}
	middleware.RespondSuccess(c, gin.H{"message": "config accepted", "config": cfg})
}

// Toggle handles PUT /alerts/pipeline/:tenantId/enable - toggle pipeline on/off.
func (h *Handler) Toggle(c *gin.Context) {
	tenantID := c.Param("tenantId")
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	h.svc.Enable(tenantID, req.Enabled)
	middleware.RespondSuccess(c, gin.H{"enabled": req.Enabled})
}

// GetResult handles GET /alerts/pipeline/:id - get pipeline result by alert ID.
func (h *Handler) GetResult(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		errors.WriteError(c, errors.ErrBadRequest, "alert ID is required", 400)
		return
	}
	// TODO: replace with a real results store (e.g. event.Store)
	middleware.RespondSuccess(c, gin.H{"alert_id": id, "stages": []string{}, "status": "not_found"})
}

// List handles GET /alerts/pipeline - list recent pipeline executions.
func (h *Handler) List(c *gin.Context) {
	_ = c.GetString("tenant_id")
	// TODO: replace with a real results store (e.g. event.Store)
	middleware.RespondSuccess(c, gin.H{"results": []string{}, "total": 0})
}
