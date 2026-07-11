package handler

import (
	"net/http"
	"strconv"
	"orion/inspection-svc-go/internal/models"
	"orion/inspection-svc-go/internal/service"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

type Handler struct { svc *service.Service }
func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/inspections")
	r.POST("/rules", auth.RequirePermission("inspection", "write"), h.CreateRule)
	r.GET("/rules", h.ListRules)
	r.GET("/rules/:id", h.GetRule)
	r.PUT("/rules/:id", auth.RequirePermission("inspection", "write"), h.UpdateRule)
	r.DELETE("/rules/:id", auth.RequirePermission("inspection", "delete"), h.DeleteRule)
	r.GET("/results", h.ListResults)
	r.GET("/rules/:id/results", h.ListResultsByRule)
	r.DELETE("/:id", auth.RequirePermission("inspection", "delete"), h.Delete)
	r.GET("/count", h.Count)
	// Tasks
	r.POST("/tasks", auth.RequirePermission("inspection", "write"), h.CreateTask)
	r.GET("/tasks", h.ListTasks)
	r.GET("/tasks/:id", h.GetTask)
	// Reports
	r.POST("/reports", auth.RequirePermission("inspection", "write"), h.CreateReport)
	r.GET("/reports", h.ListReports)
	r.GET("/reports/:id", h.GetReport)
	// Health Score
	r.GET("/health-score", h.HealthScore)
}

func (h *Handler) CreateRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }
	rule, err := h.svc.CreateRule(c.Request.Context(), tenantID, &req)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusCreated, rule)
}

func (h *Handler) ListRules(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1")); ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.ListRules(c.Request.Context(), tenantID, (page-1)*ps, ps)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) GetRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	item, err := h.svc.GetRule(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil { c.JSON(http.StatusNotFound, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, item)
}

func (h *Handler) UpdateRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }
	item, err := h.svc.UpdateRule(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil { c.JSON(http.StatusNotFound, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, item)
}

func (h *Handler) DeleteRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteRule(c.Request.Context(), tenantID, c.Param("id")); err != nil { c.JSON(http.StatusNotFound, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusNoContent, nil)
}

func (h *Handler) ListResults(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1")); ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.ListResults(c.Request.Context(), tenantID, (page-1)*ps, ps)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) ListResultsByRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1")); ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.ListResultsByRule(c.Request.Context(), tenantID, c.Param("id"), (page-1)*ps, ps)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) Count(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteRule(c.Request.Context(), tenantID, c.Param("id")); err != nil { c.JSON(http.StatusNotFound, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// --- Task handlers ---

func (h *Handler) CreateTask(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }
	task, err := h.svc.CreateTask(c.Request.Context(), tenantID, req.RuleId)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusCreated, gin.H{"data": task})
}

func (h *Handler) ListTasks(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ruleID := c.Query("rule_id")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1")); ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.ListTasks(c.Request.Context(), tenantID, ruleID, status, (page-1)*ps, ps)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) GetTask(c *gin.Context) {
	item, err := h.svc.GetTask(c.Request.Context(), c.Param("id"))
	if err != nil { c.JSON(http.StatusNotFound, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, gin.H{"data": item})
}

// --- Report handlers ---

func (h *Handler) CreateReport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateReportRequest
	if err := c.ShouldBindJSON(&req); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }
	if req.Title == "" {
		req.Title = "自动巡检报告"
	}
	report, err := h.svc.GenerateReport(c.Request.Context(), tenantID, &req)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusCreated, gin.H{"data": report})
}

func (h *Handler) ListReports(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1")); ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.ListReports(c.Request.Context(), tenantID, (page-1)*ps, ps)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) GetReport(c *gin.Context) {
	item, err := h.svc.GetReport(c.Request.Context(), c.Param("id"))
	if err != nil { c.JSON(http.StatusNotFound, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, gin.H{"data": item})
}

// --- Health Score ---

func (h *Handler) HealthScore(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	score, err := h.svc.GetHealthScore(c.Request.Context(), tenantID)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, gin.H{"data": score})
}

