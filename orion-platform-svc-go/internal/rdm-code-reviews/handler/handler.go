// Package handler exposes the RDM code-reviews HTTP endpoints.
//
// Routes registered by RegisterRoutes:
//   GET    /rdm/code-reviews
//   GET    /rdm/code-reviews/:id
//   POST   /rdm/code-reviews
//   DELETE /rdm/code-reviews/:id
//   GET    /rdm/code-reviews/:id/comments
//   POST   /rdm/code-reviews/:id/comments
//
// These resolve R-P0-05 from the risk register (CC v5.4 §1.5.1):
// "RDM code-review handler" (frontend 404 -> 200).
//
// Stub phase: see service/service.go header for persistence plan.
package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/rdm-code-reviews/models"
	"orion/platform-svc-go/internal/rdm-code-reviews/service"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Handler wires HTTP requests to the RDM code-reviews Service.
type Handler struct {
	svc *service.Service
}

// NewHandler constructs a Handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers the 6 code-review endpoints. Path prefix
// /rdm/code-reviews is baked in so callers can pass api directly.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	cr := rg.Group("/rdm/code-reviews")
	cr.GET("", auth.RequirePermission("rdm", "read"), h.List)
	cr.GET("/:id", auth.RequirePermission("rdm", "read"), h.Get)
	cr.POST("", auth.RequirePermission("rdm", "write"), h.Create)
	cr.DELETE("/:id", auth.RequirePermission("rdm", "delete"), h.Delete)
	cr.GET("/:id/comments", auth.RequirePermission("rdm", "read"), h.ListComments)
	cr.POST("/:id/comments", auth.RequirePermission("rdm", "write"), h.CreateComment)
}

// List handles GET /rdm/code-reviews?status=&projectId=.
func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RDMCodeReview.List")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	projectID := c.Query("projectId")
	status := c.Query("status")
	items, err := h.svc.ListCodeReviews(ctx, tenantID, projectID, status)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

// Get handles GET /rdm/code-reviews/:id.
func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RDMCodeReview.Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	review, err := h.svc.GetCodeReview(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if review == nil {
		middleware.RespondNotFound(c, "code review not found")
		return
	}
	middleware.RespondSuccess(c, review)
}

// Create handles POST /rdm/code-reviews.
func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RDMCodeReview.Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateCodeReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	review, err := h.svc.CreateCodeReview(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, review)
}

// Delete handles DELETE /rdm/code-reviews/:id.
func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RDMCodeReview.Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteCodeReview(ctx, tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"deleted": true})
}

// ListComments handles GET /rdm/code-reviews/:id/comments.
func (h *Handler) ListComments(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RDMCodeReview.ListComments")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	reviewID := c.Param("id")
	items, err := h.svc.ListComments(ctx, tenantID, reviewID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

// CreateComment handles POST /rdm/code-reviews/:id/comments.
func (h *Handler) CreateComment(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RDMCodeReview.CreateComment")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	reviewID := c.Param("id")
	var req models.CreateCodeReviewCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	comment, err := h.svc.CreateComment(ctx, tenantID, reviewID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, comment)
}
