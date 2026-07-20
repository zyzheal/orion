package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/alert/models"
	"orion/platform-svc-go/internal/alert/service"

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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Ingest")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.IngestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	resp, err := h.svc.Ingest(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, resp)
}

// ----- Alert Correlation -----

func (h *Handler) Correlate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Correlate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CorrelationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, "alerts is required")
		return
	}
	if len(req.Alerts) == 0 {
		middleware.RespondBadRequest(c, "alerts is required")
		return
	}
	analysis, err := h.svc.Correlate(ctx, tenantID, req.Alerts)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, analysis)
}

func (h *Handler) GetTopology(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTopology")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	topo, err := h.svc.GetTopology(ctx, tenantID)
	if err != nil {
		middleware.RespondSuccess(c, gin.H{"topology": nil})
		return
	}
	middleware.RespondSuccess(c, gin.H{"topology": topo})
}

func (h *Handler) SetTopology(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SetTopology")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.TopologyNodesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, "Invalid topology")
		return
	}
	update, err := h.svc.SetTopology(ctx, tenantID, req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"status":    "updated",
		"nodeCount": update.NodeCount,
		"edgeCount": update.EdgeCount,
	})
}

// ----- Alert Deduplication -----

func (h *Handler) GetDedupStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDedupStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetDedupStats(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"stats": stats})
}

func (h *Handler) GetGroups(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetGroups")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	groups, err := h.svc.GetActiveGroups(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"groups": groups})
}

// ----- Alert Suppression -----

func (h *Handler) GetSuppressionStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSuppressionStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetSuppressionStats(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"stats": stats})
}

func (h *Handler) GetMaintenanceWindows(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetMaintenanceWindows")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	windows, err := h.svc.GetActiveMaintenanceWindows(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"windows": windows})
}

func (h *Handler) AddMaintenanceWindow(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AddMaintenanceWindow")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.AddMaintenanceWindowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	_, err := h.svc.AddMaintenanceWindow(ctx, tenantID, req)
	if err != nil {
		middleware.RespondBadRequest(c, "Invalid maintenance window")
		return
	}
	middleware.RespondCreated(c, gin.H{"status": "created"})
}

func (h *Handler) GetKnownIssues(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetKnownIssues")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	issues, err := h.svc.GetOpenKnownIssues(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"issues": issues})
}

func (h *Handler) AddKnownIssue(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AddKnownIssue")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.AddKnownIssueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	_, err := h.svc.AddKnownIssue(ctx, tenantID, req)
	if err != nil {
		middleware.RespondBadRequest(c, "Invalid known issue")
		return
	}
	middleware.RespondCreated(c, gin.H{"status": "created"})
}

func (h *Handler) GetActiveAlerts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetActiveAlerts")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	alerts, err := h.svc.GetActiveAlerts(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"alerts": alerts, "total": len(alerts)})
}

// ----- Alert List -----

func (h *Handler) ListAlerts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAlerts")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	severity := c.Query("severity")
	status := c.Query("status")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	result, err := h.svc.ListAlerts(ctx, tenantID, severity, status, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"alerts": result.Alerts, "total": result.Total})
}

func (h *Handler) GetAlert(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAlert")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	alert, err := h.svc.GetAlert(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "Alert "+id+" not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"alert": alert})
}

func (h *Handler) UpdateAlert(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateAlert")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req service.UpdateAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	alert, err := h.svc.UpdateAlert(ctx, tenantID, id, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"alert": alert})
}

func (h *Handler) DeleteAlert(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteAlert")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteAlert(ctx, tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"status": "deleted"})
}
