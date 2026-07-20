package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/feature-flag/models"
	"orion/platform-svc-go/internal/feature-flag/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

// Service defines the interface used by Handler.
type Service interface {
	Create(ctx context.Context, tenantID, createdBy string, req *models.CreateFlagRequest) (*models.FeatureFlag, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.FeatureFlag, error)
	GetByKey(ctx context.Context, tenantID, key string) (*models.FeatureFlag, error)
	List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.FeatureFlag, error)
	Search(ctx context.Context, tenantID, query string, offset, limit int) ([]models.FeatureFlag, error)
	Update(ctx context.Context, tenantID, id, updatedBy string, req *models.UpdateFlagRequest) (*models.FeatureFlag, error)
	Delete(ctx context.Context, tenantID, id string) error
	Count(ctx context.Context, tenantID string) (int, error)
	SetRolloutPercentage(ctx context.Context, tenantID, id, updatedBy string, percentage int) (*models.FeatureFlag, error)
	RecordToggle(ctx context.Context, flagID string, oldValue, newValue bool, changedBy, reason string) error
	EvaluateFlag(ctx context.Context, tenantID string, req *models.EvaluateFlagRequest) (*models.FlagEvaluationResult, error)
	EvaluateFlags(ctx context.Context, tenantID string, reqs []models.EvaluateFlagRequest) ([]models.FlagEvaluationResult, error)
	ListToggleHistory(ctx context.Context, flagID string, limit int) ([]models.FlagToggleRecord, error)
}

// Handler exposes HTTP endpoints for feature flag operations.
type Handler struct {
	svc Service
}

// NewHandler creates a new Handler instance.
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all feature flag routes onto the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/flags")
	f.POST("", auth.RequirePermission("feature_flag", "write"), h.Create)
	f.GET("", h.List)
	f.GET("/search", h.Search)
	f.GET("/count", h.Count)
	f.GET("/:id", h.Get)
	f.PUT("/:id", auth.RequirePermission("feature_flag", "write"), h.Update)
	f.DELETE("/:id", auth.RequirePermission("feature_flag", "delete"), h.Delete)
	f.PUT("/:id/rollout", auth.RequirePermission("feature_flag", "write"), h.SetRollout)
	f.POST("/:id/toggle", auth.RequirePermission("feature_flag", "write"), h.RecordToggle)
	f.GET("/:id/toggle-history", h.ToggleHistory)

	// Evaluation endpoints (key-based, not id-based).
	f.POST("/evaluate", auth.RequirePermission("feature_flag", "write"), h.Evaluate)
	f.POST("/evaluate/batch", auth.RequirePermission("feature_flag", "write"), h.EvaluateBatch)
}

// Create creates a new feature flag.
func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	createdBy := c.GetString("user_id")

	var req models.CreateFlagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	flag, err := h.svc.Create(ctx, tenantID, createdBy, &req)
	if err != nil {
		if err == service.ErrDuplicateKey {
			middleware.RespondConflict(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, flag)
}

// List retrieves feature flags with optional status/environment filters and pagination.
func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	filter := &models.ListFilter{}
	if status := c.Query("status"); status != "" {
		s := models.FeatureFlagStatus(status)
		filter.Status = &s
	}
	if env := c.Query("environment"); env != "" {
		filter.Environment = &env
	}

	items, err := h.svc.List(ctx, tenantID, filter, (page-1)*pageSize, pageSize)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": items, "page": page, "page_size": pageSize})
}

// Search performs a text search across flag name, key, and description.
func (h *Handler) Search(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Search")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	query := c.Query("q")
	if query == "" {
		middleware.RespondBadRequest(c, "query parameter 'q' is required")
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	items, err := h.svc.Search(ctx, tenantID, query, (page-1)*pageSize, pageSize)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

// Get retrieves a single feature flag by id.
func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	flag, err := h.svc.GetByID(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, flag)
}

// Update modifies an existing feature flag.
func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	updatedBy := c.GetString("user_id")

	var req models.UpdateFlagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	flag, err := h.svc.Update(ctx, tenantID, c.Param("id"), updatedBy, &req)
	if err != nil {
		if err == service.ErrFlagNotFound {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, flag)
}

// Delete removes a feature flag by id.
func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(ctx, tenantID, c.Param("id")); err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "deleted"})
}

// Count returns the total number of feature flags for the tenant.
func (h *Handler) Count(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Count")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"count": count})
}

// SetRollout sets the rollout percentage for a flag.
func (h *Handler) SetRollout(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SetRollout")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	updatedBy := c.GetString("user_id")

	var req models.SetRolloutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	flag, err := h.svc.SetRolloutPercentage(ctx, tenantID, c.Param("id"), updatedBy, req.Percentage)
	if err != nil {
		if err == service.ErrInvalidRollout {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		if err == service.ErrFlagNotFound {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, flag)
}

// RecordToggle records a toggle event for a flag.
func (h *Handler) RecordToggle(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RecordToggle")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	changedBy := c.GetString("user_id")

	var req models.RecordToggleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	// Verify the flag exists and belongs to this tenant.
	_, err := h.svc.GetByID(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}

	if err := h.svc.RecordToggle(ctx, c.Param("id"), req.OldValue, req.NewValue, changedBy, req.Reason); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "toggle recorded"})
}

// Evaluate evaluates a single feature flag.
func (h *Handler) Evaluate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Evaluate")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req models.EvaluateFlagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	result, err := h.svc.EvaluateFlag(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// EvaluateBatch evaluates multiple feature flags in a single request.
func (h *Handler) EvaluateBatch(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EvaluateBatch")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var reqs []models.EvaluateFlagRequest
	if err := c.ShouldBindJSON(&reqs); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	results, err := h.svc.EvaluateFlags(ctx, tenantID, reqs)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"results": results})
}

// ToggleHistory retrieves the toggle history for a flag.
func (h *Handler) ToggleHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ToggleHistory")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	// Verify the flag exists and belongs to this tenant.
	_, err := h.svc.GetByID(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	records, err := h.svc.ListToggleHistory(ctx, id, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, records)
}
