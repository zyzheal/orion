package handler

import (
	"orion/platform-svc-go/internal/rate-limiting/models"
	"orion/platform-svc-go/internal/rate-limiting/repository"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct {
	repo *repository.Repository
}

func NewHandler(db *sqlx.DB) *Handler {
	return &Handler{repo: repository.NewRepository(db)}
}

func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	r := router.Group("/rate-limiting")
	r.GET("", h.List)
	r.GET("/:id", h.Get)
	r.POST("", h.Create)
	r.DELETE("/:id", h.Delete)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListRateLimits")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.repo.List(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"items": items})
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRateLimit")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	item, err := h.repo.Get(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, "not found")
		return
	}
	middleware.RespondSuccess(c, item)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateRateLimit")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateRateLimitingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	item := &models.RateLimitingItem{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Enabled:     req.Enabled,
	}
	if err := h.repo.Create(ctx, item); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, item)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteRateLimit")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.repo.Delete(ctx, tenantID, c.Param("id")); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"ok": true})
}
