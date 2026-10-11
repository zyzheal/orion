package handler

import (
	"errors"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/alert-breaker/evaluator"
	"orion/platform-svc-go/internal/alert-breaker/models"
	"orion/platform-svc-go/internal/alert-breaker/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct {
	svc service.ServiceInterface
}

func NewHandler(svc service.ServiceInterface) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/alert-breaker")

	f.GET("", auth.RequirePermission("alert-breaker", "read"), h.ListAlertBreakers)
	f.GET("/:id", auth.RequirePermission("alert-breaker", "read"), h.GetAlertBreaker)
	f.POST("", auth.RequirePermission("alert-breaker", "write"), h.CreateAlertBreaker)
	f.PUT("/:id", auth.RequirePermission("alert-breaker", "write"), h.UpdateAlertBreaker)
	f.DELETE("/:id", auth.RequirePermission("alert-breaker", "delete"), h.DeleteAlertBreaker)
	// Runtime evaluation endpoint (ADR-010 §3.2.3). The path is registered
	// BEFORE the /:id wildcard so Gin's router picks the literal segment.
	f.POST("/evaluate", auth.RequirePermission("alert-breaker", "write"), h.EvaluateAlert)
}

func (h *Handler) ListAlertBreakers(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAlertBreakers")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	result, total, err := h.svc.List(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result, "total": total})
}

func (h *Handler) GetAlertBreaker(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAlertBreaker")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "alert breaker not found")
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) CreateAlertBreaker(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateAlertBreaker")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateAlertBreakerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.Create(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

func (h *Handler) UpdateAlertBreaker(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateAlertBreaker")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateAlertBreakerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.Update(ctx, tenantID, id, &req)
	if err != nil {
		middleware.RespondNotFound(c, "alert breaker not found")
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) DeleteAlertBreaker(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteAlertBreaker")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	deleted, err := h.svc.Delete(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "alert breaker not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "alert breaker deleted"})
}

// EvaluateAlert handles POST /alert-breaker/evaluate. The caller supplies
// policy_id (numeric, matching alert_breaker_state.policy_id), alert_id,
// fingerprint, and rule. Returns the broken/pass decision.
func (h *Handler) EvaluateAlert(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EvaluateAlert")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.EvaluateAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.Evaluate(ctx, tenantID, &req)
	if err != nil {
		if errors.Is(err, service.ErrNoEvaluator) {
			middleware.RespondInternalError(c, err.Error())
			return
		}
		// Invalid rule / missing threshold etc. → 400
		if errors.Is(err, evaluator.ErrInvalidRule) ||
			errors.Is(err, evaluator.ErrMissingThreshold) ||
			errors.Is(err, evaluator.ErrMissingWindow) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}
