package handler

import (
	"database/sql"
	"errors"
	"strings"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/repository"
	"orion/platform-svc-go/internal/sprint-analytics/models"
	"orion/platform-svc-go/internal/sprint-analytics/service"
)

// Handler provides sprint analytics endpoints (review, retrospective, velocity, gantt).
type Handler struct {
	svc *service.SprintService
}

func NewHandler(svc *service.SprintService) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	read := auth.RequirePermission("sprint", "read")
	write := auth.RequirePermission("sprint", "write")
	del := auth.RequirePermission("sprint", "delete")
	s := rg.Group("/sprints")
	s.POST("/:id/review", write, h.CreateReview)
	s.GET("/:id/review", read, h.GetReview)
	s.PUT("/:id/review/:reviewId", write, h.UpdateReview)
	s.DELETE("/:id/review/:reviewId", del, h.DeleteReview)
	s.POST("/:id/retrospective", write, h.CreateRetro)
	s.GET("/:id/retrospective", read, h.GetRetro)
	s.PUT("/:id/retrospective/:retroId", write, h.UpdateRetro)
	s.DELETE("/:id/retrospective/:retroId", del, h.DeleteRetro)
}

func (h *Handler) CreateReview(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateReview")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	sprintID := c.Param("id")
	var req models.CreateReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	req.SprintID = sprintID
	review, err := h.svc.CreateReview(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, review)
}

func (h *Handler) GetReview(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetReview")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	sprintID := c.Param("id")
	review, err := h.svc.GetReviewBySprint(ctx, tenantID, sprintID)
	if err != nil {
		middleware.RespondNotFound(c, "review not found")
		return
	}
	middleware.RespondSuccess(c, review)
}

func (h *Handler) UpdateReview(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateReview")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	reviewID := c.Param("reviewId")
	var req models.UpdateReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	review, err := h.svc.UpdateReview(ctx, tenantID, reviewID, &req)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			middleware.RespondNotFound(c, "review not found")
		} else if strings.Contains(err.Error(), "no fields to update") {
			middleware.RespondBadRequest(c, err.Error())
		} else {
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, review)
}

func (h *Handler) DeleteReview(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteReview")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	reviewID := c.Param("reviewId")
	ok, err := h.svc.DeleteReview(ctx, tenantID, reviewID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !ok {
		middleware.RespondNotFound(c, "review not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"deleted": true})
}

func (h *Handler) CreateRetro(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateRetro")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	sprintID := c.Param("id")
	var req models.CreateRetroRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	req.SprintID = sprintID
	retro, err := h.svc.CreateRetro(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, retro)
}

func (h *Handler) GetRetro(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRetro")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	sprintID := c.Param("id")
	retro, err := h.svc.GetRetroBySprint(ctx, tenantID, sprintID)
	if err != nil {
		middleware.RespondNotFound(c, "retrospective not found")
		return
	}
	middleware.RespondSuccess(c, retro)
}

func (h *Handler) UpdateRetro(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateRetro")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	retroID := c.Param("retroId")
	var req models.UpdateRetroRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	retro, err := h.svc.UpdateRetro(ctx, tenantID, retroID, &req)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			middleware.RespondNotFound(c, "retrospective not found")
		} else if strings.Contains(err.Error(), "no fields to update") {
			middleware.RespondBadRequest(c, err.Error())
		} else {
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, retro)
}

func (h *Handler) DeleteRetro(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteRetro")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	retroID := c.Param("retroId")
	ok, err := h.svc.DeleteRetro(ctx, tenantID, retroID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !ok {
		middleware.RespondNotFound(c, "retrospective not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"deleted": true})
}
