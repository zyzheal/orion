// Package handler wires the query service into HTTP endpoints. The
// three endpoints follow the module's route convention:
//
//	POST /dba/query/paged
//	POST /dba/query/export
//	GET  /dba/query/export/:jobid
//
// The DBA service already owns /dba/query (ExecuteDirectQuery), so we
// extend the same prefix rather than inventing a parallel namespace.
//
// Auth mirrors the DBA module: dba/execute for write operations,
// dba/read for status reads.
package query

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"
)

// Handler wraps the query Service behind HTTP endpoints.
type Handler struct {
	svc *Service
}

// NewHandler binds a Service to the HTTP layer.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// RegisterRoutes mounts the query endpoints under the given group.
// The caller typically passes the /api/v1 group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/dba")
	f.POST("/query/paged", auth.RequirePermission("dba", "execute"), h.ExecutePagedQuery)
	f.POST("/query/export", auth.RequirePermission("dba", "execute"), h.ExportToExcel)
	f.GET("/query/export/:jobid", auth.RequirePermission("dba", "read"), h.GetExportStatus)
}

// ExecutePagedQuery is POST /dba/query/paged.
func (h *Handler) ExecutePagedQuery(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DBA.ExecutePagedQuery")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req PagedQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.ExecutePagedQuery(ctx, tenantID, userID, req)
	if err != nil {
		h.mapServiceError(c, err)
		return
	}
	middleware.RespondSuccess(c, result)
}

// ExportToExcel is POST /dba/query/export.
func (h *Handler) ExportToExcel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DBA.ExportToExcel")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req ExportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	job, err := h.svc.ExportToExcel(ctx, tenantID, userID, req)
	if err != nil {
		if errors.Is(err, ErrConcurrentExportLimit) {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": err.Error()})
			return
		}
		h.mapServiceError(c, err)
		return
	}
	c.JSON(http.StatusAccepted, job)
}

// GetExportStatus is GET /dba/query/export/:jobid.
func (h *Handler) GetExportStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DBA.GetExportStatus")
	defer span.End()
	jobID := c.Param("jobid")
	job, err := h.svc.GetExportStatus(ctx, jobID)
	if err != nil {
		if errors.Is(err, ErrJobNotFound) {
			middleware.RespondNotFound(c, "export job not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, job)
}

// mapServiceError converts service-level errors into HTTP responses.
// Kept as a single function so the mapping lives in one place and
// future errors are added here rather than scattered across handlers.
func (h *Handler) mapServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrQueryValidation),
		errors.Is(err, ErrInvalidCursor),
		errors.Is(err, ErrCursorTooLarge),
		errors.Is(err, ErrAuditRejected):
		middleware.RespondBadRequest(c, err.Error())
	case errors.Is(err, ErrNoDataSource):
		middleware.RespondNotFound(c, "data source not found")
	case errors.Is(err, ErrConcurrentExportLimit):
		c.JSON(http.StatusTooManyRequests, gin.H{"error": err.Error()})
	case errors.Is(err, ErrJobNotFound):
		middleware.RespondNotFound(c, "export job not found")
	default:
		middleware.RespondInternalError(c, err.Error())
	}
}
