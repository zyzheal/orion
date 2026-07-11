package handler

import (
	"net/http"
	"strconv"

	"orion-audit-svc-go/internal/models"
	"orion-audit-svc-go/internal/service"

	"github.com/gin-gonic/gin"
)

type AuditHandler struct {
	svc *service.AuditService
}

func NewAuditHandler(svc *service.AuditService) *AuditHandler {
	return &AuditHandler{svc: svc}
}

func (h *AuditHandler) RegisterRoutes(rg *gin.RouterGroup) {
	a := rg.Group("/audit")
	{
		a.POST("/log", h.LogEvent)
		a.GET("/logs", h.ListLogs)
		a.GET("/logs/:id", h.GetLog)
		a.GET("/events", h.ListEvents)
		a.GET("/events/:deploymentId", h.GetEventsByDeployment)
		a.GET("/summary", h.GetSummary)
		a.POST("/compliance-reports", h.CreateComplianceReport)
		a.GET("/compliance-reports", h.ListComplianceReports)
		a.GET("/compliance-reports/:id", h.GetComplianceReport)
		a.DELETE("/logs/batch", h.DeleteBatch)
		a.GET("/export", h.Export)
	}
}

func (h *AuditHandler) LogEvent(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tenant_id is required"})
		return
	}
	var req models.LogEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	actor := c.GetString("user_id")
	log, err := h.svc.LogEvent(c.Request.Context(), tenantID, &req, actor)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": log})
}

func (h *AuditHandler) GetLog(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	log, err := h.svc.GetLog(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "audit log not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": log})
}

func (h *AuditHandler) ListLogs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tenant_id is required"})
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	actor := c.Query("actor")
	action := c.Query("action")
	targetType := c.Query("targetType")
	targetID := c.Query("targetId")
	logs, total, err := h.svc.ListLogs(c.Request.Context(), tenantID, page, pageSize, actor, action, targetType, targetID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": logs, "total": total})
}

func (h *AuditHandler) ListEvents(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tenant_id is required"})
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	action := c.Query("action")
	kind := c.Query("kind")
	events, total, err := h.svc.ListEvents(c.Request.Context(), tenantID, page, pageSize, action, kind)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": events, "total": total})
}

func (h *AuditHandler) GetEventsByDeployment(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	deploymentID := c.Param("deploymentId")
	events, err := h.svc.GetEventsByDeployment(c.Request.Context(), tenantID, deploymentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": events})
}

func (h *AuditHandler) GetSummary(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	summary, err := h.svc.GetSummary(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": summary})
}

func (h *AuditHandler) CreateComplianceReport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tenant_id is required"})
		return
	}
	actor := c.GetString("user_id")
	report, err := h.svc.CreateComplianceReport(c.Request.Context(), tenantID, actor)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": report})
}

func (h *AuditHandler) ListComplianceReports(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tenant_id is required"})
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	reports, total, err := h.svc.ListComplianceReports(c.Request.Context(), tenantID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": reports, "total": total})
}

func (h *AuditHandler) GetComplianceReport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	report, err := h.svc.GetComplianceReport(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "report not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": report})
}

func (h *AuditHandler) DeleteBatch(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.DeleteBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if len(req.IDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ids array required"})
		return
	}
	if err := h.svc.DeleteBatch(c.Request.Context(), tenantID, req.IDs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *AuditHandler) Export(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	actor := c.GetString("user_id")
	actorName := c.GetString("user_name")
	exportID, err := h.svc.Export(c.Request.Context(), tenantID, actor, actorName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": gin.H{"export_id": exportID}})
}
