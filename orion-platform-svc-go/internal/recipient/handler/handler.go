package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/recipient/models"
	"orion/platform-svc-go/internal/recipient/service"
)

// Handler 暴露 recipient 相关端点。
type Handler struct {
	svc service.ServiceInterface
}

func NewHandler(svc service.ServiceInterface) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/recipient-resolvers", auth.RequirePermission("recipient", "read"), h.ListResolvers)
	rg.POST("/recipient-resolve", auth.RequirePermission("recipient", "write"), h.Resolve)
}

// ListResolvers GET /api/v1/recipient-resolvers
func (h *Handler) ListResolvers(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Recipient.ListResolvers")
	defer span.End()
	_ = ctx

	kinds := h.svc.Kinds()
	out := make([]string, 0, len(kinds))
	for _, k := range kinds {
		out = append(out, string(k))
	}
	c.JSON(http.StatusOK, gin.H{"data": out})
}

// Resolve POST /api/v1/recipient-resolve
func (h *Handler) Resolve(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Recipient.Resolve")
	defer span.End()

	var req models.ResolveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := h.svc.Resolve(ctx, &req.Spec)
	if err != nil {
		switch {
		case err == service.ErrSpecInvalid:
			errors.WriteError(c, "E_RECIP_SPEC_INVALID", err.Error(), http.StatusBadRequest)
		case err == service.ErrKindUnknown:
			errors.WriteError(c, "E_RECIP_KIND_UNKNOWN", err.Error(), http.StatusBadRequest)
		case err == service.ErrParamMissing:
			errors.WriteError(c, "E_RECIP_PARAM_MISSING", err.Error(), http.StatusBadRequest)
		case err == service.ErrRefNotFound:
			errors.WriteError(c, "E_RECIP_REF_NOT_FOUND", err.Error(), http.StatusNotFound)
		case err == service.ErrResolveConflict:
			errors.WriteError(c, "E_RECIP_RESOLVE_CONFLICT", err.Error(), http.StatusConflict)
		case err == service.ErrResolverTimeout:
			errors.WriteError(c, "E_RECIP_RESOLVER_TIMEOUT", err.Error(), http.StatusServiceUnavailable)
		default:
			errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}
