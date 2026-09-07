package aireview

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Handler exposes the aireview Service over HTTP.
type Handler struct {
	svc *Service
}

// NewHandler wires a Handler around a Service.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts the aireview endpoints under the given group.
//
// Routes:
//   POST /db/aireview/review  — submit a SQL review
//   GET  /db/aireview/history — list recent reviews for the caller's tenant
//   GET  /db/aireview/:id     — fetch a single review record
//
// Auth uses the same dba permissions as the rest of the DBA module.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/db/aireview")
	f.POST("/review", auth.RequirePermission("dba", "write"), h.ReviewSQL)
	f.GET("/history", auth.RequirePermission("dba", "read"), h.GetHistory)
	f.GET("/:id", auth.RequirePermission("dba", "read"), h.GetResult)
}

// ReviewSQL handles POST /db/aireview/review.
func (h *Handler) ReviewSQL(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AirReviewReviewSQL")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req SQLReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.ReviewSQL(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

// GetHistory handles GET /db/aireview/history.
func (h *Handler) GetHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AirReviewHistory")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	records, err := h.svc.GetReviewHistory(ctx, tenantID, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, records)
}

// GetResult handles GET /db/aireview/:id.
func (h *Handler) GetResult(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AirReviewGet")
	defer span.End()
	id := c.Param("id")
	rec, err := h.svc.GetReviewResult(ctx, id)
	if err != nil {
		middleware.RespondNotFound(c, "review not found")
		return
	}
	middleware.RespondSuccess(c, rec)
}
