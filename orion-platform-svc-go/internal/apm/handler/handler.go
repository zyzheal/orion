package handler

import (
	"fmt"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/apm/models"
	"orion/platform-svc-go/internal/apm/service"

	"github.com/gin-gonic/gin"
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
	tenantID := h.getTenantID(c)
	entities, err := h.svc.List(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, models.PaginatedResponse{Data: entities, Total: len(entities), Page: 1, PageSize: len(entities)})
}

func (h *Handler) Create(c *gin.Context) {
	var req models.CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	entity, err := h.svc.Create(c.Request.Context(), &req, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, entity)
}

func (h *Handler) Get(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	entity, err := h.svc.Get(c.Request.Context(), id, tenantID)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, entity)
}

func (h *Handler) Update(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	entity, err := h.svc.Update(c.Request.Context(), id, tenantID, &req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, entity)
}

func (h *Handler) Delete(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.Delete(c.Request.Context(), id, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if !deleted {
		respondNotFound(c, "not found")
		return
	}
	respondSuccess(c, gin.H{"deleted": true})
}

func (h *Handler) GetSlowTraces(c *gin.Context) {
	q := models.SlowTracesQuery{}
	q.TraceDurationMs = c.Query("durationMs")
	q.Service = c.Query("service")
	q.Start = c.Query("start")
	q.End = c.Query("end")
	tenantID := h.getTenantID(c)
	result, err := h.svc.GetSlowTraces(c.Request.Context(), tenantID, &q)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) GetServiceTopology(c *gin.Context) {
	q := models.TopologyQuery{}
	if v := c.Query("includeDependencies"); v != "" {
		q.IncludeDependencies = v == "true"
	}
	q.Service = c.Query("service")
	tenantID := h.getTenantID(c)
	result, err := h.svc.GetServiceTopology(c.Request.Context(), tenantID, &q)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) GetSlowQueries(c *gin.Context) {
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
	result, err := h.svc.GetSlowQueries(c.Request.Context(), tenantID, &q)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}
