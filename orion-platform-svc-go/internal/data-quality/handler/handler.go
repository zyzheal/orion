package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/data-quality/models"
	"orion/platform-svc-go/internal/data-quality/service"

	"github.com/gin-gonic/gin"
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
	result, err := h.svc.ListRules(c.Request.Context(), tenantID, filter)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) CreateRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.CreateRule(c.Request.Context(), tenantID, &req)
	if err != nil {
		if service.IsBadRequest(err) {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, result)
}

func (h *Handler) GetRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.GetRule(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "rule not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) UpdateRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.UpdateRule(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "rule not found")
			return
		}
		if service.IsBadRequest(err) {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) DeleteRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	err := h.svc.DeleteRule(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "rule not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "rule deleted"})
}

// ==================== Scan Results ====================

func (h *Handler) CreateScanResult(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateScanResultRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.CreateScanResult(c.Request.Context(), tenantID, &req)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "rule not found")
			return
		}
		if service.IsBadRequest(err) {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, result)
}

func (h *Handler) ListScanResults(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ruleID := c.Param("ruleId")
	var status *string
	if s := c.Query("status"); s != "" {
		status = &s
	}
	result, err := h.svc.ListScanResults(c.Request.Context(), tenantID, ruleID, status)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// ==================== Alerts ====================

func (h *Handler) ListAlerts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var status *string
	if s := c.Query("status"); s != "" {
		status = &s
	}
	result, err := h.svc.ListAlerts(c.Request.Context(), tenantID, status)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) CreateAlert(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.CreateAlert(c.Request.Context(), tenantID, &req)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "rule not found")
			return
		}
		if service.IsBadRequest(err) {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, result)
}

func (h *Handler) GetAlert(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.GetAlert(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "alert not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) UpdateAlert(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.UpdateAlert(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "alert not found")
			return
		}
		if service.IsBadRequest(err) {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) DeleteAlert(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	err := h.svc.DeleteAlert(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "alert not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "alert deleted"})
}

// ==================== Stats ====================

func (h *Handler) GetStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.GetStats(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}
