package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/tracing/models"
	"orion/platform-svc-go/internal/tracing/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/tracing")

	f.GET("/traces", auth.RequirePermission("tracing", "read"), h.ListTraces)
	f.GET("/traces/:traceId", auth.RequirePermission("tracing", "read"), h.GetTrace)
	f.GET("/traces/:traceId/spans", auth.RequirePermission("tracing", "read"), h.GetTraceSpans)
	f.POST("/traces/search", auth.RequirePermission("tracing", "read"), h.SearchTraces)
	f.GET("/config", auth.RequirePermission("tracing", "read"), h.GetSamplingConfigs)
	f.PUT("/config", auth.RequirePermission("tracing", "update"), h.UpdateSamplingConfig)
	f.GET("/otel/configs", auth.RequirePermission("tracing", "read"), h.GetOtelConfigs)
	f.POST("/otel/configs", auth.RequirePermission("tracing", "update"), h.CreateOtelConfig)
	f.PUT("/otel/configs/:id", auth.RequirePermission("tracing", "update"), h.UpdateOtelConfig)
	f.DELETE("/otel/configs/:id", auth.RequirePermission("tracing", "update"), h.DeleteOtelConfig)
}

func (h *Handler) ListTraces(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	serviceName := c.Query("serviceName")
	limit := 50
	if l := c.Query("limit"); l != "" {
		limit, _ = strconv.Atoi(l)
	}
	traces, err := h.svc.GetTraceList(c.Request.Context(), tenantID, serviceName, limit)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": traces, "total": len(traces)})
}

func (h *Handler) GetTrace(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	traceID := c.Param("traceId")
	traces, err := h.svc.GetTrace(c.Request.Context(), tenantID, traceID)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	if len(traces) == 0 {
		c.JSON(404, gin.H{"error": "trace not found"})
		return
	}
	c.JSON(200, gin.H{"data": gin.H{"traceId": traceID, "spans": traces}})
}

func (h *Handler) GetTraceSpans(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	traceID := c.Param("traceId")
	traces, err := h.svc.GetTrace(c.Request.Context(), tenantID, traceID)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": traces, "total": len(traces)})
}

func (h *Handler) SearchTraces(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.TraceSearchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	traces, err := h.svc.SearchTraces(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": traces, "total": len(traces)})
}

func (h *Handler) GetSamplingConfigs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	configs, err := h.svc.GetSamplingConfigs(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": configs, "total": len(configs)})
}

func (h *Handler) UpdateSamplingConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpsertSamplingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	config, err := h.svc.UpsertSamplingConfig(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": config})
}

func (h *Handler) GetOtelConfigs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	configType := c.Query("configType")
	configs, err := h.svc.GetOtelConfigs(c.Request.Context(), tenantID, configType)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": configs, "total": len(configs)})
}

func (h *Handler) CreateOtelConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateOtelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	config, err := h.svc.CreateOtelConfig(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(201, gin.H{"data": config})
}

func (h *Handler) UpdateOtelConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateOtelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	config, err := h.svc.UpdateOtelConfig(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": config})
}

func (h *Handler) DeleteOtelConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	err := h.svc.DeleteOtelConfig(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"message": "OTel config deleted"})
}
