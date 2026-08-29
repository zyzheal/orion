package handler

import (
	"net/http"

	"orion/platform-svc-go/internal/agents/models"
	"orion/platform-svc-go/internal/agents/repository"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	repo *repository.Repository
}

func NewHandler(db *sqlx.DB) *Handler {
	return &Handler{repo: repository.NewRepository(db)}
}

func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	r := router.Group("/agents")
	r.GET("", h.List)
	r.GET("/:id", h.Get)
	r.POST("", h.Create)
	r.DELETE("/:id", h.Delete)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAgents")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.repo.List(ctx, tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAgent")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	item, err := h.repo.Get(ctx, tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateAgent")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item := &models.AgentItem{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Enabled:     req.Enabled,
	}
	if err := h.repo.Create(ctx, item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteAgent")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.repo.Delete(ctx, tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
