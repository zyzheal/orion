package handler

import (
	"net/http"
	"strconv"

	"orion/platform-svc-go/internal/feature-flag/models"
	"orion/platform-svc-go/internal/feature-flag/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// Handler exposes HTTP endpoints for feature flag operations.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler instance.
func NewHandler(svc *service.Service) *Handler {
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
	tenantID := c.GetString("tenant_id")
	createdBy := c.GetString("user_id")

	var req models.CreateFlagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	flag, err := h.svc.Create(c.Request.Context(), tenantID, createdBy, &req)
	if err != nil {
		if err == service.ErrDuplicateKey {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, flag)
}

// List retrieves feature flags with optional status/environment filters and pagination.
func (h *Handler) List(c *gin.Context) {
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

	items, err := h.svc.List(c.Request.Context(), tenantID, filter, (page-1)*pageSize, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "page": page, "page_size": pageSize})
}

// Search performs a text search across flag name, key, and description.
func (h *Handler) Search(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query parameter 'q' is required"})
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	items, err := h.svc.Search(c.Request.Context(), tenantID, query, (page-1)*pageSize, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

// Get retrieves a single feature flag by id.
func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	flag, err := h.svc.GetByID(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, flag)
}

// Update modifies an existing feature flag.
func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	updatedBy := c.GetString("user_id")

	var req models.UpdateFlagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	flag, err := h.svc.Update(c.Request.Context(), tenantID, c.Param("id"), updatedBy, &req)
	if err != nil {
		if err == service.ErrFlagNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, flag)
}

// Delete removes a feature flag by id.
func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// Count returns the total number of feature flags for the tenant.
func (h *Handler) Count(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// SetRollout sets the rollout percentage for a flag.
func (h *Handler) SetRollout(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	updatedBy := c.GetString("user_id")

	var req models.SetRolloutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	flag, err := h.svc.SetRolloutPercentage(c.Request.Context(), tenantID, c.Param("id"), updatedBy, req.Percentage)
	if err != nil {
		if err == service.ErrInvalidRollout {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if err == service.ErrFlagNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, flag)
}

// RecordToggle records a toggle event for a flag.
func (h *Handler) RecordToggle(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	changedBy := c.GetString("user_id")

	var req models.RecordToggleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify the flag exists and belongs to this tenant.
	_, err := h.svc.GetByID(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.RecordToggle(c.Request.Context(), c.Param("id"), req.OldValue, req.NewValue, changedBy, req.Reason); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "toggle recorded"})
}

// Evaluate evaluates a single feature flag.
func (h *Handler) Evaluate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req models.EvaluateFlagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.svc.EvaluateFlag(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// EvaluateBatch evaluates multiple feature flags in a single request.
func (h *Handler) EvaluateBatch(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var reqs []models.EvaluateFlagRequest
	if err := c.ShouldBindJSON(&reqs); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	results, err := h.svc.EvaluateFlags(c.Request.Context(), tenantID, reqs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"results": results})
}

// ToggleHistory retrieves the toggle history for a flag.
func (h *Handler) ToggleHistory(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	// Verify the flag exists and belongs to this tenant.
	_, err := h.svc.GetByID(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	records, err := h.svc.ListToggleHistory(c.Request.Context(), id, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": records})
}
