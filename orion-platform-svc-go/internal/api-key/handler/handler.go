package handler

import (
	"net/http"

	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/api-key/models"
	"orion/platform-svc-go/internal/api-key/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/trace"
)

// Handler exposes HTTP endpoints for API key management.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler instance.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all api-key routes onto the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/api-keys", h.List)
	rg.POST("/api-keys", h.Create)
	rg.DELETE("/api-keys/:id", h.Delete)
}

// Create creates a new API key (returns plaintext once).
func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")

	var req models.CreateKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}

	key, err := h.svc.Create(ctx, tenantID, userID, &req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteCreated(c, gin.H{"id": key.ID, "name": key.Name, "key": key.PlaintextKey, "expires_at": key.ExpiresAt, "scope": key.Scope})
}

// List retrieves API keys for the current user.
func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")

	keys, err := h.svc.List(ctx, tenantID, userID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, keys)
}

// Delete removes an API key by id.
func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")

	if err := h.svc.Delete(ctx, tenantID, userID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	c.Status(http.StatusNoContent)
}
