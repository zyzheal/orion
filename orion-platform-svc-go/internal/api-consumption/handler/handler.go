package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/api-consumption/models"
	"orion/platform-svc-go/internal/api-consumption/service"

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

// RegisterRoutes registers all api-consumption endpoints under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/api-consumption")

	// === Consumption ===
	f.GET("/records", auth.RequirePermission("api-consumption", "read"), h.ListConsumptions)
	f.POST("/records", auth.RequirePermission("api-consumption", "write"), h.CreateConsumption)

	// === Limits ===
	f.GET("/limits", auth.RequirePermission("api-consumption", "read"), h.ListLimits)
	f.POST("/limits", auth.RequirePermission("api-consumption", "write"), h.CreateLimit)
	f.GET("/limits/:id", auth.RequirePermission("api-consumption", "read"), h.GetLimit)
	f.PUT("/limits/:id", auth.RequirePermission("api-consumption", "write"), h.UpdateLimit)
	f.DELETE("/limits/:id", auth.RequirePermission("api-consumption", "delete"), h.DeleteLimit)

	// === Stats ===
	f.GET("/stats", auth.RequirePermission("api-consumption", "read"), h.GetStats)
}

// ==================== Consumption ====================

func (h *Handler) ListConsumptions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListConsumptions")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	filter := &models.ConsumptionFilter{Limit: 20}
	if l := c.Query("limit"); l != "" {
		filter.Limit, _ = strconv.Atoi(l)
	}
	if o := c.Query("offset"); o != "" {
		_ = o
	}
	if k := c.Query("apiKeyId"); k != "" {
		filter.APIKeyID = &k
	}
	if p := c.Query("endpointPath"); p != "" {
		filter.EndpointPath = &p
	}
	if m := c.Query("method"); m != "" {
		filter.Method = &m
	}
	if ds := c.Query("dateFrom"); ds != "" {
		filter.DateFrom = &ds
	}
	if de := c.Query("dateTo"); de != "" {
		filter.DateTo = &de
	}
	result, err := h.svc.ListConsumptions(ctx, tenantID, filter)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) CreateConsumption(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateConsumption")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateConsumptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.CreateConsumption(ctx, tenantID, &req)
	if err != nil {
		if service.IsBadRequest(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

// ==================== Limits ====================

func (h *Handler) ListLimits(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListLimits")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.ListLimits(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) CreateLimit(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateLimit")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateLimitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.CreateLimit(ctx, tenantID, &req)
	if err != nil {
		if service.IsBadRequest(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

func (h *Handler) GetLimit(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetLimit")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.GetLimit(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "limit not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) UpdateLimit(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateLimit")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateLimitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.UpdateLimit(ctx, tenantID, id, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "limit not found")
			return
		}
		if service.IsBadRequest(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) DeleteLimit(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteLimit")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	err := h.svc.DeleteLimit(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "limit not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "limit deleted"})
}

// ==================== Stats ====================

func (h *Handler) GetStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.GetStats(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}
