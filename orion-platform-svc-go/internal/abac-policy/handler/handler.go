package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/abac-policy/models"
	"orion/platform-svc-go/internal/abac-policy/repository"
	"orion/platform-svc-go/internal/abac-policy/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel/trace"
	"orion/go-common/pkg/sentinel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/abac-policy")

	f.GET("", auth.RequirePermission("abac-policy", "read"), h.ListPolicies)
	f.POST("", auth.RequirePermission("abac-policy", "write"), h.CreatePolicy)
	f.GET("/:id", auth.RequirePermission("abac-policy", "read"), h.GetPolicy)
	f.PUT("/:id", auth.RequirePermission("abac-policy", "write"), h.UpdatePolicy)
	f.DELETE("/:id", auth.RequirePermission("abac-policy", "delete"), h.DeletePolicy)
}

func (h *Handler) ListPolicies(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListPolicies")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	filter := &models.ABACPolicyFilter{Limit: 20}
	if l := c.Query("limit"); l != "" {
		filter.Limit, _ = strconv.Atoi(l)
	}
	if s := c.Query("status"); s != "" {
		filter.Status = &s
	}
	if rt := c.Query("resourceType"); rt != "" {
		filter.ResourceType = &rt
	}
	if a := c.Query("action"); a != "" {
		filter.Action = &a
	}

	result, total, err := h.svc.List(ctx, tenantID, filter)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result, "total": total})
}

func (h *Handler) CreatePolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreatePolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateABACPolicyRequest
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

func (h *Handler) GetPolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetPolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.GetByID(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "policy not found")
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) UpdatePolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdatePolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateABACPolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.Update(ctx, tenantID, id, &req)
	if err != nil {
		if err == sentinel.NotFound {
			middleware.RespondNotFound(c, "policy not found")
			return
		}
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) DeletePolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeletePolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	deleted, err := h.svc.Delete(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "policy not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "policy deleted"})
}
