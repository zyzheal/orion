package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/sbom/models"
	"orion/platform-svc-go/internal/sbom/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

// Service defines the contract the handler needs from the service layer.
type Service interface {
	ListSBOMs(ctx context.Context, tenantID string, q *models.ListQuery) ([]models.SBOMDocument, int, error)
	GenerateSBOM(ctx context.Context, req *models.GenerateSBOMRequest, tenantID string) (*models.SBOMDocument, error)
	GetSBOM(ctx context.Context, id string, tenantID string) (*models.SBOMDocument, error)
	DeleteSBOM(ctx context.Context, id string, tenantID string) (bool, error)
	ListComponents(ctx context.Context, sbomID string, tenantID string, offset, limit int) ([]models.SBOMComponent, int, error)
	ListVulnerabilities(ctx context.Context, sbomID string, tenantID string, severity *string, offset, limit int) ([]models.Vulnerability, int, error)
	ScanSBOM(ctx context.Context, id string, tenantID string, req *models.ScanRequest) (*models.SBOMDocument, error)
	GetLicenses(ctx context.Context, sbomID string, tenantID string) ([]models.LicenseInfo, error)
	ListAttestations(ctx context.Context, sbomID string, tenantID string) ([]models.SBOMAttestation, error)
	CreateAttestation(ctx context.Context, sbomID string, tenantID string, req *models.CreateAttestationRequest) (*models.SBOMAttestation, error)
	ExportSBOM(ctx context.Context, id string, tenantID string, format string) (*models.ExportResponse, error)
	CompareSBOMs(ctx context.Context, fromID, toID, tenantID string) (*models.SBOMComparison, error)
}

type Handler struct {
	svc Service
}

// NewHandler creates a new Handler bound to the SBOM service.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all SBOM endpoints under /sbom.
// Mirrors 14 endpoints from the TS source (GET/POST listing, CRUD, components, vulnerabilities, scan, licenses, attestation, export, compare).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/sbom")

	// GET /sbom - List SBOMs
	f.GET("", h.ListSBOMs)
	// POST /sbom - Generate SBOM
	f.POST("", auth.RequirePermission("sbom", "write"), h.GenerateSBOM)
	// POST /sbom/compare - Compare SBOMs
	f.POST("/compare", h.CompareSBOMs)

	// GET /sbom/:id - Get SBOM
	f.GET("/:id", h.GetSBOM)
	// DELETE /sbom/:id - Delete SBOM
	f.DELETE("/:id", auth.RequirePermission("sbom", "delete"), h.DeleteSBOM)
	// GET /sbom/:id/components - List components
	f.GET("/:id/components", h.ListComponents)
	// GET /sbom/:id/vulnerabilities - List vulnerabilities
	f.GET("/:id/vulnerabilities", h.ListVulnerabilities)
	// POST /sbom/:id/scan - Execute scan
	f.POST("/:id/scan", auth.RequirePermission("sbom", "write"), h.ScanSBOM)
	// GET /sbom/:id/licenses - Get licenses
	f.GET("/:id/licenses", h.GetLicenses)
	// GET /sbom/:id/attestation - List attestations
	f.GET("/:id/attestation", h.ListAttestations)
	// POST /sbom/:id/attestation - Create attestation
	f.POST("/:id/attestation", auth.RequirePermission("sbom", "write"), h.CreateAttestation)
	// GET /sbom/:id/export - Export SBOM
	f.GET("/:id/export", h.ExportSBOM)
}

// getTenantID extracts tenant_id from Gin context, falling back to a zero UUID.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		tenantID = "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

// parsePagination parses offset/limit query params.
func parsePagination(c *gin.Context) (int, int) {
	offset, _ := strconv.Atoi(c.Query("offset"))
	limit, _ := strconv.Atoi(c.Query("limit"))
	if offset < 0 {
		offset = 0
	}
	if limit <= 0 {
		limit = 20
	}
	return offset, limit
}

// --- SBOM handlers ---

func (h *Handler) ListSBOMs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListSBOMs")
	defer span.End()
	var q models.ListQuery
	if err := c.ShouldBindQuery(&q); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	docs, total, err := h.svc.ListSBOMs(ctx, tenantID, &q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, &models.PaginatedResponse{
		Data:   docs,
		Total:  total,
		Offset: q.Offset,
		Limit:  q.Limit,
	})
}

func (h *Handler) GenerateSBOM(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GenerateSBOM")
	defer span.End()
	var req models.GenerateSBOMRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	sbom, err := h.svc.GenerateSBOM(ctx, &req, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, sbom)
}

func (h *Handler) GetSBOM(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSBOM")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	sbom, err := h.svc.GetSBOM(ctx, id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "sbom not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, sbom)
}

func (h *Handler) DeleteSBOM(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteSBOM")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.DeleteSBOM(ctx, id, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "sbom not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "sbom deleted"})
}

// --- Component handlers ---

func (h *Handler) ListComponents(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListComponents")
	defer span.End()
	id := c.Param("id")
	offset, limit := parsePagination(c)
	if limit == 20 {
		limit = 50
	}
	tenantID := h.getTenantID(c)
	comps, total, err := h.svc.ListComponents(ctx, id, tenantID, offset, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, &models.PaginatedResponse{
		Data:   comps,
		Total:  total,
		Offset: offset,
		Limit:  limit,
	})
}

// --- Vulnerability handlers ---

func (h *Handler) ListVulnerabilities(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListVulnerabilities")
	defer span.End()
	id := c.Param("id")
	offset, limit := parsePagination(c)
	if limit == 20 {
		limit = 50
	}
	severity := c.Query("severity")
	tenantID := h.getTenantID(c)
	var severityPtr *string
	if severity != "" {
		severityPtr = &severity
	}
	vulns, total, err := h.svc.ListVulnerabilities(ctx, id, tenantID, severityPtr, offset, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, &models.PaginatedResponse{
		Data:   vulns,
		Total:  total,
		Offset: offset,
		Limit:  limit,
	})
}

func (h *Handler) ScanSBOM(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ScanSBOM")
	defer span.End()
	id := c.Param("id")
	var req models.ScanRequest
	_ = c.ShouldBindJSON(&req)
	tenantID := h.getTenantID(c)
	sbom, err := h.svc.ScanSBOM(ctx, id, tenantID, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "sbom not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, sbom)
}

// --- License handlers ---

func (h *Handler) GetLicenses(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetLicenses")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	licenses, err := h.svc.GetLicenses(ctx, id, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": licenses})
}

// --- Attestation handlers ---

func (h *Handler) ListAttestations(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAttestations")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	atts, err := h.svc.ListAttestations(ctx, id, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": atts})
}

func (h *Handler) CreateAttestation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateAttestation")
	defer span.End()
	id := c.Param("id")
	var req models.CreateAttestationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	att, err := h.svc.CreateAttestation(ctx, id, tenantID, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "sbom not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, att)
}

// --- Export handler ---

func (h *Handler) ExportSBOM(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExportSBOM")
	defer span.End()
	id := c.Param("id")
	format := c.Query("format")
	tenantID := h.getTenantID(c)
	resp, err := h.svc.ExportSBOM(ctx, id, tenantID, format)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "sbom not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", `attachment; filename="sbom-`+id+`.json"`)
	c.String(200, resp.Content)
}

// --- Compare handler ---

func (h *Handler) CompareSBOMs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CompareSBOMs")
	defer span.End()
	var req models.CompareSBOMRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	comparison, err := h.svc.CompareSBOMs(ctx, req.FromSBOMID, req.ToSBOMID, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "sbom not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, comparison)
}
