package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/tracing/models"
	"orion/platform-svc-go/internal/tracing/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel/trace"
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListTraces")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	serviceName := c.Query("serviceName")
	limit := 50
	if l := c.Query("limit"); l != "" {
		limit, _ = strconv.Atoi(l)
	}
	traces, err := h.svc.GetTraceList(ctx, tenantID, serviceName, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": traces, "total": len(traces)})
}

func (h *Handler) GetTrace(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTrace")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	traceID := c.Param("traceId")
	traces, err := h.svc.GetTrace(ctx, tenantID, traceID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if len(traces) == 0 {
		middleware.RespondNotFound(c, "trace not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"traceId": traceID, "spans": traces})
}

func (h *Handler) GetTraceSpans(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTraceSpans")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	traceID := c.Param("traceId")
	traces, err := h.svc.GetTrace(ctx, tenantID, traceID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": traces, "total": len(traces)})
}

func (h *Handler) SearchTraces(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SearchTraces")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.TraceSearchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	traces, err := h.svc.SearchTraces(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": traces, "total": len(traces)})
}

func (h *Handler) GetSamplingConfigs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSamplingConfigs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	configs, err := h.svc.GetSamplingConfigs(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": configs, "total": len(configs)})
}

func (h *Handler) UpdateSamplingConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateSamplingConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.UpsertSamplingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	config, err := h.svc.UpsertSamplingConfig(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, config)
}

func (h *Handler) GetOtelConfigs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetOtelConfigs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	configType := c.Query("configType")
	configs, err := h.svc.GetOtelConfigs(ctx, tenantID, configType)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": configs, "total": len(configs)})
}

func (h *Handler) CreateOtelConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateOtelConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateOtelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	config, err := h.svc.CreateOtelConfig(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, config)
}

func (h *Handler) UpdateOtelConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateOtelConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateOtelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	config, err := h.svc.UpdateOtelConfig(ctx, tenantID, id, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, config)
}

func (h *Handler) DeleteOtelConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteOtelConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	err := h.svc.DeleteOtelConfig(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "OTel config deleted"})
}
