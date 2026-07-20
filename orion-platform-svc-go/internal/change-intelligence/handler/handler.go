package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/change-intelligence/models"
	"orion/platform-svc-go/internal/change-intelligence/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all change-intelligence endpoints under the given group.
// Mirrors /api/v1/change-intelligence routes from the TS source.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/change-intelligence")

	// POST /change-intelligence/analyze - Perform semantic blast radius analysis
	f.POST("/analyze", auth.RequirePermission("change-intelligence", "write"), h.Analyze)
	// GET /change-intelligence/reports - List all change analysis reports
	f.GET("/reports", auth.RequirePermission("change-intelligence", "read"), h.ListReports)
	// GET /change-intelligence/reports/:id - Get single report detail
	f.GET("/reports/:id", auth.RequirePermission("change-intelligence", "read"), h.GetReport)
	// GET /change-intelligence/reports/:id/blast-radius - Get blast radius for a report
	f.GET("/reports/:id/blast-radius", auth.RequirePermission("change-intelligence", "read"), h.GetBlastRadius)
}

// getTenantID extracts tenant_id from Gin context, falling back to a zero UUID.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

// Analyze handles POST /change-intelligence/analyze
func (h *Handler) Analyze(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Analyze")
	defer span.End()
	var req models.AnalyzeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	createdBy := c.GetString("user_id")
	if createdBy == "" {
		createdBy = "system"
	}
	analysis, err := h.svc.Analyze(ctx, &req, tenantID, createdBy)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, analysis)
}

// ListReports handles GET /change-intelligence/reports
func (h *Handler) ListReports(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListReports")
	defer span.End()
	tenantID := h.getTenantID(c)
	reports, total, err := h.svc.ListReports(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:     reports,
		Total:    total,
		Page:     1,
		PageSize: total,
	})
}

// GetReport handles GET /change-intelligence/reports/:id
func (h *Handler) GetReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetReport")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	analysis, err := h.svc.GetReport(ctx, id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "change analysis not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, analysis)
}

// GetBlastRadius handles GET /change-intelligence/reports/:id/blast-radius
func (h *Handler) GetBlastRadius(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetBlastRadius")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	response, err := h.svc.GetBlastRadius(ctx, id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "change analysis not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, response)
}
