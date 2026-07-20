package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/slo/models"
	"orion/platform-svc-go/internal/slo/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel/trace"
)

// Resource and action constants for SLO RBAC.
const (
	resourceSLO   = "slo"
	actionSLORead = "read"
	actionSLOWrite = "write"
	actionSLODelete = "delete"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/dashboard", auth.RequirePermission(resourceSLO, actionSLORead), h.GetDashboard)
	rg.GET("", auth.RequirePermission(resourceSLO, actionSLORead), h.ListSLOs)
	rg.GET("/:id", auth.RequirePermission(resourceSLO, actionSLORead), h.GetSLO)
	rg.POST("", auth.RequirePermission(resourceSLO, actionSLOWrite), h.CreateSLO)
	rg.PUT("/:id", auth.RequirePermission(resourceSLO, actionSLOWrite), h.UpdateSLO)
	rg.DELETE("/:id", auth.RequirePermission(resourceSLO, actionSLODelete), h.DeleteSLO)
	rg.POST("/sli", auth.RequirePermission(resourceSLO, actionSLOWrite), h.RecordSLI)
	rg.GET("/:id/sli", auth.RequirePermission(resourceSLO, actionSLORead), h.GetSLIHistory)
	rg.GET("/:id/error-budget", auth.RequirePermission(resourceSLO, actionSLORead), h.GetLatestErrorBudget)
	rg.GET("/:id/error-budget/history", auth.RequirePermission(resourceSLO, actionSLORead), h.GetErrorBudgetHistory)
}

func (h *Handler) GetDashboard(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDashboard")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondBadRequest(c, "tenant_id is required")
		return
	}
	result, err := h.svc.GetDashboard(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result})
}

func (h *Handler) ListSLOs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListSLOs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondBadRequest(c, "tenant_id is required")
		return
	}
	sloType := c.Query("type")
	enabled := c.Query("enabled")
	var enabledPtr *bool
	if enabled != "" {
		b, err := strconv.ParseBool(enabled)
		if err != nil {
			middleware.RespondBadRequest(c, "invalid enabled value")
			return
		}
		enabledPtr = &b
	}

	result, err := h.svc.ListSLOs(ctx, tenantID, sloType, enabledPtr)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result})
}

func (h *Handler) GetSLO(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSLO")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondBadRequest(c, "tenant_id is required")
		return
	}
	id := c.Param("id")
	result, err := h.svc.GetSLO(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "SLO not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result})
}

func (h *Handler) CreateSLO(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateSLO")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondBadRequest(c, "tenant_id is required")
		return
	}
	var req models.CreateSLORequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	slo := &models.SLODefinition{
		TenantID:          tenantID,
		Name:              req.Name,
		DisplayName:       req.DisplayName,
		SLOType:           req.SLOType,
		Target:            req.Target,
		MeasurementWindow: req.MeasurementWindow,
		AlertThreshold:    req.AlertThreshold,
		MetricQuery:       req.MetricQuery,
		Description:       req.Description,
		Tags:              req.Tags,
		Enabled:           true,
	}

	if err := h.svc.CreateSLO(ctx, slo); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"data": slo})
}

func (h *Handler) UpdateSLO(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateSLO")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondBadRequest(c, "tenant_id is required")
		return
	}
	id := c.Param("id")
	var req models.UpdateSLORequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	updates := make(map[string]interface{})
	if req.DisplayName != nil {
		updates["display_name"] = *req.DisplayName
	}
	if req.SLOType != nil {
		updates["slo_type"] = *req.SLOType
	}
	if req.Target != nil {
		updates["target"] = *req.Target
	}
	if req.MeasurementWindow != nil {
		updates["measurement_window"] = *req.MeasurementWindow
	}
	if req.AlertThreshold != nil {
		updates["alert_threshold"] = *req.AlertThreshold
	}
	if req.MetricQuery != nil {
		updates["metric_query"] = *req.MetricQuery
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Tags != nil {
		updates["tags"] = req.Tags
	}

	result, err := h.svc.UpdateSLO(ctx, tenantID, id, updates)
	if err != nil {
		middleware.RespondNotFound(c, "SLO not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result})
}

func (h *Handler) DeleteSLO(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteSLO")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondBadRequest(c, "tenant_id is required")
		return
	}
	id := c.Param("id")
	if err := h.svc.DeleteSLO(ctx, tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "SLO deleted"})
}

func (h *Handler) RecordSLI(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RecordSLI")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondBadRequest(c, "tenant_id is required")
		return
	}
	var req models.SLIMeasurementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	m := &models.SLIMeasurement{
		SLOID:      req.SLOID,
		TenantID:   tenantID,
		Value:      req.Value,
		MeasuredAt: req.MeasuredAt,
		Total:      req.Total,
		Success:    req.Success,
		ErrorCount: req.ErrorCount,
		Metadata:   req.Metadata,
	}

	if err := h.svc.RecordSLI(ctx, m); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"data": m})
}

func (h *Handler) GetSLIHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSLIHistory")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondBadRequest(c, "tenant_id is required")
		return
	}
	sloID := c.Param("id")
	limit, _ := strconv.Atoi(c.Query("limit"))

	result, err := h.svc.GetSLIHistory(ctx, sloID, tenantID, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result})
}

func (h *Handler) GetLatestErrorBudget(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetLatestErrorBudget")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondBadRequest(c, "tenant_id is required")
		return
	}
	sloID := c.Param("id")
	result, err := h.svc.GetLatestErrorBudget(ctx, sloID, tenantID)
	if err != nil {
		middleware.RespondNotFound(c, "error budget not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result})
}

func (h *Handler) GetErrorBudgetHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetErrorBudgetHistory")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondBadRequest(c, "tenant_id is required")
		return
	}
	sloID := c.Param("id")
	limit, _ := strconv.Atoi(c.Query("limit"))

	result, err := h.svc.GetErrorBudgetHistory(ctx, sloID, tenantID, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result})
}
