package handler

import (
    "fmt"
    "net/http"

    "orion/go-common/pkg/auth"
    "orion/go-common/pkg/errors"
    "orion/platform-svc-go/internal/ai-security/models"
    "orion/platform-svc-go/internal/ai-security/service"

    "github.com/gin-gonic/gin"
)

// BLUEPRINT STATUS: This module provides the CRUD skeleton and route definitions for
// AI security features (policy management, audit logging, access blocking, risk scoring).
// Core security functions (prompt injection detection, PII filtering, content safety scoring)
// return placeholder responses and require integration with an AI security engine.

type Handler struct {
    svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
    return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
    r := rg.Group("/ai-security")
    r.GET("", auth.RequirePermission("ai-security", "read"), h.List)
    r.GET("/:id", auth.RequirePermission("ai-security", "read"), h.Get)
    r.POST("", auth.RequirePermission("ai-security", "write"), h.Create)
    r.PUT("/:id", auth.RequirePermission("ai-security", "write"), h.Update)
    r.DELETE("/:id", auth.RequirePermission("ai-security", "delete"), h.Delete)
    r.GET("/policies", auth.RequirePermission("ai-security", "read"), h.ListPolicies)
    r.GET("/audit", auth.RequirePermission("ai-security", "read"), h.GetAuditLog)
    r.POST("/block", auth.RequirePermission("ai-security", "write"), h.BlockAccess)
    r.GET("/score", auth.RequirePermission("ai-security", "read"), h.GetRiskScore)
}

func (h *Handler) List(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    ctx := c.Request.Context()
    q := models.ListQuery{}
    if p := c.Query("page"); p != "" { fmt.Sscanf(p, "%d", &q.Page) }
    if l := c.Query("limit"); l != "" { fmt.Sscanf(l, "%d", &q.Limit) }
    records, err := h.svc.List(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": records, "total": len(records)})
}

func (h *Handler) Get(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    ctx := c.Request.Context()
    record, err := h.svc.Get(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrNotFound, "not found", http.StatusNotFound)
        return
    }
    errors.WriteSuccess(c, record)
}

func (h *Handler) Create(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    ctx := c.Request.Context()
    var req models.CreateRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
        return
    }
    record, err := h.svc.Create(ctx, tenantID, req)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, record)
}

func (h *Handler) Update(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    ctx := c.Request.Context()
    var req models.CreateRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
        return
    }
    record, err := h.svc.Update(ctx, tenantID, c.Param("id"), req)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, record)
}

func (h *Handler) Delete(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    ctx := c.Request.Context()
    err := h.svc.Delete(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, nil)
}

// ---- AI Security-specific endpoints ----

// ListPolicies returns the security policies for the tenant.
func (h *Handler) ListPolicies(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    ctx := c.Request.Context()
    policies, err := h.svc.ListPolicies(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": policies, "total": len(policies)})
}

// GetAuditLog returns the audit log for the tenant.
func (h *Handler) GetAuditLog(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    ctx := c.Request.Context()
    logs, err := h.svc.GetAuditLog(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"logs": logs, "total": len(logs)})
}

// BlockAccess blocks access for a target.
func (h *Handler) BlockAccess(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    ctx := c.Request.Context()
    target := c.Query("target")
    if target == "" {
        target = c.Param("target")
    }
    result, err := h.svc.BlockAccess(ctx, tenantID, target)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, result)
}

// GetRiskScore returns the risk score for a resource.
func (h *Handler) GetRiskScore(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    ctx := c.Request.Context()
    id := c.Param("id")
    result, err := h.svc.GetRiskScore(ctx, tenantID, id)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, result)
}