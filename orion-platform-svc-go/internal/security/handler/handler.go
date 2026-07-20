package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/security/models"
	"orion/platform-svc-go/internal/security/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

type Service interface {
	GetVulnerabilityReport(ctx context.Context, tenantID string, opt models.ListVulnerabilitiesOptions) (*models.VulnerabilityReport, error)
	ScanImage(ctx context.Context, tenantID, imagePath string) (*models.ScanResult, error)
	ScanDependencies(ctx context.Context, tenantID, projectPath string) (*models.ScanResult, error)
	CheckVulnerability(ctx context.Context, tenantID, id string) (*models.Vulnerability, error)
	RemediateVulnerability(ctx context.Context, tenantID, cveID, packageName string, req models.RemediateVulnerabilityRequest) (*models.Vulnerability, error)
}

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/security/vulnerabilities")

	// GET /api/v1/security/vulnerabilities — list vulnerabilities for current tenant
	r.GET("",
		auth.RequirePermission("security", "read"),
		h.ListVulnerabilities)

	// POST /api/v1/security/vulnerabilities/scan — trigger dependency CVE scan
	r.POST("/scan",
		auth.RequirePermission("security", "write"),
		h.TriggerScan)

	// POST /api/v1/security/vulnerabilities/scan-image — trigger Docker image vulnerability scan
	r.POST("/scan-image",
		auth.RequirePermission("security", "write"),
		h.TriggerImageScan)

	// GET /api/v1/security/vulnerabilities/:id — get specific vulnerability details
	r.GET("/:id",
		auth.RequirePermission("security", "read"),
		h.GetVulnerability)

	// POST /api/v1/security/vulnerabilities/:id/remediate — remediate/dismiss a vulnerability
	r.POST("/:id/remediate",
		auth.RequirePermission("security", "write"),
		h.Remediate)
}

// ListVulnerabilities lists vulnerabilities for the current tenant.
func (h *Handler) ListVulnerabilities(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()

	opt := models.ListVulnerabilitiesOptions{}
	if severity := c.Query("severity"); severity != "" {
		opt.Severity = models.VulnerabilitySeverity(severity)
	}
	if limitStr := c.Query("limit"); limitStr != "" {
		opt.Limit, _ = strconv.Atoi(limitStr)
	}
	if offsetStr := c.Query("offset"); offsetStr != "" {
		opt.Offset, _ = strconv.Atoi(offsetStr)
	}
	if pageStr := c.Query("page"); pageStr != "" {
		opt.Page, _ = strconv.Atoi(pageStr)
	}
	if opt.Page <= 0 {
		opt.Page = 1
	}
	if opt.Limit <= 0 || opt.Limit > 100 {
		opt.Limit = 20
	}

	report, err := h.svc.GetVulnerabilityReport(ctx, tenantID, opt)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	middleware.RespondSuccess(c, gin.H{
		"data": report.Vulnerabilities,
		"meta": gin.H{
			"total":          report.TotalVulnerabilities,
			"bySeverity":     report.BySeverity,
			"byStatus":       report.ByStatus,
			"openCritical":   report.OpenCritical,
			"openHigh":       report.OpenHigh,
		},
	})
}

// TriggerScan triggers a dependency vulnerability scan.
func (h *Handler) TriggerScan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()

	var req models.ScanVulnerabilitiesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	result, err := h.svc.ScanDependencies(ctx, tenantID, req.ProjectPath)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	middleware.RespondCreated(c, result)
}

// TriggerImageScan triggers a Docker image vulnerability scan using Trivy.
func (h *Handler) TriggerImageScan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()

	var req models.ScanVulnerabilitiesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.ProjectPath == "" {
		middleware.RespondBadRequest(c, "missing required field: projectPath (image name/ID)")
		return
	}

	result, err := h.svc.ScanImage(ctx, tenantID, req.ProjectPath)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	middleware.RespondCreated(c, result)
}

// GetVulnerability retrieves details for a specific vulnerability.
func (h *Handler) GetVulnerability(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	id := c.Param("id")

	vuln, err := h.svc.CheckVulnerability(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "vulnerability not found")
		return
	}

	middleware.RespondSuccess(c, gin.H{
		"id":             vuln.ID,
		"cveId":          vuln.CVEID,
		"packageName":    vuln.PackageName,
		"packageVersion": vuln.PackageVersion,
		"severity":       vuln.Severity,
		"description":    vuln.Description,
		"fixVersion":     vuln.FixVersion,
		"status":         vuln.Status,
		"detectedAt":     vuln.DetectedAt,
	})
}

// Remediate marks a vulnerability as remediated, ignored, or false_positive.
func (h *Handler) Remediate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	id := c.Param("id")

	var req models.RemediateVulnerabilityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	if req.Action == "" {
		middleware.RespondBadRequest(c, "missing required field: action (remediate | ignore | false_positive)")
		return
	}

	// Parse the ID — could be "cveId:packageName" format or just CVE
	cveID := id
	packageName := ""
	if colonIdx := lastColon(id); colonIdx != -1 {
		cveID = id[:colonIdx]
		packageName = id[colonIdx+1:]
	}

	vuln, err := h.svc.RemediateVulnerability(ctx, tenantID, cveID, packageName, req)
	if err != nil {
		switch {
		case err.Error() == service.ErrNotFound.Error():
			middleware.RespondNotFound(c, "vulnerability not found")
		case err.Error() == service.ErrInvalidInput.Error() || len(err.Error()) > len(service.ErrInvalidInput.Error()) && err.Error()[:len(service.ErrInvalidInput.Error())] == service.ErrInvalidInput.Error():
			middleware.RespondBadRequest(c, err.Error())
		default:
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}

	middleware.RespondSuccess(c, gin.H{
		"id":          vuln.ID,
		"cveId":       vuln.CVEID,
		"packageName": vuln.PackageName,
		"status":      vuln.Status,
		"updatedAt":   vuln.UpdatedAt,
	})
}

// lastColon returns the index of the last colon in the string, or -1 if none.
func lastColon(s string) int {
	idx := -1
	for i := 0; i < len(s); i++ {
		if s[i] == ':' {
			idx = i
		}
	}
	return idx
}
