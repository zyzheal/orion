package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/alert/models"
	"orion/platform-svc-go/internal/alert/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	read := auth.RequirePermission("alert", "read")
	write := auth.RequirePermission("alert", "write")
	delete := auth.RequirePermission("alert", "delete")

	// ===== Alert Ingestion =====
	rg.POST("/alert/ingest", write, h.Ingest)

	// ===== Alert Correlation =====
	rg.POST("/alert/correlate", write, h.Correlate)
	rg.GET("/alert/topology", read, h.GetTopology)
	rg.POST("/alert/topology", write, h.SetTopology)

	// ===== Alert Deduplication =====
	rg.GET("/alert/deduplication/stats", read, h.GetDedupStats)
	rg.GET("/alert/groups", read, h.GetGroups)

	// ===== Alert Suppression =====
	rg.GET("/alert/suppression/stats", read, h.GetSuppressionStats)
	rg.GET("/alert/suppression/maintenance-windows", read, h.GetMaintenanceWindows)
	rg.POST("/alert/suppression/maintenance-windows", write, h.AddMaintenanceWindow)
	rg.GET("/alert/suppression/known-issues", read, h.GetKnownIssues)
	rg.POST("/alert/suppression/known-issues", write, h.AddKnownIssue)
	rg.GET("/alert/suppression/alerts", read, h.GetActiveAlerts)

	// ===== Alert List =====
	rg.GET("/alert/list", read, h.ListAlerts)
	rg.GET("/alert/:id", read, h.GetAlert)
	rg.PUT("/alert/:id", write, h.UpdateAlert)
	rg.DELETE("/alert/:id", delete, h.DeleteAlert)

	_ = delete
}

// ----- Alert Ingestion -----

func (h *Handler) Ingest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.IngestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	resp, err := h.svc.Ingest(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, resp)
}

// ----- Alert Correlation -----

func (h *Handler) Correlate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CorrelationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, "alerts is required")
		return
	}
	if len(req.Alerts) == 0 {
		respondBadRequest(c, "alerts is required")
		return
	}
	analysis, err := h.svc.Correlate(c.Request.Context(), tenantID, req.Alerts)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, analysis)
}

func (h *Handler) GetTopology(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	topo, err := h.svc.GetTopology(c.Request.Context(), tenantID)
	if err != nil {
		respondSuccess(c, gin.H{"topology": nil})
		return
	}
	respondSuccess(c, gin.H{"topology": topo})
}

func (h *Handler) SetTopology(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.TopologyNodesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, "Invalid topology")
		return
	}
	update, err := h.svc.SetTopology(c.Request.Context(), tenantID, req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{
		"status":    "updated",
		"nodeCount": update.NodeCount,
		"edgeCount": update.EdgeCount,
	})
}

// ----- Alert Deduplication -----

func (h *Handler) GetDedupStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetDedupStats(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"stats": stats})
}

func (h *Handler) GetGroups(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	groups, err := h.svc.GetActiveGroups(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"groups": groups})
}

// ----- Alert Suppression -----

func (h *Handler) GetSuppressionStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetSuppressionStats(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"stats": stats})
}

func (h *Handler) GetMaintenanceWindows(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	windows, err := h.svc.GetActiveMaintenanceWindows(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"windows": windows})
}

func (h *Handler) AddMaintenanceWindow(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.AddMaintenanceWindowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	_, err := h.svc.AddMaintenanceWindow(c.Request.Context(), tenantID, req)
	if err != nil {
		respondBadRequest(c, "Invalid maintenance window")
		return
	}
	respondCreated(c, gin.H{"status": "created"})
}

func (h *Handler) GetKnownIssues(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	issues, err := h.svc.GetOpenKnownIssues(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"issues": issues})
}

func (h *Handler) AddKnownIssue(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.AddKnownIssueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	_, err := h.svc.AddKnownIssue(c.Request.Context(), tenantID, req)
	if err != nil {
		respondBadRequest(c, "Invalid known issue")
		return
	}
	respondCreated(c, gin.H{"status": "created"})
}

func (h *Handler) GetActiveAlerts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	alerts, err := h.svc.GetActiveAlerts(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"alerts": alerts, "total": len(alerts)})
}

// ----- Alert List -----

func (h *Handler) ListAlerts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	severity := c.Query("severity")
	status := c.Query("status")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	result, err := h.svc.ListAlerts(c.Request.Context(), tenantID, severity, status, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"alerts": result.Alerts, "total": result.Total})
}

func (h *Handler) GetAlert(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	alert, err := h.svc.GetAlert(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, "Alert "+id+" not found")
		return
	}
	respondSuccess(c, gin.H{"alert": alert})
}

func (h *Handler) UpdateAlert(c *gin.Context) {
	respondSuccess(c, gin.H{"message": "update not implemented"})
}

func (h *Handler) DeleteAlert(c *gin.Context) {
	respondSuccess(c, gin.H{"message": "delete not implemented"})
}
