package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"orion/ai-svc-go/internal/llm-trace/models"
	"orion/ai-svc-go/internal/llm-trace/service"
	"orion/go-common/pkg/auth"
)

type LLMTraceHandler struct {
	svc *service.LLMTraceService
}

func NewLLMTraceHandler(svc *service.LLMTraceService) *LLMTraceHandler {
	return &LLMTraceHandler{svc: svc}
}

func (h *LLMTraceHandler) GetTenantID(c *gin.Context) string {
	return c.GetString("tenantId")
}

// RegisterRoutes registers llm-trace routes.
func (h *LLMTraceHandler) RegisterRoutes(rg *gin.RouterGroup) {
	traces := rg.Group("/llm-trace")

	traces.GET("", auth.RequirePermission("ai", "read"), h.List)
	traces.POST("", auth.RequirePermission("ai", "write"), h.Create)
	traces.GET("/summary", auth.RequirePermission("ai", "read"), h.CostSummary)
	traces.GET("/by-trace/:trace_id", auth.RequirePermission("ai", "read"), h.GetByTraceID)

	rg.DELETE("/llm-trace/old", auth.RequirePermission("ai", "admin"), h.DeleteOld)
}

// List returns paginated traces.
func (h *LLMTraceHandler) List(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	model := c.Query("model")
	provider := c.Query("provider")
	status := c.Query("status")
	startTime := c.Query("start_time")
	endTime := c.Query("end_time")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	resp, err := h.svc.Query(c.Request.Context(), tenantID, model, provider, status, startTime, endTime, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "total": resp.Total, "data": resp.Data})
}

// Create creates a new trace.
func (h *LLMTraceHandler) Create(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	var req models.CreateTraceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}

	trace, err := h.svc.Create(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "message": "created", "data": trace})
}

// CostSummary returns aggregated cost data.
func (h *LLMTraceHandler) CostSummary(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	period := c.DefaultQuery("period", "month")

	summary, err := h.svc.GetCostSummary(c.Request.Context(), tenantID, period)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": summary})
}

// GetByTraceID returns traces for a trace ID.
func (h *LLMTraceHandler) GetByTraceID(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	traceID := c.Param("trace_id")

	traces, err := h.svc.GetByTraceID(c.Request.Context(), tenantID, traceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": traces})
}

// DeleteOld removes old traces.
func (h *LLMTraceHandler) DeleteOld(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	days, _ := strconv.Atoi(c.DefaultQuery("days", "30"))

	if days < 1 {
		days = 30
	}

	count, err := h.svc.DeleteOldTraces(c.Request.Context(), tenantID, days)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": fmt.Sprintf("deleted %d old traces", count)})
}
