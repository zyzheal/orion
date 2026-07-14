package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/ueba/models"
	"orion/platform-svc-go/internal/ueba/service"

	"github.com/gin-gonic/gin"
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
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

func (h *Handler) ListAlerts(c *gin.Context) {
	var q models.ListAlertsQuery
	if err := c.ShouldBindQuery(&q); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	alerts, err := h.svc.ListAlerts(c.Request.Context(), tenantID, q)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"alerts": alerts, "count": len(alerts)})
}

func (h *Handler) GetAlert(c *gin.Context) {
	tenantID := h.getTenantID(c)
	alert, err := h.svc.GetAlert(c.Request.Context(), c.Param("id"), tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "alert not found")
		} else {
			respondInternalError(c, err.Error())
		}
		return
	}
	respondSuccess(c, gin.H{"alert": alert})
}

func (h *Handler) CreateAlert(c *gin.Context) {
	var req models.CreateAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	alert, err := h.svc.CreateAlert(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, gin.H{"alert": alert})
}

func (h *Handler) DismissAlert(c *gin.Context) {
	var req models.DismissAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	err := h.svc.DismissAlert(c.Request.Context(), c.Param("id"), tenantID, &req)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "alert not found")
		} else {
			respondInternalError(c, err.Error())
		}
		return
	}
	respondSuccess(c, gin.H{"message": "alert dismissed"})
}

func (h *Handler) ListProfiles(c *gin.Context) {
	tenantID := h.getTenantID(c)
	profiles, err := h.svc.ListProfiles(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"profiles": profiles, "count": len(profiles)})
}

func (h *Handler) GetProfile(c *gin.Context) {
	tenantID := h.getTenantID(c)
	profile, err := h.svc.GetProfile(c.Request.Context(), tenantID, c.Param("entityId"))
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "profile not found")
		} else {
			respondInternalError(c, err.Error())
		}
		return
	}
	respondSuccess(c, gin.H{"profile": profile})
}

func (h *Handler) DetectAnomaly(c *gin.Context) {
	var req models.DetectAnomalyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	alertReq, err := h.svc.DetectAnomaly(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	alert, err := h.svc.CreateAlert(c.Request.Context(), tenantID, alertReq)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"alert": alert})
}
