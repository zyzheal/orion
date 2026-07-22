package handler

import (
	"errors"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/health-check/models"
	"orion/platform-svc-go/internal/health-check/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/sentinel"
)

var validCheckTypes = map[string]bool{
	"endpoint":   true,
	"database":   true,
	"redis":      true,
	"kubernetes": true,
}

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/health-checks")

	f.GET("", auth.RequirePermission("health-check", "read"), h.ListChecks)
	f.GET("/:id", auth.RequirePermission("health-check", "read"), h.GetCheck)
	f.POST("", auth.RequirePermission("health-check", "write"), h.CreateCheck)
	f.PUT("/:id", auth.RequirePermission("health-check", "write"), h.UpdateCheck)
	f.DELETE("/:id", auth.RequirePermission("health-check", "write"), h.DeleteCheck)
	f.POST("/:id/execute", auth.RequirePermission("health-check", "write"), h.ExecuteCheck)
	f.POST("/execute-all", auth.RequirePermission("health-check", "write"), h.ExecuteAll)
	f.POST("/quick", auth.RequirePermission("health-check", "write"), h.QuickCheck)
}

func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return ""
	}
	return tenantID
}

func (h *Handler) ListChecks(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListChecks")
	defer span.End()
	tenantID := h.getTenantID(c)
	checks, err := h.svc.List(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, checks)
}

func (h *Handler) GetCheck(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCheck")
	defer span.End()
	tenantID := h.getTenantID(c)
	check, err := h.svc.Get(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if check == nil {
		middleware.RespondNotFound(c, "health check not found")
		return
	}
	middleware.RespondSuccess(c, check)
}

func (h *Handler) CreateCheck(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateCheck")
	defer span.End()
	tenantID := h.getTenantID(c)
	var req models.CreateHealthCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if !validCheckTypes[req.CheckType] {
		middleware.RespondBadRequest(c, "invalid check type")
		return
	}
	id, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"id": id})
}

func (h *Handler) UpdateCheck(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateCheck")
	defer span.End()
	tenantID := h.getTenantID(c)
	var req models.CreateHealthCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if !validCheckTypes[req.CheckType] {
		middleware.RespondBadRequest(c, "invalid check type")
		return
	}
	if err := h.svc.Update(ctx, tenantID, c.Param("id"), req); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "health check updated"})
}

func (h *Handler) DeleteCheck(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteCheck")
	defer span.End()
	tenantID := h.getTenantID(c)
	if err := h.svc.Delete(ctx, tenantID, c.Param("id")); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "health check deleted"})
}

func (h *Handler) ExecuteCheck(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExecuteCheck")
	defer span.End()
	tenantID := h.getTenantID(c)
	var req models.ExecuteHealthCheckRequest
	_ = c.ShouldBindJSON(&req)

	result, err := h.svc.ExecuteCheck(ctx, tenantID, c.Param("id"), req)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) {
			middleware.RespondNotFound(c, "health check not found")
		} else {
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) ExecuteAll(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExecuteAll")
	defer span.End()
	tenantID := h.getTenantID(c)

	result, err := h.svc.ExecuteAll(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) QuickCheck(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "QuickCheck")
	defer span.End()
	var req models.QuickHealthCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if !validCheckTypes[req.CheckType] {
		middleware.RespondBadRequest(c, "invalid check type")
		return
	}

	result, err := h.svc.QuickCheck(ctx, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}
