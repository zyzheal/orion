package handler

import (
	"orion/go-common/pkg/auth"
	goerr "orion/go-common/pkg/errors"

	"orion/platform-svc-go/internal/service-topology/models"
	"orion/platform-svc-go/internal/service-topology/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/sentinel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/service-topology")
	r.GET("", auth.RequirePermission("service_topology", "read"), h.List)
	r.GET("/:id", auth.RequirePermission("service_topology", "read"), h.Get)
	r.GET("/by-name/:name", auth.RequirePermission("service_topology", "read"), h.GetByServiceName)
	r.POST("", auth.RequirePermission("service_topology", "write"), h.Create)
	r.PUT("/:id", auth.RequirePermission("service_topology", "write"), h.Update)
	r.DELETE("/:id", auth.RequirePermission("service_topology", "delete"), h.Delete)

	// Dependency graph endpoints
	r.POST("/by-name/:name/dependencies", auth.RequirePermission("service_topology", "write"), h.AddDependency)
	r.DELETE("/by-name/:name/dependencies/:target", auth.RequirePermission("service_topology", "delete"), h.RemoveDependency)
	r.GET("/by-name/:name/dependencies", auth.RequirePermission("service_topology", "read"), h.GetDependencies)
	r.GET("/by-name/:name/upstream", auth.RequirePermission("service_topology", "read"), h.GetUpstreamDependencies)
	r.GET("/by-name/:name/downstream", auth.RequirePermission("service_topology", "read"), h.GetDownstreamDependents)
	r.GET("/by-name/:name/impact", auth.RequirePermission("service_topology", "read"), h.FindImpactScope)
	r.GET("/cycles", auth.RequirePermission("service_topology", "read"), h.DetectCycles)
	r.GET("/stats", auth.RequirePermission("service_topology", "read"), h.GetTopologyStats)
}

// CRUD handlers

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.List(ctx, tenantID)
	if err != nil {
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteSuccess(c, gin.H{"data": items, "total": len(items)})
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	item, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		goerr.WriteError(c, goerr.ErrNotFound, "not found", 404)
		return
	}
	goerr.WriteSuccess(c, item)
}

func (h *Handler) GetByServiceName(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetByServiceName")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	name := c.Param("name")
	item, err := h.svc.GetByServiceName(ctx, tenantID, name)
	if err != nil {
		goerr.WriteError(c, goerr.ErrNotFound, "not found", 404)
		return
	}
	goerr.WriteSuccess(c, item)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateServiceTopologyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		goerr.WriteError(c, goerr.ErrBadRequest, err.Error(), 400)
		return
	}
	item, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteCreated(c, item)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateServiceTopologyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		goerr.WriteError(c, goerr.ErrBadRequest, err.Error(), 400)
		return
	}
	item, err := h.svc.Update(ctx, tenantID, id, req)
	if err != nil {
		goerr.WriteError(c, goerr.ErrNotFound, "not found", 404)
		return
	}
	goerr.WriteSuccess(c, item)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Delete(ctx, tenantID, id); err != nil {
		goerr.WriteError(c, goerr.ErrNotFound, "not found", 404)
		return
	}
	goerr.WriteSuccess(c, gin.H{"message": "deleted"})
}

// Dependency graph handlers

func (h *Handler) AddDependency(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AddDependency")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	source := c.Param("name")
	var req models.AddDependencyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		goerr.WriteError(c, goerr.ErrBadRequest, err.Error(), 400)
		return
	}
	relType := models.RelationType(req.RelationType)
	if !isValidRelationType(relType) {
		goerr.WriteError(c, goerr.ErrBadRequest, "invalid relation_type", 400)
		return
	}
	err := h.svc.AddDependency(ctx, tenantID, source, req.TargetService, relType)
	if err != nil {
		goerr.WriteError(c, goerr.ErrBadRequest, err.Error(), 409)
		return
	}
	goerr.WriteSuccess(c, gin.H{"message": "dependency added"})
}

func (h *Handler) RemoveDependency(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RemoveDependency")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	source := c.Param("name")
	target := c.Param("target")
	if err := h.svc.RemoveDependency(ctx, tenantID, source, target); err != nil {
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteSuccess(c, gin.H{"message": "dependency removed"})
}

func (h *Handler) GetDependencies(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDependencies")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	name := c.Param("name")
	edges, err := h.svc.GetDependencies(ctx, tenantID, name)
	if err != nil {
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteSuccess(c, edges)
}

func (h *Handler) GetUpstreamDependencies(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetUpstreamDependencies")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	name := c.Param("name")
	deps, err := h.svc.GetUpstreamDependencies(ctx, tenantID, name)
	if err != nil {
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteSuccess(c, gin.H{"upstream_dependencies": deps, "count": len(deps)})
}

func (h *Handler) GetDownstreamDependents(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDownstreamDependents")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	name := c.Param("name")
	deps, err := h.svc.GetDownstreamDependents(ctx, tenantID, name)
	if err != nil {
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteSuccess(c, gin.H{"downstream_dependents": deps, "count": len(deps)})
}

func (h *Handler) FindImpactScope(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "FindImpactScope")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	name := c.Param("name")
	scope, err := h.svc.FindImpactScope(ctx, tenantID, name)
	if err != nil {
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteSuccess(c, scope)
}

func (h *Handler) DetectCycles(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DetectCycles")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	cycles, err := h.svc.DetectCycles(ctx, tenantID)
	if err != nil {
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	var cyclePaths []models.CyclePath
	for _, c := range cycles {
		cyclePaths = append(cyclePaths, models.CyclePath{Path: c})
	}
	goerr.WriteSuccess(c, gin.H{"has_cycle": len(cycles) > 0, "cycles": cyclePaths, "count": len(cycles)})
}

func (h *Handler) GetTopologyStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTopologyStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetTopologyStats(ctx, tenantID)
	if err != nil {
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteSuccess(c, stats)
}

func isValidRelationType(rt models.RelationType) bool {
	switch rt {
	case models.RelDependsOn, models.RelCommunicatesWith, models.RelHealthChecks:
		return true
	}
	return false
}
