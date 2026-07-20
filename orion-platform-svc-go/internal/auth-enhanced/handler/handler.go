package handler

import (
	"context"
	"strconv"
	"time"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/auth-enhanced/models"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/trace"
)

// Service defines the methods the handler calls on the service layer.
type Service interface {
	CreateKey(ctx context.Context, tenantID string, req *models.CreateAuthKeyRequest) (*models.AuthKey, error)
	GetKey(ctx context.Context, tenantID, id string) (*models.AuthKey, error)
	ListKeys(ctx context.Context, tenantID string, status *string) ([]models.AuthKey, error)
	DeactivateKey(ctx context.Context, tenantID, id string) error
	DeleteKey(ctx context.Context, tenantID, id string) (bool, error)
	BlacklistToken(ctx context.Context, tenantID string, req *models.CreateBlacklistRequest, expiresAt time.Time) (*models.AuthTokenBlacklist, error)
	ListBlacklist(ctx context.Context, tenantID string) ([]models.AuthTokenBlacklist, error)
	DeleteBlacklist(ctx context.Context, tenantID, id string) (bool, error)
}

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/auth-enhanced")

	// Key management
	f.POST("/keys", auth.RequirePermission("auth-enhanced", "write"), h.CreateKey)
	f.GET("/keys", auth.RequirePermission("auth-enhanced", "read"), h.ListKeys)
	f.GET("/keys/:id", auth.RequirePermission("auth-enhanced", "read"), h.GetKey)
	f.PUT("/keys/:id/deactivate", auth.RequirePermission("auth-enhanced", "write"), h.DeactivateKey)
	f.DELETE("/keys/:id", auth.RequirePermission("auth-enhanced", "delete"), h.DeleteKey)

	// Token blacklist
	f.POST("/blacklist", auth.RequirePermission("auth-enhanced", "write"), h.BlacklistToken)
	f.GET("/blacklist", auth.RequirePermission("auth-enhanced", "read"), h.ListBlacklist)
	f.DELETE("/blacklist/:id", auth.RequirePermission("auth-enhanced", "delete"), h.DeleteBlacklist)
}

func (h *Handler) CreateKey(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateKey")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateAuthKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.CreateKey(ctx, tenantID, &req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	c.JSON(201, result)
}

func (h *Handler) GetKey(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetKey")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	_ = tenantID
	result, err := h.svc.GetKey(ctx, tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "key not found", 404)
		return
	}
	c.JSON(200, result)
}

func (h *Handler) ListKeys(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListKeys")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	status := c.Query("status")
	keys, err := h.svc.ListKeys(ctx, tenantID, &status)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, keys)
}

func (h *Handler) DeactivateKey(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeactivateKey")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeactivateKey(ctx, tenantID, id); err != nil {
		errors.WriteError(c, errors.ErrNotFound, "key not found", 404)
		return
	}
errors.WriteSuccess(c, gin.H{"message": "key deactivated"})
}

func (h *Handler) DeleteKey(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteKey")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	deleted, err := h.svc.DeleteKey(ctx, tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	if !deleted {
		errors.WriteError(c, errors.ErrNotFound, "key not found", 404)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "key deleted"})
}

func (h *Handler) BlacklistToken(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "BlacklistToken")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateBlacklistRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	expiresAt := time.Now().UTC().Add(24 * time.Hour)
	if hours := c.Query("expiresHours"); hours != "" {
		if h, err := strconv.Atoi(hours); err == nil && h > 0 {
			expiresAt = time.Now().UTC().Add(time.Duration(h) * time.Hour)
		}
	}
	result, err := h.svc.BlacklistToken(ctx, tenantID, &req, expiresAt)
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	c.JSON(201, result)
}

func (h *Handler) ListBlacklist(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListBlacklist")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	tokens, err := h.svc.ListBlacklist(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, tokens)
}

func (h *Handler) DeleteBlacklist(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteBlacklist")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	deleted, err := h.svc.DeleteBlacklist(ctx, tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	if !deleted {
		errors.WriteError(c, errors.ErrNotFound, "blacklist entry not found", 404)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "blacklist entry deleted"})
}
