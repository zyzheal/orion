package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/ueba/models"
	"orion/platform-svc-go/internal/ueba/service"

	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/ueba")

	f.GET("/alerts", auth.RequirePermission("ueba", "read"), h.ListAlerts)
	f.GET("/alerts/:id", auth.RequirePermission("ueba", "read"), h.GetAlert)
	// POST /alerts creates an alert manually
	f.POST("/alerts", auth.RequirePermission("ueba", "write"), h.CreateAlert)
	f.POST("/alerts/:id/dismiss", auth.RequirePermission("ueba", "write"), h.DismissAlert)

	f.GET("/profiles", auth.RequirePermission("ueba", "read"), h.ListProfiles)
	f.GET("/profiles/:entityId", auth.RequirePermission("ueba", "read"), h.GetProfile)

	f.POST("/detect", auth.RequirePermission("ueba", "write"), h.DetectAnomaly)
}

func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return ""
	}
	return tenantID
}

func (h *Handler) ListAlerts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAlerts")
	defer span.End()
	var q models.ListAlertsQuery
	if err := c.ShouldBindQuery(&q); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	alerts, err := h.svc.ListAlerts(ctx, tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"alerts": alerts, "count": len(alerts)})
}

func (h *Handler) GetAlert(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAlert")
	defer span.End()
	tenantID := h.getTenantID(c)
	alert, err := h.svc.GetAlert(ctx, c.Param("id"), tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "alert not found")
		} else {
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, gin.H{"alert": alert})
}

func (h *Handler) CreateAlert(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateAlert")
	defer span.End()
	var req models.CreateAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	alert, err := h.svc.CreateAlert(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"alert": alert})
}

func (h *Handler) DismissAlert(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DismissAlert")
	defer span.End()
	var req models.DismissAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	err := h.svc.DismissAlert(ctx, c.Param("id"), tenantID, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "alert not found")
		} else {
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "alert dismissed"})
}

func (h *Handler) ListProfiles(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListProfiles")
	defer span.End()
	tenantID := h.getTenantID(c)
	profiles, err := h.svc.ListProfiles(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"profiles": profiles, "count": len(profiles)})
}

func (h *Handler) GetProfile(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetProfile")
	defer span.End()
	tenantID := h.getTenantID(c)
	profile, err := h.svc.GetProfile(ctx, tenantID, c.Param("entityId"))
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "profile not found")
		} else {
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, gin.H{"profile": profile})
}

func (h *Handler) DetectAnomaly(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DetectAnomaly")
	defer span.End()
	var req models.DetectAnomalyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	alertReq, err := h.svc.DetectAnomaly(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	alert, err := h.svc.CreateAlert(ctx, tenantID, alertReq)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"alert": alert})
}
