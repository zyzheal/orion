// Package handler exposes the RDM statistics HTTP endpoints.
//
// Routes registered by RegisterRoutes:
//   GET /rdm/statistics/burndown/:sprintId
//   GET /rdm/statistics/velocity
//   GET /rdm/statistics/defects
//   GET /rdm/statistics/sprints
//
// These resolve R-P0-04 from the risk register (CC v5.4 §1.5.1):
// "RDM statistics/burndown/velocity 3 后端" (frontend 404 -> 200).
package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/rdm-statistics/service"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Handler wires HTTP requests to the RDM statistics Service.
type Handler struct {
	svc *service.Service
}

// NewHandler constructs a Handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers the 4 RDM statistics endpoints on the given
// router group (typically api.Group(...)). Path prefix /rdm/statistics
// is baked in so callers can pass api directly.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	st := rg.Group("/rdm/statistics")
	st.GET("/burndown/:sprintId", auth.RequirePermission("rdm", "read"), h.GetBurndown)
	st.GET("/velocity", auth.RequirePermission("rdm", "read"), h.GetVelocity)
	st.GET("/defects", auth.RequirePermission("rdm", "read"), h.GetDefectStats)
	st.GET("/sprints", auth.RequirePermission("rdm", "read"), h.GetSprintStats)
}

// GetBurndown handles GET /rdm/statistics/burndown/:sprintId.
func (h *Handler) GetBurndown(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RDMStatistics.GetBurndown")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	sprintID := c.Param("sprintId")
	data, err := h.svc.GetBurndown(ctx, tenantID, sprintID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, data)
}

// GetVelocity handles GET /rdm/statistics/velocity?projectId=&limit=.
func (h *Handler) GetVelocity(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RDMStatistics.GetVelocity")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	projectID := c.Query("projectId")
	limit := 10
	if raw := c.Query("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			limit = n
		}
	}
	data, err := h.svc.GetVelocity(ctx, tenantID, projectID, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, data)
}

// GetDefectStats handles GET /rdm/statistics/defects?projectId=.
func (h *Handler) GetDefectStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RDMStatistics.GetDefectStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	projectID := c.Query("projectId")
	data, err := h.svc.GetDefectStats(ctx, tenantID, projectID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, data)
}

// GetSprintStats handles GET /rdm/statistics/sprints?projectId=.
func (h *Handler) GetSprintStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RDMStatistics.GetSprintStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	projectID := c.Query("projectId")
	data, err := h.svc.GetSprintStats(ctx, tenantID, projectID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, data)
}
