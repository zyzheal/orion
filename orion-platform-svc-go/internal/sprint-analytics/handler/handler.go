package handler

import (
	"database/sql"
	"errors"
	"strconv"
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
	s.GET("/velocity", read, h.GetVelocity)
	s.GET("/gantt", read, h.GetGantt)
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
	expectedVersion := 0
	if ifMatch := c.GetHeader("If-Match"); ifMatch != "" {
		expectedVersion, _ = strconv.Atoi(ifMatch)
	}
	review, err := h.svc.UpdateReview(ctx, tenantID, reviewID, &req, expectedVersion)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			middleware.RespondNotFound(c, "review not found")
		} else if errors.Is(err, repository.ErrVersionMismatch) {
			middleware.RespondConflict(c, "version mismatch: resource was modified by another request")
		} else if errors.Is(err, repository.ErrVersionMismatch) {
			middleware.RespondConflict(c, "version mismatch: resource was modified by another request")
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
	expectedVersion := 0
	if ifMatch := c.GetHeader("If-Match"); ifMatch != "" {
		expectedVersion, _ = strconv.Atoi(ifMatch)
	}
	retro, err := h.svc.UpdateRetro(ctx, tenantID, retroID, &req, expectedVersion)
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

func (h *Handler) GetVelocity(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetVelocity")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	projectID := c.Query("projectId")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	items, err := h.svc.GetVelocity(ctx, tenantID, projectID, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) GetGantt(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetGantt")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	projectID := c.Query("projectId")
	items, err := h.svc.GetGantt(ctx, tenantID, projectID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}
