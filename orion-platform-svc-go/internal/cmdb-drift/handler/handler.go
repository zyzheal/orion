package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/cmdb-drift/models"
	"orion/platform-svc-go/internal/cmdb-drift/service"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Service defines the methods the handler calls on the service layer.
type Service interface {
	ScanForDrift(ctx context.Context, tenantID, environment string) (*models.DriftScanResult, error)
	ListDrifts(ctx context.Context, tenantID string, filter models.DriftFilter) ([]models.DriftRecord, error)
	CountDrifts(ctx context.Context, tenantID string, filter models.DriftFilter) (int, error)
	GetDrift(ctx context.Context, tenantID, id string) (*models.DriftRecord, error)
	ResolveDrift(ctx context.Context, tenantID, id, resolvedBy, resolution string) error
	BulkResolveDrifts(ctx context.Context, tenantID string, ids []string, resolvedBy, resolution string) (int64, error)
	AutoRemediate(ctx context.Context, tenantID, id string) (*models.RemediationResult, error)
	RecordDrift(ctx context.Context, tenantID string, record *models.DriftRecord) error
	GetDriftStats(ctx context.Context, tenantID string) (*models.DriftStats, error)
	CountUnresolved(ctx context.Context, tenantID string) (int, error)
	DeleteDrift(ctx context.Context, tenantID, id string) error
}

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all CMDB drift endpoints under the given RouterGroup.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/cmdb/drifts")
	{
		// Drift CRUD
		f.GET("", auth.RequirePermission("cmdb", "read"), h.ListDrifts)
		f.GET("/:id", auth.RequirePermission("cmdb", "read"), h.GetDrift)
		f.POST("/record", auth.RequirePermission("cmdb", "write"), h.RecordDrift)
		f.DELETE("/:id", auth.RequirePermission("cmdb", "delete"), h.DeleteDrift)

		// Scan
		f.POST("/scan", auth.RequirePermission("cmdb", "write"), h.ScanForDrift)

		// Resolve
		f.POST("/:id/resolve", auth.RequirePermission("cmdb", "write"), h.ResolveDrift)
		f.POST("/bulk-resolve", auth.RequirePermission("cmdb", "write"), h.BulkResolveDrifts)

		// Remediate
		f.POST("/:id/remediate", auth.RequirePermission("cmdb", "execute"), h.AutoRemediate)

		// Stats
		f.GET("/stats", auth.RequirePermission("cmdb", "read"), h.GetDriftStats)
		f.GET("/count", auth.RequirePermission("cmdb", "read"), h.CountUnresolved)
	}
}

// ===========================================================================
// Drift CRUD
// ===========================================================================

func (h *Handler) ListDrifts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListDrifts")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	filter := models.DriftFilter{
		Environment:    c.Query("environment"),
		CIID:           c.Query("ciId"),
		CIType:         c.Query("ciType"),
		DriftType:      models.DriftType(c.Query("driftType")),
		Severity:       models.DriftSeverity(c.Query("severity")),
		UnresolvedOnly: c.Query("unresolved") == "true",
	}

	if page, err := strconv.Atoi(c.DefaultQuery("page", "1")); err == nil {
		filter.Page = page
	}
	if pageSize, err := strconv.Atoi(c.DefaultQuery("pageSize", "20")); err == nil {
		filter.PageSize = pageSize
	}

	items, err := h.svc.ListDrifts(ctx, tenantID, filter)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	total, err := h.svc.CountDrifts(ctx, tenantID, filter)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	middleware.RespondSuccess(c, gin.H{
		"data":  items,
		"total": total,
		"page":  filter.Page,
	})
}

func (h *Handler) GetDrift(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDrift")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	drift, err := h.svc.GetDrift(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, drift)
}

func (h *Handler) RecordDrift(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RecordDrift")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	var req models.CreateDriftRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	record := &models.DriftRecord{
		CIID:          req.CIID,
		CIName:        req.CIName,
		CIType:        req.CIType,
		Property:      req.Property,
		Environment:   req.Environment,
		ExpectedValue: req.ExpectedValue,
		ActualValue:   req.ActualValue,
		DriftType:     req.DriftType,
		Severity:      req.Severity,
	}

	if err := h.svc.RecordDrift(ctx, tenantID, record); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, record)
}

func (h *Handler) DeleteDrift(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteDrift")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if err := h.svc.DeleteDrift(ctx, tenantID, id); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondNoContent(c)
}

// ===========================================================================
// Scan
// ===========================================================================

func (h *Handler) ScanForDrift(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ScanForDrift")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	var req models.ScanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	result, err := h.svc.ScanForDrift(ctx, tenantID, req.Environment)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// ===========================================================================
// Resolve
// ===========================================================================

func (h *Handler) ResolveDrift(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ResolveDrift")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req models.ResolveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	if err := h.svc.ResolveDrift(ctx, tenantID, id, req.ResolvedBy, req.Resolution); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "drift resolved"})
}

func (h *Handler) BulkResolveDrifts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "BulkResolveDrifts")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	var req struct {
		IDs        []string `json:"ids" binding:"required"`
		ResolvedBy string   `json:"resolvedBy" binding:"required"`
		Resolution string   `json:"resolution"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	count, err := h.svc.BulkResolveDrifts(ctx, tenantID, req.IDs, req.ResolvedBy, req.Resolution)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"resolved": count})
}

// ===========================================================================
// Remediate
// ===========================================================================

func (h *Handler) AutoRemediate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AutoRemediate")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	result, err := h.svc.AutoRemediate(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// ===========================================================================
// Stats
// ===========================================================================

func (h *Handler) GetDriftStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDriftStats")
	defer span.End()

	tenantID := c.GetString("tenant_id")

	stats, err := h.svc.GetDriftStats(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

func (h *Handler) CountUnresolved(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CountUnresolved")
	defer span.End()

	tenantID := c.GetString("tenant_id")

	count, err := h.svc.CountUnresolved(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"count": count})
}