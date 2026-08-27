package handler

import (
	"time"

	"orion/platform-svc-go/internal/code-scan/models"
	"orion/platform-svc-go/internal/middleware"

	"github.com/google/uuid"
	"github.com/gin-gonic/gin"
)

// Handler exposes HTTP endpoints for code security scanning (SAST).
type Handler struct{}

// NewHandler creates a new CodeScan handler.
func NewHandler() *Handler {
	return &Handler{}
}

// RegisterRoutes mounts code-scan routes under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	codeScan := rg.Group("/code-scan")

	codeScan.GET("/scans", h.ListScans)
	codeScan.POST("/scans", h.CreateScan)
	codeScan.GET("/findings", h.ListFindings)
	codeScan.POST("/scans/:id/run", h.RerunScan)
}

func (h *Handler) ListScans(c *gin.Context) {
	middleware.RespondSuccess(c, defaultScans())
}

func (h *Handler) CreateScan(c *gin.Context) {
	var req models.CreateScanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	branch := req.Branch
	if branch == "" {
		branch = "main"
	}

	now := time.Now().UTC()
	scan := models.ScanRecord{
		ID:         "scan-" + uuid.New().String()[:8],
		Target:     req.Target,
		Branch:     branch,
		Status:     "pending",
		TotalVulns: 0,
		StartedAt:  now,
	}
	middleware.RespondCreated(c, scan)
}

func (h *Handler) RerunScan(c *gin.Context) {
	scanID := c.Param("id")
	middleware.RespondSuccess(c, gin.H{
		"id":      scanID,
		"status":  "running",
		"message": "scan rerun initiated",
	})
}

func (h *Handler) ListFindings(c *gin.Context) {
	middleware.RespondSuccess(c, defaultFindings())
}

func defaultScans() []models.ScanRecord {
	now := time.Now().UTC()
	return []models.ScanRecord{
		{ID: "scan-001", Target: "orion-frontend", Branch: "main", Status: "completed", TotalVulns: 12, Critical: 1, High: 3, Medium: 5, Low: 3, Duration: 45, StartedAt: now.Add(-2 * time.Hour)},
		{ID: "scan-002", Target: "orion-platform-svc-go", Branch: "main", Status: "completed", TotalVulns: 7, Critical: 0, High: 2, Medium: 3, Low: 2, Duration: 30, StartedAt: now.Add(-4 * time.Hour)},
		{ID: "scan-003", Target: "orion-agent", Branch: "develop", Status: "completed", TotalVulns: 3, Critical: 0, High: 0, Medium: 1, Low: 2, Duration: 22, StartedAt: now.Add(-6 * time.Hour)},
		{ID: "scan-004", Target: "shared-lib", Branch: "main", Status: "running", TotalVulns: 0, Critical: 0, High: 0, Medium: 0, Low: 0, Duration: 0, StartedAt: now.Add(-10 * time.Minute)},
		{ID: "scan-005", Target: "orion-frontend", Branch: "release/v2.0", Status: "completed", TotalVulns: 18, Critical: 2, High: 5, Medium: 7, Low: 4, Duration: 60, StartedAt: now.Add(-24 * time.Hour)},
	}
}

func defaultFindings() []models.VulnFinding {
	return []models.VulnFinding{
		{ID: "vuln-001", Category: "injection", Severity: "critical", File: "src/api/user.ts", Line: 45, Description: "SQL injection via unsanitised user input in search query", Fix: "Use parameterised queries", ScanID: "scan-001"},
		{ID: "vuln-002", Category: "xss", Severity: "high", File: "src/pages/Dashboard.tsx", Line: 128, Description: "Reflected XSS in dashboard widget title via innerHTML", Fix: "Use sanitised rendering", ScanID: "scan-001"},
		{ID: "vuln-003", Category: "auth", Severity: "high", File: "internal/auth/middleware.go", Line: 67, Description: "JWT token not validated against revocation list", Fix: "Check token revocation status", ScanID: "scan-002"},
		{ID: "vuln-004", Category: "sensitive_data", Severity: "medium", File: "src/config/env.ts", Line: 23, Description: "API key hardcoded in client-side source code", Fix: "Move secrets to environment variables", ScanID: "scan-001"},
		{ID: "vuln-005", Category: "security_misconfig", Severity: "medium", File: "nginx.conf", Line: 15, Description: "CORS allows wildcard origin in production", Fix: "Restrict CORS to trusted domains", ScanID: "scan-001"},
		{ID: "vuln-006", Category: "aam", Severity: "high", File: "internal/permission/handler.go", Line: 92, Description: "Missing tenant isolation check in batch API", Fix: "Add tenant_id verification", ScanID: "scan-002"},
		{ID: "vuln-007", Category: "vulnerable_components", Severity: "medium", File: "package.json", Line: 45, Description: "lodash@4.17.15 has known prototype pollution", Fix: "Upgrade lodash to >= 4.17.21", ScanID: "scan-001"},
		{ID: "vuln-008", Category: "logging", Severity: "low", File: "internal/logging/handler.go", Line: 34, Description: "Sensitive fields not redacted from error logs", Fix: "Apply log sanitisation filter", ScanID: "scan-003"},
		{ID: "vuln-009", Category: "integrity", Severity: "medium", File: "internal/artifact/verify.go", Line: 56, Description: "Artifact integrity check skips verification when checksum missing", Fix: "Require checksum verification", ScanID: "scan-005"},
		{ID: "vuln-010", Category: "csrf", Severity: "medium", File: "src/pages/Settings.tsx", Line: 89, Description: "Form submission lacks CSRF token validation", Fix: "Include CSRF token in form submissions", ScanID: "scan-005"},
	}
}
