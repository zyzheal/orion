package handler

import (
	"errors"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/graph/models"
	"orion/platform-svc-go/internal/graph/service"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Handler handles HTTP requests for the graph module.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new graph handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all graph endpoints under the /graph group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/graph")

	// === Health ===
	f.GET("/health", h.Health)

	// === Node CRUD ===
	f.POST("/nodes", auth.RequirePermission("graph", "write"), h.CreateNode)
	f.GET("/nodes", auth.RequirePermission("graph", "read"), h.ListNodes)
	f.GET("/nodes/:id", auth.RequirePermission("graph", "read"), h.GetNode)
	f.PUT("/nodes/:id", auth.RequirePermission("graph", "write"), h.UpdateNode)
	f.DELETE("/nodes/:id", auth.RequirePermission("graph", "delete"), h.DeleteNode)

	// === Relationship CRUD ===
	f.POST("/relationships", auth.RequirePermission("graph", "write"), h.CreateRelationship)
	f.GET("/relationships", auth.RequirePermission("graph", "read"), h.ListRelationships)
	f.GET("/relationships/:id", auth.RequirePermission("graph", "read"), h.GetRelationship)
	f.PUT("/relationships/:id", auth.RequirePermission("graph", "write"), h.UpdateRelationship)
	f.DELETE("/relationships/:id", auth.RequirePermission("graph", "delete"), h.DeleteRelationship)

	// === Traversal / Path ===
	f.GET("/path", auth.RequirePermission("graph", "read"), h.FindShortestPath)
	f.GET("/neighbors/:nodeId", auth.RequirePermission("graph", "read"), h.GetNeighbors)

	// === Graph Query ===
	f.POST("/query", auth.RequirePermission("graph", "write"), h.ExecuteQuery)

	// === Topology ===
	f.GET("/topology", auth.RequirePermission("graph", "read"), h.GetServiceTopology)

	// === Stats ===
	f.GET("/stats", auth.RequirePermission("graph", "read"), h.GetStats)
}

// ==================== Health ====================

func (h *Handler) Health(c *gin.Context) {
	middleware.RespondSuccess(c, gin.H{
		"status":  "ok",
		"service": "orion-graph-svc",
	})
}

// ==================== Node CRUD ====================

func (h *Handler) CreateNode(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateNode")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req models.CreateNodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	node, err := h.svc.CreateNode(ctx, tenantID, req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidLabel) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, node)
}

func (h *Handler) GetNode(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetNode")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	node, err := h.svc.GetNode(ctx, tenantID, id)
	if err != nil {
		if err == service.ErrNodeNotFound {
			middleware.RespondNotFound(c, "node not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, node)
}

func (h *Handler) ListNodes(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListNodes")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	label := c.Query("label")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))

	nodes, err := h.svc.ListNodes(ctx, tenantID, label, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"nodes": nodes, "total": len(nodes)})
}

func (h *Handler) UpdateNode(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateNode")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req models.UpdateNodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	node, err := h.svc.UpdateNode(ctx, tenantID, id, req)
	if err != nil {
		if err == service.ErrNodeNotFound {
			middleware.RespondNotFound(c, "node not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, node)
}

func (h *Handler) DeleteNode(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteNode")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if err := h.svc.DeleteNode(ctx, tenantID, id); err != nil {
		if err == service.ErrNodeNotFound {
			middleware.RespondNotFound(c, "node not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "node deleted"})
}

// ==================== Relationship CRUD ====================

func (h *Handler) CreateRelationship(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateRelationship")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req models.CreateRelationshipRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	rel, err := h.svc.CreateRelationship(ctx, tenantID, req)
	if err != nil {
		if err == service.ErrStartNodeNotFound {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		if err == service.ErrEndNodeNotFound {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		if err == service.ErrInvalidRelType {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, rel)
}

func (h *Handler) GetRelationship(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRelationship")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	rel, err := h.svc.GetRelationship(ctx, tenantID, id)
	if err != nil {
		if err == service.ErrRelNotFound {
			middleware.RespondNotFound(c, "relationship not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, rel)
}

func (h *Handler) ListRelationships(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListRelationships")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	relType := c.Query("type")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))

	rels, err := h.svc.ListRelationships(ctx, tenantID, relType, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"relationships": rels, "total": len(rels)})
}

func (h *Handler) UpdateRelationship(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateRelationship")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req models.UpdateRelationshipRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	rel, err := h.svc.UpdateRelationship(ctx, tenantID, id, req)
	if err != nil {
		if err == service.ErrRelNotFound {
			middleware.RespondNotFound(c, "relationship not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, rel)
}

func (h *Handler) DeleteRelationship(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteRelationship")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if err := h.svc.DeleteRelationship(ctx, tenantID, id); err != nil {
		if err == service.ErrRelNotFound {
			middleware.RespondNotFound(c, "relationship not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "relationship deleted"})
}

// ==================== Traversal / Path ====================

func (h *Handler) FindShortestPath(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "FindShortestPath")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req models.FindPathRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	// Also support query params for GET
	req.StartID = c.Query("startId")
	req.EndID = c.Query("endId")
	if req.StartID == "" || req.EndID == "" {
		middleware.RespondBadRequest(c, "startId and endId are required")
		return
	}

	paths, err := h.svc.FindShortestPath(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, paths)
}

func (h *Handler) GetNeighbors(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetNeighbors")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	nodeID := c.Param("nodeId")
	depth, _ := strconv.Atoi(c.DefaultQuery("depth", "1"))

	paths, err := h.svc.Neighbors(ctx, tenantID, nodeID, depth)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, paths)
}

// ==================== Graph Query ====================

func (h *Handler) ExecuteQuery(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExecuteQuery")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req models.GraphQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	result, err := h.svc.ExecuteQuery(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// ==================== Topology ====================

func (h *Handler) GetServiceTopology(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetServiceTopology")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	topology, err := h.svc.GetServiceTopology(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, topology)
}

// ==================== Stats ====================

func (h *Handler) GetStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	stats, err := h.svc.GetStats(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}
