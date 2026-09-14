package handler

import (
	"errors"
	"strconv"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/code-scan/models"
	"orion/platform-svc-go/internal/code-scan/service"
	"orion/platform-svc-go/internal/middleware"
)

// Handler serves the code-scan routes. Every response comes from the database:
// ListScans and ListFindings used to return a hardcoded sample set, so the page
// showed the same five scans and ten findings for every tenant and every
// deployment, and a scan created by POST never appeared in the list.
type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	codeScan := rg.Group("/code-scan")
	codeScan.GET("/scans", h.ListScans)
	codeScan.POST("/scans", h.CreateScan)
	codeScan.GET("/findings", h.ListFindings)
	codeScan.POST("/scans/:id/run", h.RerunScan)
}

// ListScans returns the tenant's scan runs, newest first.
func (h *Handler) ListScans(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListCodeScans")
	defer span.End()

	items, err := h.svc.ListScans(c.Request.Context(), c.GetString("tenant_id"), queryLimit(c))
	if err != nil {
		middleware.RespondInternalError(c, "failed to list code scans")
		return
	}
	middleware.RespondSuccess(c, items)
}

// ListFindings returns the tenant's findings, optionally restricted to one scan
// with ?scanId=.
func (h *Handler) ListFindings(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListCodeScanFindings")
	defer span.End()

	items, err := h.svc.ListFindings(c.Request.Context(), c.GetString("tenant_id"), c.Query("scanId"), queryLimit(c))
	if err != nil {
		middleware.RespondInternalError(c, "failed to list code scan findings")
		return
	}
	middleware.RespondSuccess(c, items)
}

// CreateScan records a run and starts the worker that walks the target tree.
func (h *Handler) CreateScan(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateCodeScan")
	defer span.End()

	var req models.CreateScanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, "invalid scan request: "+err.Error())
		return
	}

	rec, err := h.svc.CreateScan(c.Request.Context(), c.GetString("tenant_id"), req.Target, req.Branch)
	if errors.Is(err, service.ErrInvalidTarget) {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err != nil {
		middleware.RespondInternalError(c, "failed to create code scan")
		return
	}
	middleware.RespondCreated(c, rec)
}

// RerunScan restarts an existing run, dropping the previous attempt's findings.
func (h *Handler) RerunScan(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RerunCodeScan")
	defer span.End()

	rec, err := h.svc.RerunScan(c.Request.Context(), c.GetString("tenant_id"), c.Param("id"))
	if errors.Is(err, service.ErrInvalidTarget) {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if errors.Is(err, sentinel.NotFound) {
		middleware.RespondNotFound(c, "code scan not found")
		return
	}
	if err != nil {
		middleware.RespondInternalError(c, "failed to rerun code scan")
		return
	}
	middleware.RespondSuccess(c, rec)
}

// queryLimit reads ?limit= with the service's own bounds applied, so a caller
// cannot request an unbounded response.
func queryLimit(c *gin.Context) int {
	raw := c.Query("limit")
	if raw == "" {
		return 0
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return 0
	}
	return n
}
