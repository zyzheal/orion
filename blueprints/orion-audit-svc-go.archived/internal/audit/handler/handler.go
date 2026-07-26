package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/orion/audit-svc/internal/audit/service"
)

type AuditHandler struct {
	Service service.AuditService
}

func NewAuditHandler(svc service.AuditService) *AuditHandler {
	return &AuditHandler{Service: svc}
}

func (h *AuditHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/logs", h.ListLogs)
	rg.POST("/logs", h.CreateLog)
	rg.GET("/logs/:id", h.GetLog)
	rg.GET("/logs/search", h.SearchLogs)
	rg.GET("/compliance/checks", h.ListComplianceChecks)
	rg.POST("/compliance/checks", h.RunComplianceCheck)
}

func (h *AuditHandler) ListLogs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	logs, total, err := h.Service.ListLogs(c.Request.Context(), page, size)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": logs, "total": total})
}

func (h *AuditHandler) CreateLog(c *gin.Context) {
	var req struct {
		Action   string `json:"action"`
		Resource string `json:"resource"`
		Detail   string `json:"detail"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request"})
		return
	}
	if err := h.Service.CreateLog(c.Request.Context(), req.Action, req.Resource, req.Detail); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "message": "success"})
}

func (h *AuditHandler) GetLog(c *gin.Context) {
	id := c.Param("id")
	logEntry, err := h.Service.GetLog(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": logEntry})
}

func (h *AuditHandler) SearchLogs(c *gin.Context) {
	query := c.Query("q")
	results, err := h.Service.SearchLogs(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": results})
}

func (h *AuditHandler) ListComplianceChecks(c *gin.Context) {
	checks, err := h.Service.ListComplianceChecks(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": checks})
}

func (h *AuditHandler) RunComplianceCheck(c *gin.Context) {
	var req struct {
		CheckType string `json:"check_type"`
		Target    string `json:"target"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request"})
		return
	}
	result, err := h.Service.RunComplianceCheck(c.Request.Context(), req.CheckType, req.Target)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": result})
}
