package handler

import (
	"errors"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/health-check/models"
	"orion/platform-svc-go/internal/health-check/service"

	"github.com/gin-gonic/gin"
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
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

func (h *Handler) ListChecks(c *gin.Context) {
	tenantID := h.getTenantID(c)
	ctx := c.Request.Context()
	checks, err := h.svc.List(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, checks)
}

func (h *Handler) GetCheck(c *gin.Context) {
	tenantID := h.getTenantID(c)
	ctx := c.Request.Context()
	check, err := h.svc.Get(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if check == nil {
		respondNotFound(c, "health check not found")
		return
	}
	respondSuccess(c, check)
}

func (h *Handler) CreateCheck(c *gin.Context) {
	tenantID := h.getTenantID(c)
	ctx := c.Request.Context()
	var req models.CreateHealthCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if !validCheckTypes[req.CheckType] {
		respondBadRequest(c, "invalid check type")
		return
	}
	id, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, gin.H{"id": id})
}

func (h *Handler) UpdateCheck(c *gin.Context) {
	tenantID := h.getTenantID(c)
	ctx := c.Request.Context()
	var req models.CreateHealthCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if !validCheckTypes[req.CheckType] {
		respondBadRequest(c, "invalid check type")
		return
	}
	if err := h.svc.Update(ctx, tenantID, c.Param("id"), req); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "health check updated"})
}

func (h *Handler) DeleteCheck(c *gin.Context) {
	tenantID := h.getTenantID(c)
	ctx := c.Request.Context()
	if err := h.svc.Delete(ctx, tenantID, c.Param("id")); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "health check deleted"})
}

func (h *Handler) ExecuteCheck(c *gin.Context) {
	tenantID := h.getTenantID(c)
	ctx := c.Request.Context()
	var req models.ExecuteHealthCheckRequest
	_ = c.ShouldBindJSON(&req)

	result, err := h.svc.ExecuteCheck(ctx, tenantID, c.Param("id"), req)
	if err != nil {
		if errors.Is(err, service.ErrNotFound) {
			respondNotFound(c, "health check not found")
		} else {
			respondInternalError(c, err.Error())
		}
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) ExecuteAll(c *gin.Context) {
	tenantID := h.getTenantID(c)
	ctx := c.Request.Context()

	result, err := h.svc.ExecuteAll(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) QuickCheck(c *gin.Context) {
	ctx := c.Request.Context()
	var req models.QuickHealthCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if !validCheckTypes[req.CheckType] {
		respondBadRequest(c, "invalid check type")
		return
	}

	result, err := h.svc.QuickCheck(ctx, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}
