package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/governance/models"
	"orion/platform-svc-go/internal/governance/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel/trace"
)

// Service defines the methods the handler calls on the governance service.
type Service interface {
	CreatePolicy(ctx context.Context, req *models.CreatePolicyRequest, tenantID, userID string) (*models.GovernancePolicy, error)
	GetPolicy(ctx context.Context, id, tenantID string) (*models.GovernancePolicy, error)
	ListPolicies(ctx context.Context, tenantID string, q *models.PolicyListQuery, offset, limit int) ([]models.GovernancePolicy, int, error)
	UpdatePolicy(ctx context.Context, id, tenantID string, req *models.UpdatePolicyRequest, userID string) (*models.GovernancePolicy, error)
	DeletePolicy(ctx context.Context, id, tenantID string, userID string) error
	EnablePolicy(ctx context.Context, id, tenantID string, userID string) (*models.GovernancePolicy, error)
	DisablePolicy(ctx context.Context, id, tenantID string, userID string) (*models.GovernancePolicy, error)
	GetAuditLogs(ctx context.Context, policyID string, offset, limit int) ([]models.GovernanceAuditLog, int, error)
	CheckCompliance(ctx context.Context, req *models.ComplianceCheckRequest, tenantID string) (*models.ComplianceCheckResponse, error)
	GetComplianceReport(ctx context.Context, tenantID string, period *models.CompliancePeriod) (*models.ComplianceReport, error)
	ApplyPolicy(ctx context.Context, id, tenantID string, req *models.ApplyPolicyRequest, userID string) (*models.PolicyApplyResult, error)
	GetRules(ctx context.Context, tenantID string, offset, limit int) ([]models.PolicyRule, int, error)
}

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all governance endpoints under the given group.
// Mirrors 14 endpoints from the TS source.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/governance")

	// GET /governance/rules - Get rule list (global)
	f.GET("/rules", auth.RequirePermission("governance", "read"), h.GetRules)

	// GET /governance/compliance - Get compliance report
	f.GET("/compliance", auth.RequirePermission("governance", "read"), h.GetComplianceReport)

	// POST /governance/check - Check compliance
	f.POST("/check", auth.RequirePermission("governance", "write"), h.CheckCompliance)

	// GET /governance - Get policy list
	f.GET("", auth.RequirePermission("governance", "read"), h.ListPolicies)

	// POST /governance - Create policy
	f.POST("", auth.RequirePermission("governance", "write"), h.CreatePolicy)

	// GET /governance/:id - Get policy detail
	f.GET("/:id", auth.RequirePermission("governance", "read"), h.GetPolicy)

	// PUT /governance/:id - Update policy
	f.PUT("/:id", auth.RequirePermission("governance", "write"), h.UpdatePolicy)

	// DELETE /governance/:id - Delete policy
	f.DELETE("/:id", auth.RequirePermission("governance", "delete"), h.DeletePolicy)

	// POST /governance/:id/enable - Enable policy
	f.POST("/:id/enable", auth.RequirePermission("governance", "write"), h.EnablePolicy)

	// POST /governance/:id/disable - Disable policy
	f.POST("/:id/disable", auth.RequirePermission("governance", "write"), h.DisablePolicy)

	// GET /governance/:id/audit - Get audit logs
	f.GET("/:id/audit", auth.RequirePermission("governance", "read"), h.GetAuditLogs)

	// POST /governance/:id/apply - Apply policy to resource
	f.POST("/:id/apply", auth.RequirePermission("governance", "write"), h.ApplyPolicy)
}

// ---- Policy handlers ----

func (h *Handler) CreatePolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreatePolicy")
	defer span.End()
	var req models.CreatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	userID := h.getUserID(c)
	p, err := h.svc.CreatePolicy(ctx, &req, tenantID, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, h.policyToResponse(p))
}

func (h *Handler) ListPolicies(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListPolicies")
	defer span.End()
	tenantID := h.getTenantID(c)
	q := &models.PolicyListQuery{
		Type:     c.Query("type"),
		Status:   c.Query("status"),
		Severity: c.Query("severity"),
	}
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	policies, total, err := h.svc.ListPolicies(ctx, tenantID, q, offset, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	data := make([]models.PolicyResponse, len(policies))
	for i, p := range policies {
		data[i] = h.policyToResponse(&p)
	}
	middleware.RespondSuccess(c, gin.H{
		"data":   data,
		"total":  total,
		"offset": offset,
		"limit":  limit,
	})
}

func (h *Handler) GetPolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetPolicy")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	p, err := h.svc.GetPolicy(ctx, id, tenantID)
	if err != nil {
		middleware.RespondNotFound(c, "Policy not found")
		return
	}
	middleware.RespondSuccess(c, h.policyToResponse(p))
}

func (h *Handler) UpdatePolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdatePolicy")
	defer span.End()
	id := c.Param("id")
	var req models.UpdatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	userID := h.getUserID(c)
	p, err := h.svc.UpdatePolicy(ctx, id, tenantID, &req, userID)
	if err != nil {
		middleware.RespondNotFound(c, "Policy not found")
		return
	}
	middleware.RespondSuccess(c, h.policyToResponse(p))
}

func (h *Handler) DeletePolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeletePolicy")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	userID := h.getUserID(c)
	err := h.svc.DeletePolicy(ctx, id, tenantID, userID)
	if err != nil {
		middleware.RespondNotFound(c, "Policy not found")
		return
	}
	c.AbortWithStatus(http.StatusNoContent)
}

// ---- Enable / Disable handlers ----

func (h *Handler) EnablePolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EnablePolicy")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	userID := h.getUserID(c)
	p, err := h.svc.EnablePolicy(ctx, id, tenantID, userID)
	if err != nil {
		middleware.RespondNotFound(c, "Policy not found")
		return
	}
	middleware.RespondSuccess(c, h.policyToResponse(p))
}

func (h *Handler) DisablePolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DisablePolicy")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	userID := h.getUserID(c)
	p, err := h.svc.DisablePolicy(ctx, id, tenantID, userID)
	if err != nil {
		middleware.RespondNotFound(c, "Policy not found")
		return
	}
	middleware.RespondSuccess(c, h.policyToResponse(p))
}

// ---- Audit Logs handler ----

func (h *Handler) GetAuditLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAuditLogs")
	defer span.End()
	id := c.Param("id")
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	logs, total, err := h.svc.GetAuditLogs(ctx, id, offset, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	data := make([]models.AuditLogResponse, len(logs))
	for i, log := range logs {
		details := map[string]any{}
		_ = json.Unmarshal([]byte(log.Details), &details)
		data[i] = models.AuditLogResponse{
			ID:           log.ID,
			PolicyID:     log.PolicyID,
			Timestamp:    log.Timestamp.Format(time.RFC3339),
			Action:       log.Action,
			ResourceType: log.ResourceType,
			ResourceID:   log.ResourceID,
			UserID:       log.UserID,
			Details:      details,
			Outcome:      log.Outcome,
			Severity:     log.Severity,
		}
	}
	middleware.RespondSuccess(c, gin.H{
		"data":   data,
		"total":  total,
		"offset": offset,
		"limit":  limit,
	})
}

// ---- Compliance Check handler ----

func (h *Handler) CheckCompliance(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CheckCompliance")
	defer span.End()
	var req models.ComplianceCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	result, err := h.svc.CheckCompliance(ctx, &req, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// ---- Compliance Report handler ----

func (h *Handler) GetComplianceReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetComplianceReport")
	defer span.End()
	tenantID := h.getTenantID(c)
	period := (*models.CompliancePeriod)(nil)
	start := c.Query("start")
	end := c.Query("end")
	if start != "" || end != "" {
		period = &models.CompliancePeriod{Start: start, End: end}
	}
	report, err := h.svc.GetComplianceReport(ctx, tenantID, period)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, report)
}

// ---- Apply Policy handler ----

func (h *Handler) ApplyPolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ApplyPolicy")
	defer span.End()
	id := c.Param("id")
	var req models.ApplyPolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	userID := h.getUserID(c)
	result, err := h.svc.ApplyPolicy(ctx, id, tenantID, &req, userID)
	if err != nil {
		if err == service.ErrPolicyNotActive {
			middleware.RespondBadRequest(c, "Policy must be active to apply")
			return
		}
		middleware.RespondNotFound(c, "Policy not found")
		return
	}
	middleware.RespondSuccess(c, result)
}

// ---- Rules handler ----

func (h *Handler) GetRules(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRules")
	defer span.End()
	tenantID := h.getTenantID(c)
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	rules, total, err := h.svc.GetRules(ctx, tenantID, offset, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	data := make([]models.PolicyRuleResp, len(rules))
	for i, r := range rules {
		var condition models.PolicyCondition
		_ = json.Unmarshal([]byte(r.Condition), &condition)

		var action models.PolicyActionResp
		_ = json.Unmarshal([]byte(r.Action), &action)
		data[i] = models.PolicyRuleResp{
			ID:          r.ID,
			Name:        r.Name,
			Description: r.Description,
			Condition:   condition,
			Action:      action,
			Priority:    r.Priority,
			Enabled:     r.Enabled,
		}
	}
	middleware.RespondSuccess(c, gin.H{
		"data":   data,
		"total":  total,
		"offset": offset,
		"limit":  limit,
	})
}

// ---- Helpers ----

func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

func (h *Handler) getUserID(c *gin.Context) string {
	userID := c.GetString("user_id")
	if userID == "" {
		return "system"
	}
	return userID
}

// ---- Response conversion ----

// policyToResponse converts a model GovernancePolicy to a response DTO.
func (h *Handler) policyToResponse(p *models.GovernancePolicy) models.PolicyResponse {
	// Parse rules JSON
	var ruleBodies []models.PolicyRuleBody
	rulesResp := []models.PolicyRuleResp{}
	_ = json.Unmarshal([]byte(p.Rules), &ruleBodies)
	for _, rb := range ruleBodies {
		rulesResp = append(rulesResp, models.PolicyRuleResp{
			Name:        rb.Name,
			Description: rb.Description,
			Condition:   rb.Condition,
			Action:      models.PolicyActionResp{Type: rb.Action.Type, Config: rb.Action.Config},
			Priority:    rb.Priority,
			Enabled:     rb.Enabled,
		})
	}

	// Parse scope JSON
	var scope models.PolicyScopeBody
	_ = json.Unmarshal([]byte(p.Scope), &scope)

	// Parse metadata JSON
	var metadata map[string]any
	_ = json.Unmarshal([]byte(p.Metadata), &metadata)

	return models.PolicyResponse{
		ID:             p.ID,
		Name:           p.Name,
		Description:    p.Description,
		Type:           p.Type,
		Status:         p.Status,
		Severity:       p.Severity,
		Rules:          rulesResp,
		Scope:          models.PolicyScopeResp{Include: scope.Include, Exclude: scope.Exclude},
		Enforcement:    p.Enforcement,
		CreatedBy:      p.CreatedBy,
		AppliedCount:   p.AppliedCount,
		ViolationCount: p.ViolationCount,
		Metadata:       metadata,
		CreatedAt:      p.CreatedAt.Format(time.RFC3339),
		UpdatedAt:      p.UpdatedAt.Format(time.RFC3339),
	}
}
