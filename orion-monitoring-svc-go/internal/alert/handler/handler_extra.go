package handler

import (
	"net/http"
	"orion/monitoring-svc-go/internal/alert/models"

	"github.com/gin-gonic/gin"
)

// EscalateAlert raises an alert's severity.
func (h *Handler) EscalateAlert(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	var req models.EscalateAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	alert, err := h.svc.EscalateAlert(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, alert)
}

// SuppressAlertRule marks a rule as suppressed.
func (h *Handler) SuppressAlertRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	var req struct {
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&req)
	result, err := h.svc.SuppressRule(c.Request.Context(), tenantID, c.Param("id"), req.Reason)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// UnsuppressAlertRule re-enables a suppressed rule.
func (h *Handler) UnsuppressAlertRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	result, err := h.svc.UnsuppressRule(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// EvaluateAlertRule triggers a manual rule evaluation.
func (h *Handler) EvaluateAlertRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	result, err := h.svc.EvaluateRule(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// CreateAlertRule creates a new alert rule.
func (h *Handler) CreateAlertRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	var req models.CreateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	rule, err := h.svc.CreateRule(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, rule)
}

// ListAlertRules lists alert rules for the tenant.
func (h *Handler) ListAlertRules(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	resp, err := h.svc.ListRules(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": resp.Data, "total": resp.Total})
}

// GetAlertRule retrieves a rule by ID.
func (h *Handler) GetAlertRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	rule, err := h.svc.GetRule(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, "rule not found")
		return
	}
	respondSuccess(c, rule)
}

// UpdateAlertRule updates an existing rule.
func (h *Handler) UpdateAlertRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	var req models.UpdateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.UpdateRule(c.Request.Context(), tenantID, c.Param("id"), &req); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "rule updated"})
}

// DeleteAlertRule removes a rule.
func (h *Handler) DeleteAlertRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	if err := h.svc.DeleteRule(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	c.Status(http.StatusNoContent)
}

// StartService marks a service as running.
func (h *Handler) StartService(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	svcName := c.Param("id")
	if svcName == "" {
		respondBadRequest(c, "service name is required")
		return
	}
	inst, err := h.svc.StartService(c.Request.Context(), tenantID, svcName)
	if err != nil {
		respondNotFound(c, "service not found")
		return
	}
	respondSuccess(c, inst)
}

// StopService marks a service as stopped.
func (h *Handler) StopService(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	svcName := c.Param("id")
	if svcName == "" {
		respondBadRequest(c, "service name is required")
		return
	}
	inst, err := h.svc.StopService(c.Request.Context(), tenantID, svcName)
	if err != nil {
		respondNotFound(c, "service not found")
		return
	}
	respondSuccess(c, inst)
}

// GetServiceHealth returns the health status of a service.
func (h *Handler) GetServiceHealth(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	svcName := c.Param("id")
	if svcName == "" {
		respondBadRequest(c, "service name is required")
		return
	}
	health, err := h.svc.GetServiceHealth(c.Request.Context(), tenantID, svcName)
	if err != nil {
		respondNotFound(c, "service not found")
		return
	}
	respondSuccess(c, health)
}
