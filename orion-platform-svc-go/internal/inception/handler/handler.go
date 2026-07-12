package handler

import (
	"strconv"
	"orion/platform-svc-go/internal/inception/models"
	"orion/platform-svc-go/internal/inception/service"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

type Handler struct{ svc *service.Service }
func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// Health (no auth, matches TS: unauthenticated)
	rg.GET("/health", h.Health)
	// Status (no auth, matches TS: unauthenticated)
	rg.GET("/status", h.Status)
	// SQL Audit — requires write
	rg.POST("/audit", auth.RequirePermission("inception", "write"), h.Audit)
	// SQL Parse — requires write
	rg.POST("/parse", auth.RequirePermission("inception", "write"), h.Parse)
	// SQL Execute — requires write
	rg.POST("/execute", auth.RequirePermission("inception", "write"), h.Execute)
	// List Databases — requires read
	rg.GET("/databases", auth.RequirePermission("inception", "read"), h.ListDatabases)
	// Audit History — requires read
	rg.GET("/history", auth.RequirePermission("inception", "read"), h.History)
}

// ---------------------------------------------------------------------------
// Health & Status
// ---------------------------------------------------------------------------

func (h *Handler) Health(c *gin.Context) {
	status, err := h.svc.Health(c.Request.Context())
	if err != nil { respondInternalError(c, err.Error()); return }
	respondSuccess(c, gin.H{"status": status})
}

func (h *Handler) Status(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	enabled, msg, err := h.svc.Status(c.Request.Context(), tenantID)
	if err != nil { respondInternalError(c, err.Error()); return }
	respondSuccess(c, gin.H{"enabled": enabled, "message": msg})
}

// ---------------------------------------------------------------------------
// SQL Audit / Parse / Execute
// ---------------------------------------------------------------------------

func (h *Handler) Audit(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.AuditRequest
	if err := c.ShouldBindJSON(&req); err != nil { respondBadRequest(c, err.Error()); return }
	auditReq := req.ToCreateAudit()
	result, err := h.svc.CreateAudit(c.Request.Context(), tenantID, auditReq)
	if err != nil { respondInternalError(c, err.Error()); return }
	respondCreated(c, gin.H{
		"checked":  true,
		"warnings": result.Warnings,
		"errors":   result.Errors,
		"audit_id": result.ID,
	})
}

func (h *Handler) Parse(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.ParseRequest
	if err := c.ShouldBindJSON(&req); err != nil { respondBadRequest(c, err.Error()); return }
	auditReq := req.ToCreateAudit()
	result, err := h.svc.CreateAudit(c.Request.Context(), tenantID, auditReq)
	if err != nil { respondInternalError(c, err.Error()); return }
	respondSuccess(c, gin.H{
		"parsed":   true,
		"sql":      req.SQL,
		"audit_id": result.ID,
	})
}

func (h *Handler) Execute(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.ExecuteRequest
	if err := c.ShouldBindJSON(&req); err != nil { respondBadRequest(c, err.Error()); return }
	auditReq := req.ToCreateAudit()
	result, err := h.svc.CreateAudit(c.Request.Context(), tenantID, auditReq)
	if err != nil { respondInternalError(c, err.Error()); return }
	respondSuccess(c, gin.H{
		"executed": false,
		"message":  "Inception not configured",
		"audit_id": result.ID,
	})
}

// ---------------------------------------------------------------------------
// List Databases
// ---------------------------------------------------------------------------

func (h *Handler) ListDatabases(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	dbs, err := h.svc.ListDatabases(c.Request.Context(), tenantID)
	if err != nil { respondInternalError(c, err.Error()); return }
	if dbs == nil { dbs = []string{} }
	respondSuccess(c, gin.H{"databases": dbs})
}

// ---------------------------------------------------------------------------
// Audit History
// ---------------------------------------------------------------------------

func (h *Handler) History(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.ListAudits(c.Request.Context(), tenantID, (page-1)*ps, ps)
	if err != nil { respondInternalError(c, err.Error()); return }
	if items == nil { items = []models.SQLAuditHistory{} }
	total, _ := h.svc.CountAudits(c.Request.Context(), tenantID)
	respondSuccess(c, gin.H{"records": items, "total": total})
}

