package handler

import (
	"orion/platform-svc-go/internal/notification/notification/models"
	"orion/platform-svc-go/internal/notification/notification/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// DashboardHandler exposes HTTP endpoints for dashboard and widget management.
type DashboardHandler struct {
	dashboardSvc *service.DashboardService
}

// NewDashboardHandler creates a new DashboardHandler.
func NewDashboardHandler(dashboardSvc *service.DashboardService) *DashboardHandler {
	return &DashboardHandler{dashboardSvc: dashboardSvc}
}

// RegisterRoutes mounts all dashboard endpoints onto the given router group.
func (h *DashboardHandler) RegisterRoutes(rg *gin.RouterGroup) {
	dash := rg.Group("/dashboard")
	dash.Use(auth.RequirePermission("notification", "write"))
	{
		dash.GET("/overview", h.Overview)
		dash.GET("", h.List)
		dash.POST("", h.Create)
		dash.GET("/:id", h.Get)
		dash.PUT("/:id", h.Update)
		dash.DELETE("/:id", auth.RequirePermission("notification", "delete"), h.Delete)
	}

	widgets := rg.Group("/dashboard/:dashboard_id/widgets")
	widgets.Use(auth.RequirePermission("notification", "write"))
	{
		widgets.GET("", h.ListWidgets)
		widgets.POST("", h.CreateWidget)
		widgets.GET("/:id", h.GetWidget)
		widgets.PUT("/:id", h.UpdateWidget)
		widgets.DELETE("/:id", auth.RequirePermission("notification", "delete"), h.DeleteWidget)
	}
}

// Overview handles GET /dashboard/overview - aggregate dashboard stats.
func (h *DashboardHandler) Overview(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	overview, err := h.dashboardSvc.GetOverview(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, overview)
}

// List handles GET /dashboard - list all dashboards for a tenant.
func (h *DashboardHandler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	dashboards, err := h.dashboardSvc.ListDashboards(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, dashboards)
}

// Create handles POST /dashboard - create a new dashboard.
func (h *DashboardHandler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var d models.Dashboard
	if err := c.ShouldBindJSON(&d); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if err := h.dashboardSvc.CreateDashboard(c.Request.Context(), tenantID, &d); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, d)
}

// Get handles GET /dashboard/:id - get a single dashboard.
func (h *DashboardHandler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	d, err := h.dashboardSvc.GetDashboard(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		if err == service.ErrDashboardNotFound {
			respondNotFound(c, "dashboard not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

// Update handles PUT /dashboard/:id - update a dashboard.
func (h *DashboardHandler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var d models.Dashboard
	if err := c.ShouldBindJSON(&d); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if err := h.dashboardSvc.UpdateDashboard(c.Request.Context(), tenantID, c.Param("id"), &d); err != nil {
		if err == service.ErrDashboardNotFound {
			respondNotFound(c, "dashboard not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "updated"})
}

// Delete handles DELETE /dashboard/:id - delete a dashboard.
func (h *DashboardHandler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.dashboardSvc.DeleteDashboard(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		if err == service.ErrDashboardNotFound {
			respondNotFound(c, "dashboard not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

// ListWidgets handles GET /dashboard/:dashboard_id/widgets - list widgets.
func (h *DashboardHandler) ListWidgets(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	widgets, err := h.dashboardSvc.ListWidgets(c.Request.Context(), tenantID)
	if err != nil {
		if err == service.ErrDashboardNotFound {
			respondNotFound(c, "dashboard not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, widgets)
}

// CreateWidget handles POST /dashboard/:dashboard_id/widgets - create a widget.
func (h *DashboardHandler) CreateWidget(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var w models.DashboardWidget
	if err := c.ShouldBindJSON(&w); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if err := h.dashboardSvc.CreateWidget(c.Request.Context(), tenantID, &w); err != nil {
		if err == service.ErrDashboardNotFound {
			respondNotFound(c, "dashboard not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, w)
}

// GetWidget handles GET /dashboard/:dashboard_id/widgets/:id - get a widget.
func (h *DashboardHandler) GetWidget(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	w, err := h.dashboardSvc.GetWidget(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		if err == service.ErrWidgetNotFound {
			respondNotFound(c, "widget not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, w)
}

// UpdateWidget handles PUT /dashboard/:dashboard_id/widgets/:id - update a widget.
func (h *DashboardHandler) UpdateWidget(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var w models.DashboardWidget
	if err := c.ShouldBindJSON(&w); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if err := h.dashboardSvc.UpdateWidget(c.Request.Context(), tenantID, c.Param("id"), &w); err != nil {
		if err == service.ErrWidgetNotFound {
			respondNotFound(c, "widget not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "updated"})
}

// DeleteWidget handles DELETE /dashboard/:dashboard_id/widgets/:id - delete a widget.
func (h *DashboardHandler) DeleteWidget(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.dashboardSvc.DeleteWidget(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		if err == service.ErrWidgetNotFound {
			respondNotFound(c, "widget not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}