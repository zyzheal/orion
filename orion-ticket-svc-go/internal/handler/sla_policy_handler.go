package handler

import (
	"orion/go-common/pkg/auth"
	"time"

	"github.com/gin-gonic/gin"
	"orion-ticket-svc-go/internal/models"
	"orion-ticket-svc-go/internal/service"
)

type SLAPolicyHandler struct {
	svc *service.SLAPolicyService
}

func NewSLAPolicyHandler(svc *service.SLAPolicyService) *SLAPolicyHandler {
	return &SLAPolicyHandler{svc: svc}
}

func (h *SLAPolicyHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/ticketing/sla/policies", auth.RequirePermission("ticket", "write"), h.CreatePolicy)
	rg.GET("/ticketing/sla/policies", auth.RequirePermission("ticket", "read"), h.ListPolicies)
	rg.GET("/ticketing/sla/policies/:policyId", auth.RequirePermission("ticket", "read"), h.GetPolicy)
	rg.PUT("/ticketing/sla/policies/:policyId", auth.RequirePermission("ticket", "write"), h.UpdatePolicy)
	rg.DELETE("/ticketing/sla/policies/:policyId", auth.RequirePermission("ticket", "delete"), h.DeletePolicy)
	rg.GET("/ticketing/sla/compliance/:policyId", auth.RequirePermission("ticket", "read"), h.GetPolicyCompliance)
	rg.GET("/ticketing/sla/tickets/:ticketId/status", auth.RequirePermission("ticket", "read"), h.GetTicketSLAStatus)
}

func (h *SLAPolicyHandler) CreatePolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateSLAPolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	policy, err := h.svc.Create(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, policy)
}

func (h *SLAPolicyHandler) ListPolicies(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	enabled := c.Query("enabled")
	var enabledFilter *bool
	if enabled != "" {
		val := enabled == "true"
		enabledFilter = &val
	}
	policies, err := h.svc.List(c.Request.Context(), tenantID, enabledFilter)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, policies)
}

func (h *SLAPolicyHandler) GetPolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	policyID := c.Param("policyId")
	policy, err := h.svc.Get(c.Request.Context(), tenantID, policyID)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, policy)
}

func (h *SLAPolicyHandler) UpdatePolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	policyID := c.Param("policyId")
	var req models.UpdateSLAPolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	policy, err := h.svc.Update(c.Request.Context(), tenantID, policyID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, policy)
}

func (h *SLAPolicyHandler) DeletePolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	policyID := c.Param("policyId")
	if err := h.svc.Delete(c.Request.Context(), tenantID, policyID); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *SLAPolicyHandler) GetPolicyCompliance(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	policyID := c.Param("policyId")
	startStr := c.DefaultQuery("start", "")
	endStr := c.DefaultQuery("end", "")
	start, _ := time.Parse(time.RFC3339, startStr)
	end, _ := time.Parse(time.RFC3339, endStr)
	if end.IsZero() {
		end = time.Now().UTC()
	}
	if start.IsZero() {
		start = end.AddDate(0, 0, -30)
	}
	compliance, err := h.svc.GetCompliance(c.Request.Context(), tenantID, policyID, start, end)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, compliance)
}

func (h *SLAPolicyHandler) GetTicketSLAStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("ticketId")
	status, err := h.svc.GetTicketStatus(c.Request.Context(), tenantID, ticketID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, status)
}
