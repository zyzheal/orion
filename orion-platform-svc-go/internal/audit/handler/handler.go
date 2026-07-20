package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/audit/models"
	"orion/platform-svc-go/internal/audit/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel/trace"
)

// Service defines the contract the handler needs from the service layer.
type Service interface {
	List(ctx context.Context, tenantID string, q models.AuditLogQuery) (*models.AuditLogListResult, error)
	Get(ctx context.Context, tenantID, id string) (*models.AuditLogEntry, error)
	Create(ctx context.Context, tenantID string, req models.AuditLogCreateRequest) (*models.AuditLogEntry, error)
	VerifySingle(ctx context.Context, tenantID, id string) (*models.AuditLogEntry, bool, error)
	VerifyChain(ctx context.Context, tenantID string) (*models.ChainVerifyResult, error)
	GetActions(ctx context.Context, tenantID string) ([]string, error)
	GetResourceTypes(ctx context.Context, tenantID string) ([]string, error)
	ComplianceReport(ctx context.Context, tenantID string, framework string) (*models.ComplianceReport, error)
	CoverageStats(ctx context.Context, tenantID string) (*models.AuditCoverageStats, error)
	ChainInfo(ctx context.Context, tenantID string) (*models.ChainInfo, error)
	StorageStats(ctx context.Context, tenantID string) (*models.StorageStats, error)
	Export(ctx context.Context, tenantID string, q models.AuditLogQuery) (*models.AuditLogExportResult, error)
}

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all audit endpoints under /api/v1/audit.
// Mirrors /api/v1/audit from the TS source (20 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/audit")

	// --- Audit log CRUD ---
	// GET /audit/logs - List audit logs (paginated)
	f.GET("/logs", auth.RequirePermission("audit", "read"), h.ListLogs)
	// GET /audit/logs/:id - Get audit log by ID
	f.GET("/logs/:id", auth.RequirePermission("audit", "read"), h.GetLog)
	// POST /audit/logs - Create audit log
	f.POST("/logs", auth.RequirePermission("audit", "write"), h.CreateLog)
	// GET /audit/logs/:id/verify - Verify single audit log
	f.GET("/logs/:id/verify", auth.RequirePermission("audit", "read"), h.VerifySingle)

	// --- Chain verification ---
	// POST /audit/verify - Verify entire chain
	f.POST("/verify", auth.RequirePermission("audit", "read"), h.VerifyChain)

	// --- Metadata ---
	// GET /audit/actions - Get distinct actions
	f.GET("/actions", auth.RequirePermission("audit", "read"), h.Actions)
	// GET /audit/resource-types - Get distinct resource types
	f.GET("/resource-types", auth.RequirePermission("audit", "read"), h.ResourceTypes)

	// --- Compliance reporting ---
	// GET /audit/compliance/soc2 - SOC2 Type II compliance report
	f.GET("/compliance/soc2", auth.RequirePermission("audit", "read"), h.ComplianceSOC2)
	// GET /audit/compliance/iso27001 - ISO27001 compliance report
	f.GET("/compliance/iso27001", auth.RequirePermission("audit", "read"), h.ComplianceISO27001)
	// GET /audit/compliance/combined - Combined SOC2 + ISO27001 report
	f.GET("/compliance/combined", auth.RequirePermission("audit", "read"), h.ComplianceCombined)
	// GET /audit/compliance/coverage - Audit coverage statistics
	f.GET("/compliance/coverage", auth.RequirePermission("audit", "read"), h.ComplianceCoverage)
	// POST /audit/compliance/check - Run all compliance checks
	rg.POST("/audit/compliance/check", auth.RequirePermission("audit", "read"), h.ComplianceCheck)

	// --- Compatibility endpoints ---
	// GET /audit/chain/info - Chain info (frontend compatibility)
	f.GET("/chain/info", auth.RequirePermission("audit", "read"), h.ChainInfo)
	// GET /audit/storage/stats - Storage stats (frontend compatibility)
	f.GET("/storage/stats", auth.RequirePermission("audit", "read"), h.StorageStats)
	// POST /audit/storage/flush - Flush storage (no-op for PostgreSQL)
	f.POST("/storage/flush", auth.RequirePermission("audit", "manage"), h.StorageFlush)
	// GET /audit/chain/genesis - Genesis hash
	f.GET("/chain/genesis", auth.RequirePermission("audit", "read"), h.ChainGenesis)
	// GET /audit/chain/latest - Latest entry
	f.GET("/chain/latest", auth.RequirePermission("audit", "read"), h.ChainLatest)

	// --- Export ---
	// GET /audit/logs/export - Export audit logs (CSV/JSON)
	f.GET("/logs/export", auth.RequirePermission("audit", "read"), h.ExportLogs)
	// POST /audit/export - Export audit logs as CSV (body params)
	rg.POST("/audit/export", auth.RequirePermission("audit", "read"), h.ExportCSV)
	// POST /audit/export/json - Export audit logs as JSON (body params)
	rg.POST("/audit/export/json", auth.RequirePermission("audit", "read"), h.ExportJSON)
}

// --- Audit log CRUD ---

func (h *Handler) ListLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListLogs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	q := parseAuditQuery(c, tenantID)
	result, err := h.svc.List(ctx, tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) GetLog(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetLog")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	entry, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "audit log not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, entry)
}

func (h *Handler) CreateLog(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateLog")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.AuditLogCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	entry, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"entry": entry})
}

func (h *Handler) VerifySingle(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VerifySingle")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	entry, valid, err := h.svc.VerifySingle(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "audit log not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"entry":   entry,
		"isValid": valid,
	})
}

// --- Chain verification ---

func (h *Handler) VerifyChain(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VerifyChain")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var body struct {
		TenantID string `json:"tenantId"`
	}
	c.ShouldBindJSON(&body)
	if body.TenantID != "" {
		tenantID = body.TenantID
	}
	result, err := h.svc.VerifyChain(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"result":     result,
		"verifiedAt": result.VerifiedAt,
	})
}

// --- Metadata ---

func (h *Handler) Actions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Actions")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tid := c.Query("tenantId"); tid != "" {
		tenantID = tid
	}
	actions, err := h.svc.GetActions(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"actions": actions})
}

func (h *Handler) ResourceTypes(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ResourceTypes")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tid := c.Query("tenantId"); tid != "" {
		tenantID = tid
	}
	resourceTypes, err := h.svc.GetResourceTypes(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"resourceTypes": resourceTypes})
}

// --- Compliance reporting ---

func (h *Handler) ComplianceSOC2(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ComplianceSOC2")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tid := c.Query("tenantId"); tid != "" {
		tenantID = tid
	}
	report, err := h.svc.ComplianceReport(ctx, tenantID, "SOC2")
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, report)
}

func (h *Handler) ComplianceISO27001(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ComplianceISO27001")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tid := c.Query("tenantId"); tid != "" {
		tenantID = tid
	}
	report, err := h.svc.ComplianceReport(ctx, tenantID, "ISO27001")
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, report)
}

func (h *Handler) ComplianceCombined(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ComplianceCombined")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tid := c.Query("tenantId"); tid != "" {
		tenantID = tid
	}
	report, err := h.svc.ComplianceReport(ctx, tenantID, "COMBINED")
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, report)
}

func (h *Handler) ComplianceCoverage(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ComplianceCoverage")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tid := c.Query("tenantId"); tid != "" {
		tenantID = tid
	}
	stats, err := h.svc.CoverageStats(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

func (h *Handler) ComplianceCheck(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ComplianceCheck")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var body struct {
		TenantID  string `json:"tenantId"`
		Framework string `json:"framework"`
	}
	c.ShouldBindJSON(&body)
	if body.TenantID != "" {
		tenantID = body.TenantID
	}
	if body.Framework == "" {
		body.Framework = "COMBINED"
	}
	report, err := h.svc.ComplianceReport(ctx, tenantID, body.Framework)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, report)
}

// --- Compatibility endpoints ---

func (h *Handler) ChainInfo(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ChainInfo")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tid := c.Query("tenantId"); tid != "" {
		tenantID = tid
	}
	info, err := h.svc.ChainInfo(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, info)
}

func (h *Handler) StorageStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StorageStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tid := c.Query("tenantId"); tid != "" {
		tenantID = tid
	}
	stats, err := h.svc.StorageStats(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"stats": stats})
}

func (h *Handler) StorageFlush(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StorageFlush")
	defer span.End()
	// PostgreSQL doesn't need flush — data is already persisted
	middleware.RespondSuccess(c, gin.H{
		"status":  "noop",
		"message": "PostgreSQL storage does not require flush",
	})
}

func (h *Handler) ChainGenesis(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ChainGenesis")
	defer span.End()
	middleware.RespondSuccess(c, gin.H{
		"genesisHash": service.GenesisHash,
	})
}

func (h *Handler) ChainLatest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ChainLatest")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tid := c.Query("tenantId"); tid != "" {
		tenantID = tid
	}
	result, err := h.svc.List(ctx, tenantID, models.AuditLogQuery{Limit: 1})
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if result.Total == 0 {
		middleware.RespondNotFound(c, "no audit logs found")
		return
	}
	middleware.RespondSuccess(c, result.Entries[0])
}

// --- Export ---

func (h *Handler) ExportLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExportLogs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	q := parseAuditQuery(c, tenantID)
	if format := c.Query("format"); format != "" {
		q.Format = format
	} else {
		q.Format = "json"
	}
	result, err := h.svc.Export(ctx, tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	contentType := "application/json"
	if q.Format == "csv" {
		contentType = "text/csv"
	}
	c.Header("Content-Type", contentType)
	c.Header("Content-Disposition", `attachment; filename="`+result.Filename+`"`)
	c.String(200, result.Content)
}

func (h *Handler) ExportCSV(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExportCSV")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var body struct {
		TenantID     string `json:"tenantId"`
		UserID       string `json:"userId"`
		Action       string `json:"action"`
		ResourceType string `json:"resourceType"`
		ResourceID   string `json:"resourceId"`
		DateFrom     string `json:"dateFrom"`
		DateTo       string `json:"dateTo"`
	}
	c.ShouldBindJSON(&body)
	if body.TenantID != "" {
		tenantID = body.TenantID
	}
	result, err := h.svc.Export(ctx, tenantID, models.AuditLogQuery{
		TenantID:     tenantID,
		UserID:       body.UserID,
		Action:       body.Action,
		ResourceType: body.ResourceType,
		ResourceID:   body.ResourceID,
		DateFrom:     body.DateFrom,
		DateTo:       body.DateTo,
		Format:       "csv",
	})
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", `attachment; filename="`+result.Filename+`"`)
	c.String(200, result.Content)
}

func (h *Handler) ExportJSON(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExportJSON")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var body struct {
		TenantID     string `json:"tenantId"`
		UserID       string `json:"userId"`
		Action       string `json:"action"`
		ResourceType string `json:"resourceType"`
		ResourceID   string `json:"resourceId"`
		DateFrom     string `json:"dateFrom"`
		DateTo       string `json:"dateTo"`
	}
	c.ShouldBindJSON(&body)
	if body.TenantID != "" {
		tenantID = body.TenantID
	}
	result, err := h.svc.Export(ctx, tenantID, models.AuditLogQuery{
		TenantID:     tenantID,
		UserID:       body.UserID,
		Action:       body.Action,
		ResourceType: body.ResourceType,
		ResourceID:   body.ResourceID,
		DateFrom:     body.DateFrom,
		DateTo:       body.DateTo,
		Format:       "json",
	})
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", `attachment; filename="`+result.Filename+`"`)
	c.String(200, result.Content)
}

// parseAuditQuery extracts audit query parameters from the request context.
func parseAuditQuery(c *gin.Context, tenantID string) models.AuditLogQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	return models.AuditLogQuery{
		TenantID:     tenantID,
		UserID:       c.Query("userId"),
		Action:       c.Query("action"),
		ResourceType: c.Query("resourceType"),
		ResourceID:   c.Query("resourceId"),
		DateFrom:     c.Query("dateFrom"),
		DateTo:       c.Query("dateTo"),
		Page:         page,
		Limit:        limit,
	}
}
