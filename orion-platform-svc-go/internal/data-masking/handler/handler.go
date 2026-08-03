package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/data-masking/models"
	"orion/platform-svc-go/internal/data-masking/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all data-masking endpoints under the given group.
// Routes: /api/v1/data-masking/*
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/data-masking")

	// --- Masking Rules CRUD ---
	f.GET("/rules", auth.RequirePermission("data-masking", "read"), h.ListRules)
	f.GET("/rules/:id", auth.RequirePermission("data-masking", "read"), h.GetRule)
	f.POST("/rules", auth.RequirePermission("data-masking", "write"), h.CreateRule)
	f.PUT("/rules/:id", auth.RequirePermission("data-mashing", "write"), h.UpdateRule)
	f.DELETE("/rules/:id", auth.RequirePermission("data-masking", "delete"), h.DeleteRule)

	// --- Mask / Apply ---
	f.POST("/mask", auth.RequirePermission("data-masking", "write"), h.ApplyMask)
}

// getTenantID extracts tenant_id from Gin context.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return ""
	}
	return tenantID
}

// --- Rule handlers ---

func (h *Handler) ListRules(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListRules")
	defer span.End()
	tenantID := h.getTenantID(c)
	rules, total, err := h.svc.ListRules(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"data":  rules,
		"total": total,
	})
}

func (h *Handler) GetRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRule")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	rule, err := h.svc.GetRule(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "masking rule not found")
		return
	}
	middleware.RespondSuccess(c, rule)
}

func (h *Handler) CreateRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateRule")
	defer span.End()
	var rule models.MaskingRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	rule.TenantID = tenantID
	if err := h.svc.CreateRule(ctx, &rule); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, rule)
}

func (h *Handler) UpdateRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateRule")
	defer span.End()
	id := c.Param("id")
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	rule, err := h.svc.UpdateRule(ctx, tenantID, id, updates)
	if err != nil {
		middleware.RespondNotFound(c, "masking rule not found")
		return
	}
	middleware.RespondSuccess(c, rule)
}

func (h *Handler) DeleteRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteRule")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.DeleteRule(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "masking rule not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "masking rule deleted"})
}

// --- Mask / Apply handlers ---

func (h *Handler) ApplyMask(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ApplyMask")
	defer span.End()
	var req models.MaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	result, err := h.svc.ApplyMask(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}
