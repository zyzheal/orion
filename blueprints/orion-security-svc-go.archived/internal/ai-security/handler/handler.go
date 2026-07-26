package handler

import (
	"strconv"
	"time"

	"orion/security-svc-go/internal/ai-security/models"
	"orion/security-svc-go/internal/ai-security/service"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// ---- Security scan endpoints ----
	s := rg.Group("/ai/security/scans")
	s.GET("", h.ListScans)
	s.GET("/:id", h.GetScan)
	s.POST("", auth.RequirePermission("ai-security", "write"), h.RunScan)

	// ---- Policy endpoints ----
	p := rg.Group("/ai/security/policies")
	p.GET("", h.ListPolicies)
	p.GET("/:id", h.GetPolicy)
	p.PUT("/:id", auth.RequirePermission("ai-security", "write"), h.UpdatePolicy)
	p.DELETE("/:id", auth.RequirePermission("ai-security", "write"), h.DeletePolicy)

	// ---- Alert endpoints ----
	a := rg.Group("/ai/security/alerts")
	a.GET("", h.ListAlerts)
	a.GET("/:id", h.GetAlert)
}

// ListScans — GET /api/v1/ai/security/scans
func (h *Handler) ListScans(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.Query("user_id")
	startTime := parseTimeQuery(c, "start_time")
	endTime := parseTimeQuery(c, "end_time")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	scanResult, err := h.svc.ListScans(c.Request.Context(), tenantID, userID, startTime, endTime, page, ps)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": scanResult, "meta": gin.H{"total": len(scanResult)}})
}

// GetScan — GET /api/v1/ai/security/scans/:id
func (h *Handler) GetScan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	scanResult, err := h.svc.GetScan(c.Request.Context(), tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if len(scanResult) == 0 {
		respondNotFound(c, "scan not found")
		return
	}
	respondSuccess(c, scanResult)
}

// RunScan — POST /api/v1/ai/security/scans
func (h *Handler) RunScan(c *gin.Context) {
	userID := c.GetString("user_id")

	var req models.ScanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, "input is required")
		return
	}

	result, err := h.svc.Scan(c.Request.Context(), req.Input, userID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	if result.HasViolation {
		respondForbidden(c, "Security scan failed")
		return
	}

	respondCreated(c, gin.H{
		"input":        req.Input,
		"user_id":      userID,
		"risk_score":   result.RiskScore,
		"sanitized":    result.Sanitized,
		"has_violation": result.HasViolation,
		"scanned_at":   result.ScannedAt,
	})
}

// ListPolicies — GET /api/v1/ai/security/policies
func (h *Handler) ListPolicies(c *gin.Context) {
	policies, err := h.svc.ListPolicies(c.Request.Context())
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, policies)
}

// GetPolicy — GET /api/v1/ai/security/policies/:id
func (h *Handler) GetPolicy(c *gin.Context) {
	id := c.Param("id")
	policy, err := h.svc.GetPolicy(id)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{
		"id":          policy.ID,
		"name":        policy.Name,
		"enabled":     policy.Enabled,
		"description": policy.Description,
		"settings":    policy.Settings,
	})
}

// UpdatePolicy — PUT /api/v1/ai/security/policies/:id
func (h *Handler) UpdatePolicy(c *gin.Context) {
	id := c.Param("id")

	var req models.PolicyInput
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	err := h.svc.UpdatePolicy(id, req.Enabled)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"id": id, "updated": true})
}

// DeletePolicy — DELETE /api/v1/ai/security/policies/:id
func (h *Handler) DeletePolicy(c *gin.Context) {
	id := c.Param("id")

	err := h.svc.DisablePolicy(id)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"id": id, "disabled": true})
}

// ListAlerts — GET /api/v1/ai/security/alerts
func (h *Handler) ListAlerts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.Query("user_id")
	startTime := parseTimeQuery(c, "start_time")
	endTime := parseTimeQuery(c, "end_time")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	alerts, err := h.svc.GetAlerts(c.Request.Context(), tenantID, userID, startTime, endTime, page, ps)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": alerts, "meta": gin.H{"total": len(alerts)}})
}

// GetAlert — GET /api/v1/ai/security/alerts/:id
func (h *Handler) GetAlert(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	alert, err := h.svc.GetAlert(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{
		"id":          alert.ID,
		"timestamp":   alert.ScannedAt,
		"user_id":     alert.UserID,
		"session_id":  alert.SessionID,
		"risk_score":  alert.RiskScore,
		"violations":  alert.Violations,
	})
}

func parseTimeQuery(c *gin.Context, key string) *time.Time {
	raw := c.Query(key)
	if raw == "" {
		return nil
	}
	t, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		return nil
	}
	return &t
}