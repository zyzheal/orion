package handler

import (
	"net/http"
	"orion/monitoring-svc-go/internal/alert/models"
	"orion/monitoring-svc-go/internal/alert/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.AlertService
}

func New(svc *service.AlertService) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	ag := rg.Group("/alert")
	ag.POST("/alerts", h.CreateAlert)
	ag.GET("/alerts", h.ListAlerts)
	ag.GET("/alerts/:id", h.GetAlert)
	ag.PUT("/alerts/:id/status", h.UpdateAlertStatus)
	ag.PUT("/alerts/:id/resolve", h.ResolveAlert)
	ag.DELETE("/alerts/:id", h.DeleteAlert)

	ag.POST("/silences", h.CreateSilence)
	ag.GET("/silences", h.ListSilences)

	ag.POST("/rca", h.RunRCA)
	ag.GET("/stats", h.GetStats)
}

func (h *Handler) CreateAlert(c *gin.Context) {
	var req models.CreateAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		tenantID = c.PostForm("tenant_id")
	}
	alert, err := h.svc.CreateAlert(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, alert)
}

func (h *Handler) GetAlert(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	alert, err := h.svc.GetAlert(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, "alert not found")
		return
	}
	respondSuccess(c, alert)
}

func (h *Handler) ListAlerts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	req := &models.AlertQueryRequest{
		Status:     c.Query("status"),
		Severity:   c.Query("severity"),
		SourceID:   c.Query("source_id"),
		Fingerprint: c.Query("fingerprint"),
	}
	resp, err := h.svc.ListAlerts(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": resp.Data, "total": resp.Total})
}

func (h *Handler) UpdateAlertStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.UpdateStatus(c.Request.Context(), tenantID, c.Param("id"), req.Status); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "status updated"})
}

func (h *Handler) ResolveAlert(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Resolve(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "alert resolved"})
}

func (h *Handler) DeleteAlert(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteAlert(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) CreateSilence(c *gin.Context) {
	var req models.CreateSilenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := c.GetString("tenant_id")
	silence, err := h.svc.CreateSilence(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, silence)
}

func (h *Handler) ListSilences(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	resp, err := h.svc.ListSilences(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": resp.Data, "total": resp.Total})
}

func (h *Handler) RunRCA(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req struct {
		AlertID string `json:"alert_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.RunRCA(c.Request.Context(), tenantID, req.AlertID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) GetStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetStats(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, stats)
}
