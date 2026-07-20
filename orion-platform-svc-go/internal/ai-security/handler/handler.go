package handler

import (
	"context"
	"fmt"
	"net/http"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/ai-security/models"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// BLUEPRINT STATUS: This module provides the CRUD skeleton and route definitions for
// AI security features (policy management, audit logging, access blocking, risk scoring).
// Vulnerability / CVE scanning endpoints (Scan, GetVuln, ListVulns, Fix, Check) now call
// real service methods that delegate to the repository's Trivy wrappers.
// Core security functions (prompt injection detection, PII filtering, content safety scoring)
// return placeholder responses and require integration with an AI security engine.

// Service defines the contract the handler needs from the service layer (for testability).
type Service interface {
	List(ctx context.Context, tenantID string) ([]models.Record, error)
	Get(ctx context.Context, tenantID, id string) (*models.Record, error)
	Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error)
	Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error)
	Delete(ctx context.Context, tenantID, id string) error
	ScanVulnerabilities(ctx context.Context, tenantID, image string) (*models.ScanVulnerabilitiesResult, error)
	GetVulnerability(ctx context.Context, tenantID, cveID string) (*models.Vulnerability, error)
	ListVulnerabilities(ctx context.Context, tenantID string) ([]models.Vulnerability, error)
	FixVulnerability(ctx context.Context, tenantID, image string, cveIDs []string) (*models.FixVulnerabilityResult, error)
	CheckVulnerability(ctx context.Context, tenantID, cveID string) (*models.CheckVulnerabilityResult, error)
	ListPolicies(ctx context.Context, tenantID string) ([]string, error)
	GetAuditLog(ctx context.Context, tenantID string) ([]string, error)
	BlockAccess(ctx context.Context, tenantID, target string) (gin.H, error)
	GetRiskScore(ctx context.Context, tenantID, id string) (gin.H, error)
}

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/ai-security")
	r.GET("", auth.RequirePermission("ai-security", "read"), h.List)
	r.GET("/:id", auth.RequirePermission("ai-security", "read"), h.Get)
	r.POST("", auth.RequirePermission("ai-security", "write"), h.Create)
	r.PUT("/:id", auth.RequirePermission("ai-security", "write"), h.Update)
	r.DELETE("/:id", auth.RequirePermission("ai-security", "delete"), h.Delete)

	// Vulnerability / CVE scanning routes
	r.POST("/vulns/scan", auth.RequirePermission("ai-security", "write"), h.ScanVulnerabilities)
	r.GET("/vulns", auth.RequirePermission("ai-security", "read"), h.ListVulnerabilities)
	r.GET("/vulns/:cveId", auth.RequirePermission("ai-security", "read"), h.GetVulnerability)
	r.POST("/vulns/:cveId/fix", auth.RequirePermission("ai-security", "write"), h.FixVulnerability)
	r.GET("/vulns/check", auth.RequirePermission("ai-security", "read"), h.CheckVulnerability)

	// AI Security-specific routes
	r.GET("/policies", auth.RequirePermission("ai-security", "read"), h.ListPolicies)
	r.GET("/audit", auth.RequirePermission("ai-security", "read"), h.GetAuditLog)
	r.POST("/block", auth.RequirePermission("ai-security", "write"), h.BlockAccess)
	r.GET("/score/:id", auth.RequirePermission("ai-security", "read"), h.GetRiskScore)
}

// ---- Core CRUD ----

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	q := models.ListQuery{}
	if p := c.Query("page"); p != "" {
		fmt.Sscanf(p, "%d", &q.Page)
	}
	if l := c.Query("limit"); l != "" {
		fmt.Sscanf(l, "%d", &q.Limit)
	}
	records, err := h.svc.List(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": records, "total": len(records)})
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	record, err := h.svc.Get(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "not found", http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, record)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		er := "invalid request"
		errors.WriteError(c, errors.ErrBadRequest, er, http.StatusBadRequest)
		return
	}
	record, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": record})
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	record, err := h.svc.Update(ctx, tenantID, c.Param("id"), req)
	if err != nil {
		er := err.Error()
		errors.WriteError(c, errors.ErrInternal, er, http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, record)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	err := h.svc.Delete(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, nil)
}

// ---- Vulnerability / CVE scanning ----

func (h *Handler) ScanVulnerabilities(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ScanVulnerabilities")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.VulnerabilityScanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	result, err := h.svc.ScanVulnerabilities(ctx, tenantID, req.Image)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) GetVulnerability(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetVulnerability")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	cveID := c.Param("cveId")
	vuln, err := h.svc.GetVulnerability(ctx, tenantID, cveID)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "CVE not found", http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, vuln)
}

func (h *Handler) ListVulnerabilities(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListVulnerabilities")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	vulns, err := h.svc.ListVulnerabilities(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": vulns, "total": len(vulns)})
}

func (h *Handler) FixVulnerability(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "FixVulnerability")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.FixVulnerabilityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	result, err := h.svc.FixVulnerability(ctx, tenantID, req.Image, req.CVEIDs)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) CheckVulnerability(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CheckVulnerability")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	cveID := c.Query("cveId")
	if cveID == "" {
		errors.WriteError(c, errors.ErrBadRequest, "cveId query parameter required", http.StatusBadRequest)
		return
	}
	result, err := h.svc.CheckVulnerability(ctx, tenantID, cveID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, result)
}

// ---- AI Security-specific endpoints (placeholders) ----

func (h *Handler) ListPolicies(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListPolicies")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	policies, err := h.svc.ListPolicies(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": policies, "total": len(policies)})
}

func (h *Handler) GetAuditLog(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAuditLog")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	logs, err := h.svc.GetAuditLog(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"logs": logs, "total": len(logs)})
}

func (h *Handler) BlockAccess(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "BlockAccess")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	target := c.Query("target")
	if target == "" {
		target = c.Param("target")
	}
	result, err := h.svc.BlockAccess(ctx, tenantID, target)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) GetRiskScore(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRiskScore")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.GetRiskScore(ctx, tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, result)
}
