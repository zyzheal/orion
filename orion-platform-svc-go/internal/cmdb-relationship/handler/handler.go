// Package handler provides HTTP handlers for the CMDB relationship service.
//
// API contract (mounted under /api/v1/cmdb via RegisterRoutes):
//   POST   /api/v1/cmdb/relationship-types          - Create a relationship type
//   GET    /api/v1/cmdb/relationship-types           - List relationship types
//   GET    /api/v1/cmdb/relationship-types/:id       - Get a relationship type
//   PUT    /api/v1/cmdb/relationship-types/:id       - Update a relationship type
//   DELETE /api/v1/cmdb/relationship-types/:id       - Soft-delete a relationship type
//   POST   /api/v1/cmdb/relationships                - Create a concrete relationship
//   GET    /api/v1/cmdb/relationships/:ciId          - Get CI relationships (with ?direction=)
//   DELETE /api/v1/cmdb/relationships/:id            - Delete a relationship
//   GET    /api/v1/cmdb/relationships/:ciId/topology - Build topology graph for a CI
package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/cmdb-relationship/models"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Service defines the methods the handler calls on the service layer.
type Service interface {
	// Relationship type lifecycle
	CreateRelationshipType(ctx context.Context, tenantID string, req *models.CreateRelationshipTypeRequest) (*models.CMDBRelationshipType, error)
	GetRelationshipType(ctx context.Context, tenantID, id string) (*models.CMDBRelationshipType, error)
	ListRelationshipTypes(ctx context.Context, tenantID, status string, enabled *bool) ([]models.CMDBRelationshipType, error)
	UpdateRelationshipType(ctx context.Context, tenantID, id string, req *models.UpdateRelationshipTypeRequest) (*models.CMDBRelationshipType, error)
	DeleteRelationshipType(ctx context.Context, tenantID, id string) error
	CountRelationshipTypes(ctx context.Context, tenantID string) (int, error)

	// Relationship CRUD
	CreateRelationship(ctx context.Context, tenantID, sourceID, targetID, typeID string, attrs map[string]interface{}) (*models.CMDBRelationship, error)
	GetRelationships(ctx context.Context, tenantID, ciID, direction string) ([]models.CMDBRelationship, error)
	DeleteRelationship(ctx context.Context, tenantID, id string) error
	CountRelationships(ctx context.Context, tenantID, ciID string) (int, error)

	// Topology
	BuildTopology(ctx context.Context, tenantID, rootID string, depth int) (map[string][]models.CMDBRelationship, error)
}

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all CMDB relationship endpoints under the given RouterGroup.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// Relationship type endpoints
	rg.POST("/cmdb/relationship-types", auth.RequirePermission("cmdb", "write"), h.CreateRelationshipType)
	rg.GET("/cmdb/relationship-types", auth.RequirePermission("cmdb", "read"), h.ListRelationshipTypes)
	rg.GET("/cmdb/relationship-types/:id", auth.RequirePermission("cmdb", "read"), h.GetRelationshipType)
	rg.PUT("/cmdb/relationship-types/:id", auth.RequirePermission("cmdb", "write"), h.UpdateRelationshipType)
	rg.DELETE("/cmdb/relationship-types/:id", auth.RequirePermission("cmdb", "write"), h.DeleteRelationshipType)

	// Concrete relationship endpoints
	rg.POST("/cmdb/relationships", auth.RequirePermission("cmdb", "write"), h.CreateRelationship)
	rg.GET("/cmdb/relationships/:ciId", auth.RequirePermission("cmdb", "read"), h.GetRelationships)
	rg.DELETE("/cmdb/relationships/:id", auth.RequirePermission("cmdb", "write"), h.DeleteRelationship)
	rg.GET("/cmdb/relationships/:ciId/topology", auth.RequirePermission("cmdb", "read"), h.BuildTopology)
}

// ===========================================================================
// Relationship Type lifecycle
// ===========================================================================

func (h *Handler) CreateRelationshipType(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateRelationshipType")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateRelationshipTypeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	rt, err := h.svc.CreateRelationshipType(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, rt)
}

func (h *Handler) GetRelationshipType(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRelationshipType")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	rt, err := h.svc.GetRelationshipType(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, rt)
}

func (h *Handler) ListRelationshipTypes(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListRelationshipTypes")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	status := c.Query("status")

	enabledStr := c.Query("enabled")
	var enabled *bool
	if enabledStr != "" {
		b := enabledStr == "true"
		enabled = &b
	}

	items, err := h.svc.ListRelationshipTypes(ctx, tenantID, status, enabled)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) UpdateRelationshipType(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateRelationshipType")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateRelationshipTypeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	rt, err := h.svc.UpdateRelationshipType(ctx, tenantID, id, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, rt)
}

func (h *Handler) DeleteRelationshipType(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteRelationshipType")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	err := h.svc.DeleteRelationshipType(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondNoContent(c)
}

// ===========================================================================
// Concrete Relationship CRUD
// ===========================================================================

func (h *Handler) CreateRelationship(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateRelationship")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateRelationshipRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	rel, err := h.svc.CreateRelationship(ctx, tenantID, req.SourceID, req.TargetID, req.TypeID, req.Attributes)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, rel)
}

func (h *Handler) GetRelationships(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRelationships")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ciID := c.Param("ciId")
	direction := c.DefaultQuery("direction", "both")

	items, err := h.svc.GetRelationships(ctx, tenantID, ciID, direction)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"data":      items,
		"ci_id":     ciID,
		"direction": direction,
	})
}

func (h *Handler) DeleteRelationship(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteRelationship")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	err := h.svc.DeleteRelationship(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondNoContent(c)
}

// ===========================================================================
// Topology
// ===========================================================================

func (h *Handler) BuildTopology(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "BuildTopology")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ciID := c.Param("ciId")
	depth, _ := strconv.Atoi(c.DefaultQuery("depth", "2"))
	if depth < 0 {
		depth = 0
	}
	if depth > 10 {
		depth = 10
	}

	graph, err := h.svc.BuildTopology(ctx, tenantID, ciID, depth)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"root_id": ciID,
		"depth":   depth,
		"graph":   graph,
	})
}
