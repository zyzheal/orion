package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/data-quality/models"
	"orion/platform-svc-go/internal/data-quality/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all data-quality endpoints under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/data-quality")

	// === Rules ===
	f.GET("/rules", auth.RequirePermission("data-quality", "read"), h.ListRules)
	f.POST("/rules", auth.RequirePermission("data-quality", "write"), h.CreateRule)
	f.GET("/rules/:id", auth.RequirePermission("data-quality", "read"), h.GetRule)
	f.PUT("/rules/:id", auth.RequirePermission("data-quality", "write"), h.UpdateRule)
	f.DELETE("/rules/:id", auth.RequirePermission("data-quality", "delete"), h.DeleteRule)

	// === Scan Results ===
	f.POST("/scan-results", auth.RequirePermission("data-quality", "write"), h.CreateScanResult)
	f.GET("/rules/:ruleId/scan-results", auth.RequirePermission("data-quality", "read"), h.ListScanResults)

	// === Alerts ===
	f.GET("/alerts", auth.RequirePermission("data-quality", "read"), h.ListAlerts)
	f.POST("/alerts", auth.RequirePermission("data-quality", "write"), h.CreateAlert)
	f.GET("/alerts/:id", auth.RequirePermission("data-quality", "read"), h.GetAlert)
	f.PUT("/alerts/:id", auth.RequirePermission("data-quality", "write"), h.UpdateAlert)
	f.DELETE("/alerts/:id", auth.RequirePermission("data-quality", "delete"), h.DeleteAlert)

	// === Stats ===
	f.GET("/stats", auth.RequirePermission("data-quality", "read"), h.GetStats)
}

// ==================== Rules ====================

func (h *Handler) ListRules(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListRules")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	filter := &models.RuleFilter{Limit: 20}
	if l := c.Query("limit"); l != "" {
		filter.Limit, _ = strconv.Atoi(l)
	}
	if o := c.Query("offset"); o != "" {
		filter.Offset, _ = strconv.Atoi(o)
	}
	if rt := c.Query("ruleType"); rt != "" {
		filter.RuleType = &rt
	}
	if s := c.Query("severity"); s != "" {
		filter.Severity = &s
	}
	if st := c.Query("status"); st != "" {
		filter.Status = &st
	}
	result, err := h.svc.ListRules(ctx, tenantID, filter)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) CreateRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.CreateRule(ctx, tenantID, &req)
	if err != nil {
		if service.IsBadRequest(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

func (h *Handler) GetRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.GetRule(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "rule not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) UpdateRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.UpdateRule(ctx, tenantID, id, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "rule not found")
			return
		}
		if service.IsBadRequest(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) DeleteRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	err := h.svc.DeleteRule(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "rule not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "rule deleted"})
}

// ==================== Scan Results ====================

func (h *Handler) CreateScanResult(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateScanResult")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateScanResultRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.CreateScanResult(ctx, tenantID, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "rule not found")
			return
		}
		if service.IsBadRequest(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

func (h *Handler) ListScanResults(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListScanResults")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ruleID := c.Param("ruleId")
	var status *string
	if s := c.Query("status"); s != "" {
		status = &s
	}
	result, err := h.svc.ListScanResults(ctx, tenantID, ruleID, status)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// ==================== Alerts ====================

func (h *Handler) ListAlerts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAlerts")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var status *string
	if s := c.Query("status"); s != "" {
		status = &s
	}
	result, err := h.svc.ListAlerts(ctx, tenantID, status)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) CreateAlert(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateAlert")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.CreateAlert(ctx, tenantID, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "rule not found")
			return
		}
		if service.IsBadRequest(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

func (h *Handler) GetAlert(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAlert")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.GetAlert(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "alert not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) UpdateAlert(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateAlert")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.UpdateAlert(ctx, tenantID, id, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "alert not found")
			return
		}
		if service.IsBadRequest(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) DeleteAlert(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteAlert")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	err := h.svc.DeleteAlert(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "alert not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "alert deleted"})
}

// ==================== Stats ====================

func (h *Handler) GetStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.GetStats(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}
