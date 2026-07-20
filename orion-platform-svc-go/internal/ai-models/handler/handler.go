package handler

import (
	"net/http"
	"orion/platform-svc-go/internal/middleware"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/ai-models/models"
	"orion/platform-svc-go/internal/ai-models/service"

	"github.com/gin-gonic/gin"
	"orion/go-common/pkg/errors"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/sentinel"
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

// --- Handlers ---

// ListModels lists models with filters and pagination.
func (h *Handler) ListModels(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListModels")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var q models.ListModelsQuery
	if err := c.ShouldBindQuery(&q); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if q.Limit <= 0 || q.Limit > 100 {
		q.Limit = 20
	}

	resp, err := h.svc.ListModels(ctx, tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, resp)
}

// RegisterModel registers a new model.
func (h *Handler) RegisterModel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RegisterModel")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	if userID == "" {
		userID = "system"
	}
	var req models.RegisterModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	m, err := h.svc.RegisterModel(ctx, tenantID, userID, req)
	if err != nil {
		if err.Error() == service.ErrModelAlreadyExists.Error() {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, m)
}

// GetModel retrieves a model by ID.
func (h *Handler) GetModel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetModel")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	modelID := c.Param("id")

	m, err := h.svc.GetModel(ctx, tenantID, modelID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

// UpdateModel updates model metadata.
func (h *Handler) UpdateModel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateModel")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	modelID := c.Param("id")
	var req models.UpdateModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	m, err := h.svc.UpdateModel(ctx, tenantID, modelID, req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

// DeleteModel deletes a model.
func (h *Handler) DeleteModel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteModel")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	modelID := c.Param("id")

	if err := h.svc.DeleteModel(ctx, tenantID, modelID); err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	c.Status(http.StatusNoContent)
}

// ListVersions lists versions for a model.
func (h *Handler) ListVersions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListVersions")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	modelID := c.Param("id")
	var q models.ListVersionsQuery
	if err := c.ShouldBindQuery(&q); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if q.Limit <= 0 || q.Limit > 100 {
		q.Limit = 20
	}

	resp, err := h.svc.ListVersions(ctx, tenantID, modelID, q)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, resp)
}

// PublishVersion publishes a new version.
func (h *Handler) PublishVersion(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PublishVersion")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	modelID := c.Param("id")
	userID := c.GetString("user_id")
	if userID == "" {
		userID = "system"
	}
	var req models.PublishVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	v, err := h.svc.PublishVersion(ctx, tenantID, modelID, userID, req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondCreated(c, v)
}

// GetVersion retrieves a version by ID.
func (h *Handler) GetVersion(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetVersion")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	modelID := c.Param("id")
	versionID := c.Param("versionId")

	v, err := h.svc.GetVersion(ctx, tenantID, modelID, versionID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, v)
}

// PromoteVersion promotes a version to the target environment.
func (h *Handler) PromoteVersion(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PromoteVersion")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	modelID := c.Param("id")
	versionID := c.Param("versionId")
	userID := c.GetString("user_id")
	if userID == "" {
		userID = "system"
	}
	var req models.PromoteVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	v, err := h.svc.PromoteVersion(ctx, tenantID, modelID, versionID, userID, req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, v)
}

// RollbackVersion rolls back to the previous production version.
func (h *Handler) RollbackVersion(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RollbackVersion")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	modelID := c.Param("id")

	v, err := h.svc.RollbackVersion(ctx, tenantID, modelID)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, v)
}

// GetModelMetrics returns current metrics and history.
func (h *Handler) GetModelMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetModelMetrics")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	modelID := c.Param("id")

	resp, err := h.svc.GetModelMetrics(ctx, tenantID, modelID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, resp)
}

// ConfigureCanary sets up a canary release.
func (h *Handler) ConfigureCanary(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigureCanary")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	_ = c.GetString("user_id") // unused
	modelID := c.Param("id")
	var req models.CanaryConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	cn, err := h.svc.ConfigureCanary(ctx, tenantID, modelID, req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondCreated(c, cn)
}

// GetCanaryConfig retrieves the canary config.
func (h *Handler) GetCanaryConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCanaryConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	modelID := c.Param("id")

	cn, err := h.svc.GetCanaryConfig(ctx, tenantID, modelID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, cn)
}

// StopCanary stops the canary release.
func (h *Handler) StopCanary(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StopCanary")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	modelID := c.Param("id")

	if err := h.svc.StopCanary(ctx, tenantID, modelID); err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	c.Status(http.StatusNoContent)
}

// --- Response helpers ---

// respondSuccess sends a 200 response with data.
func respondSuccess(c *gin.Context, data interface{}) {
	errors.WriteSuccess(c, data)
}

// respondCreated sends a 201 response with data.
func respondCreated(c *gin.Context, data interface{}) {
	errors.WriteCreated(c, data)
}

// respondBadRequest sends a 400 response with error message.
func respondBadRequest(c *gin.Context, msg string) {
	errors.WriteError(c, errors.ErrBadRequest, msg, http.StatusBadRequest)
}

// respondNotFound sends a 404 response with error message.
func respondNotFound(c *gin.Context, msg string) {
	errors.WriteError(c, errors.ErrNotFound, msg, http.StatusNotFound)
}

// respondInternalError sends a 500 response with error message.
func respondInternalError(c *gin.Context, msg string) {
	errors.WriteError(c, errors.ErrInternal, msg, http.StatusInternalServerError)
}
