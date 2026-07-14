package handler

import (
	"net/http"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/ai-models/models"
	"orion/platform-svc-go/internal/ai-models/service"

	"github.com/gin-gonic/gin"
)

// Handler exposes HTTP endpoints for AI model management.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all ai-models routes.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/api/v1/ai/models")

	// GET /api/v1/ai/models - List models
	r.GET("",
		auth.RequirePermission("ai_models", "read"),
		h.ListModels)

	// POST /api/v1/ai/models - Register model
	r.POST("",
		auth.RequirePermission("ai_models", "write"),
		h.RegisterModel)

	// GET /api/v1/ai/models/:id - Get model
	r.GET("/:id",
		auth.RequirePermission("ai_models", "read"),
		h.GetModel)

	// PUT /api/v1/ai/models/:id - Update model
	r.PUT("/:id",
		auth.RequirePermission("ai_models", "write"),
		h.UpdateModel)

	// DELETE /api/v1/ai/models/:id - Delete model
	r.DELETE("/:id",
		auth.RequirePermission("ai_models", "delete"),
		h.DeleteModel)

	// GET /api/v1/ai/models/:id/versions - List versions
	r.GET("/:id/versions",
		auth.RequirePermission("ai_models", "read"),
		h.ListVersions)

	// POST /api/v1/ai/models/:id/versions - Publish version
	r.POST("/:id/versions",
		auth.RequirePermission("ai_models", "write"),
		h.PublishVersion)

	// GET /api/v1/ai/models/:id/versions/:versionId - Get version
	r.GET("/:id/versions/:versionId",
		auth.RequirePermission("ai_models", "read"),
		h.GetVersion)

	// POST /api/v1/ai/models/:id/versions/:versionId/promote - Promote version
	r.POST("/:id/versions/:versionId/promote",
		auth.RequirePermission("ai_models", "write"),
		h.PromoteVersion)

	// POST /api/v1/ai/models/:id/versions/:versionId/rollback - Rollback version
	r.POST("/:id/versions/:versionId/rollback",
		auth.RequirePermission("ai_models", "delete"),
		h.RollbackVersion)

	// GET /api/v1/ai/models/:id/metrics - Get metrics
	r.GET("/:id/metrics",
		auth.RequirePermission("ai_models", "read"),
		h.GetModelMetrics)

	// POST /api/v1/ai/models/:id/canary - Configure canary
	r.POST("/:id/canary",
		auth.RequirePermission("ai_models", "write"),
		h.ConfigureCanary)

	// GET /api/v1/ai/models/:id/canary - Get canary config
	r.GET("/:id/canary",
		auth.RequirePermission("ai_models", "read"),
		h.GetCanaryConfig)

	// DELETE /api/v1/ai/models/:id/canary - Stop canary
	r.DELETE("/:id/canary",
		auth.RequirePermission("ai_models", "delete"),
		h.StopCanary)
}

// registerUnused marks imports as used to prevent linter errors.
var _ = http.StatusOK

// --- Handlers ---

// ListModels lists models with filters and pagination.
func (h *Handler) ListModels(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var q models.ListModelsQuery
	if err := c.ShouldBindQuery(&q); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if q.Limit <= 0 || q.Limit > 100 {
		q.Limit = 20
	}

	resp, err := h.svc.ListModels(c.Request.Context(), tenantID, q)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, resp)
}

// RegisterModel registers a new model.
func (h *Handler) RegisterModel(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	if userID == "" {
		userID = "system"
	}
	var req models.RegisterModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	m, err := h.svc.RegisterModel(c.Request.Context(), tenantID, userID, req)
	if err != nil {
		if err.Error() == service.ErrModelAlreadyExists.Error() {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, m)
}

// GetModel retrieves a model by ID.
func (h *Handler) GetModel(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	modelID := c.Param("id")

	m, err := h.svc.GetModel(c.Request.Context(), tenantID, modelID)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, m)
}

// UpdateModel updates model metadata.
func (h *Handler) UpdateModel(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	modelID := c.Param("id")
	var req models.UpdateModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	m, err := h.svc.UpdateModel(c.Request.Context(), tenantID, modelID, req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, m)
}

// DeleteModel deletes a model.
func (h *Handler) DeleteModel(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	modelID := c.Param("id")

	if err := h.svc.DeleteModel(c.Request.Context(), tenantID, modelID); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	c.JSON(http.StatusNoContent, gin.H{"ok": true})
}

// ListVersions lists versions for a model.
func (h *Handler) ListVersions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	modelID := c.Param("id")
	var q models.ListVersionsQuery
	if err := c.ShouldBindQuery(&q); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if q.Limit <= 0 || q.Limit > 100 {
		q.Limit = 20
	}

	resp, err := h.svc.ListVersions(c.Request.Context(), tenantID, modelID, q)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, resp)
}

// PublishVersion publishes a new version.
func (h *Handler) PublishVersion(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	modelID := c.Param("id")
	userID := c.GetString("user_id")
	if userID == "" {
		userID = "system"
	}
	var req models.PublishVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	v, err := h.svc.PublishVersion(c.Request.Context(), tenantID, modelID, userID, req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondCreated(c, v)
}

// GetVersion retrieves a version by ID.
func (h *Handler) GetVersion(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	modelID := c.Param("id")
	versionID := c.Param("versionId")

	v, err := h.svc.GetVersion(c.Request.Context(), tenantID, modelID, versionID)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, v)
}

// PromoteVersion promotes a version to the target environment.
func (h *Handler) PromoteVersion(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	modelID := c.Param("id")
	versionID := c.Param("versionId")
	userID := c.GetString("user_id")
	if userID == "" {
		userID = "system"
	}
	var req models.PromoteVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	v, err := h.svc.PromoteVersion(c.Request.Context(), tenantID, modelID, versionID, userID, req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, v)
}

// RollbackVersion rolls back to the previous production version.
func (h *Handler) RollbackVersion(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	modelID := c.Param("id")

	v, err := h.svc.RollbackVersion(c.Request.Context(), tenantID, modelID)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, v)
}

// GetModelMetrics returns current metrics and history.
func (h *Handler) GetModelMetrics(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	modelID := c.Param("id")

	resp, err := h.svc.GetModelMetrics(c.Request.Context(), tenantID, modelID)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, resp)
}

// ConfigureCanary sets up a canary release.
func (h *Handler) ConfigureCanary(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	_ = c.GetString("user_id") // unused
	modelID := c.Param("id")
	var req models.CanaryConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	cn, err := h.svc.ConfigureCanary(c.Request.Context(), tenantID, modelID, req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondCreated(c, cn)
}

// GetCanaryConfig retrieves the canary config.
func (h *Handler) GetCanaryConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	modelID := c.Param("id")

	cn, err := h.svc.GetCanaryConfig(c.Request.Context(), tenantID, modelID)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, cn)
}

// StopCanary stops the canary release.
func (h *Handler) StopCanary(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	modelID := c.Param("id")

	if err := h.svc.StopCanary(c.Request.Context(), tenantID, modelID); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	c.JSON(http.StatusNoContent, gin.H{"ok": true})
}

// --- Response helpers ---

// respondSuccess sends a 200 response with data.
func respondSuccess(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, gin.H{
		"ok":   true,
		"data": data,
	})
}

// respondCreated sends a 201 response with data.
func respondCreated(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, gin.H{
		"ok":   true,
		"data": data,
	})
}

// respondBadRequest sends a 400 response with error message.
func respondBadRequest(c *gin.Context, msg string) {
	c.JSON(http.StatusBadRequest, gin.H{
		"ok":    false,
		"error": gin.H{
			"code":    http.StatusBadRequest,
			"type":    "BadRequest",
			"message": msg,
		},
	})
}

// respondNotFound sends a 404 response with error message.
func respondNotFound(c *gin.Context, msg string) {
	c.JSON(http.StatusNotFound, gin.H{
		"ok":    false,
		"error": gin.H{
			"code":    http.StatusNotFound,
			"type":    "NotFound",
			"message": msg,
		},
	})
}

// respondInternalError sends a 500 response with error message.
func respondInternalError(c *gin.Context, msg string) {
	c.JSON(http.StatusInternalServerError, gin.H{
		"ok":    false,
		"error": gin.H{
			"code":    http.StatusInternalServerError,
			"type":    "InternalError",
			"message": msg,
		},
	})
}
