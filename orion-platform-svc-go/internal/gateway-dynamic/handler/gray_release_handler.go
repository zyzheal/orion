package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/gateway-dynamic/models"
	"orion/platform-svc-go/internal/gateway-dynamic/service"

	"github.com/gin-gonic/gin"
)

// GrayReleaseHandler exposes HTTP endpoints for gray release management.
type GrayReleaseHandler struct {
	svc *service.GrayReleaseService
}

// NewGrayReleaseHandler creates a new GrayReleaseHandler instance.
func NewGrayReleaseHandler(svc *service.GrayReleaseService) *GrayReleaseHandler {
	return &GrayReleaseHandler{svc: svc}
}

// RegisterRoutes mounts all gray release routes onto the given router group.
// Mounted under /routes/:routeID/gray (or /gray at group level).
func (h *GrayReleaseHandler) RegisterRoutes(rg *gin.RouterGroup) {
	g := rg.Group("")

	// Create gray release config for a route
	g.POST("/gray", auth.RequirePermission("gateway_dynamic", "write"), h.CreateGrayRelease)

	// Get gray release status for a route
	g.GET("/gray/:routeID", auth.RequirePermission("gateway_dynamic", "read"), h.GetGrayRelease)

	// Update gray release config
	g.PUT("/gray/:routeID", auth.RequirePermission("gateway_dynamic", "write"), h.UpdateGrayRelease)

	// Enable gray release
	g.PATCH("/gray/:routeID/enable", auth.RequirePermission("gateway_dynamic", "write"), h.EnableGrayRelease)

	// Disable gray release
	g.PATCH("/gray/:routeID/disable", auth.RequirePermission("gateway_dynamic", "write"), h.DisableGrayRelease)

	// Rollback gray release
	g.PATCH("/gray/:routeID/rollback", auth.RequirePermission("gateway_dynamic", "delete"), h.RollbackGrayRelease)

	// Gray release stats
	g.GET("/gray/stats", auth.RequirePermission("gateway_dynamic", "read"), h.GrayReleaseStats)
}

// CreateGrayRelease creates a gray release config for a route.
func (h *GrayReleaseHandler) CreateGrayRelease(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	routeID := c.PostForm("route_id")
	if routeID == "" {
		respondBadRequest(c, "route_id is required")
		return
	}

	var req models.GrayReleaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if req.Strategy == "" {
		respondBadRequest(c, "strategy is required")
		return
	}

	result, err := h.svc.Create(c.Request.Context(), tenantID, routeID, req)
	if err != nil {
		if err == models.ErrInvalidPercentage {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, gin.H{"data": result})
}

// GetGrayRelease retrieves gray release status for a route.
func (h *GrayReleaseHandler) GetGrayRelease(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	routeID := c.Param("routeID")

	result, err := h.svc.Get(c.Request.Context(), tenantID, routeID)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": result})
}

// UpdateGrayRelease modifies gray release config.
func (h *GrayReleaseHandler) UpdateGrayRelease(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	routeID := c.Param("routeID")

	var req models.GrayReleaseUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	result, err := h.svc.Update(c.Request.Context(), tenantID, routeID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": result})
}

// EnableGrayRelease activates gray release for a route.
func (h *GrayReleaseHandler) EnableGrayRelease(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	routeID := c.Param("routeID")

	result, err := h.svc.Enable(c.Request.Context(), tenantID, routeID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": result})
}

// DisableGrayRelease deactivates gray release for a route.
func (h *GrayReleaseHandler) DisableGrayRelease(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	routeID := c.Param("routeID")

	result, err := h.svc.Disable(c.Request.Context(), tenantID, routeID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": result})
}

// RollbackGrayRelease performs a rollback on gray release for a route.
func (h *GrayReleaseHandler) RollbackGrayRelease(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	routeID := c.Param("routeID")

	result, err := h.svc.Rollback(c.Request.Context(), tenantID, routeID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": result})
}

// GrayReleaseStats returns aggregate gray release stats for a tenant.
func (h *GrayReleaseHandler) GrayReleaseStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	stats, err := h.svc.Stats(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": stats})
}
