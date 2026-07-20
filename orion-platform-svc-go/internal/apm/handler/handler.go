package handler

import (
	"fmt"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/apm/models"
	"orion/platform-svc-go/internal/apm/service"

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
	f := rg.Group("/apm")
	f.GET("", auth.RequirePermission("apm", "read"), h.List)
	f.POST("", auth.RequirePermission("apm", "write"), h.Create)
	f.GET("/:id", auth.RequirePermission("apm", "read"), h.Get)
	f.PUT("/:id", auth.RequirePermission("apm", "write"), h.Update)
	f.DELETE("/:id", auth.RequirePermission("apm", "delete"), h.Delete)

	// Business endpoints
	f.GET("/traces/slow", auth.RequirePermission("apm", "read"), h.GetSlowTraces)
	f.GET("/services/topology", auth.RequirePermission("apm", "read"), h.GetServiceTopology)
	f.GET("/slow-queries", auth.RequirePermission("apm", "read"), h.GetSlowQueries)
}

func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := h.getTenantID(c)
	entities, err := h.svc.List(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{Data: entities, Total: len(entities), Page: 1, PageSize: len(entities)})
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	var req models.CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	entity, err := h.svc.Create(ctx, &req, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, entity)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	entity, err := h.svc.Get(ctx, id, tenantID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, entity)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	id := c.Param("id")
	var req models.UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	entity, err := h.svc.Update(ctx, id, tenantID, &req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, entity)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.Delete(ctx, id, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"deleted": true})
}

func (h *Handler) GetSlowTraces(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSlowTraces")
	defer span.End()
	q := models.SlowTracesQuery{}
	q.TraceDurationMs = c.Query("durationMs")
	q.Service = c.Query("service")
	q.Start = c.Query("start")
	q.End = c.Query("end")
	tenantID := h.getTenantID(c)
	result, err := h.svc.GetSlowTraces(ctx, tenantID, &q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) GetServiceTopology(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetServiceTopology")
	defer span.End()
	q := models.TopologyQuery{}
	if v := c.Query("includeDependencies"); v != "" {
		q.IncludeDependencies = v == "true"
	}
	q.Service = c.Query("service")
	tenantID := h.getTenantID(c)
	result, err := h.svc.GetServiceTopology(ctx, tenantID, &q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) GetSlowQueries(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSlowQueries")
	defer span.End()
	var q models.SlowQueriesQuery
	if v := c.DefaultQuery("minDurationMs", "0"); v != "0" {
		var n int
		_, _ = fmt.Sscanf(v, "%d", &n)
		q.MinDurationMs = n
	}
	q.Database = c.Query("database")
	if l := c.DefaultQuery("limit", "50"); l != "" {
		var n int
		_, _ = fmt.Sscanf(l, "%d", &n)
		if n > 0 {
			q.Limit = n
		}
	}
	tenantID := h.getTenantID(c)
	result, err := h.svc.GetSlowQueries(ctx, tenantID, &q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}
