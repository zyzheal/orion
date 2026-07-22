package handler

import (
	"net/http"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/cluster/models"
	"orion/platform-svc-go/internal/cluster/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Handler exposes the cluster module's HTTP endpoints.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler bound to the cluster service.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all cluster endpoints under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/clusters")

	// Cluster CRUD
	f.GET("", auth.RequirePermission("cluster", "read"), h.List)
	f.POST("", auth.RequirePermission("cluster", "write"), h.Create)
	f.GET("/:id", auth.RequirePermission("cluster", "read"), h.Get)
	f.DELETE("/:id", auth.RequirePermission("cluster", "delete"), h.Delete)

	// Live K8s cluster info
	f.GET("/:id/info", auth.RequirePermission("cluster", "read"), h.GetInfo)

	// Namespace CRUD within cluster
	f.POST("/:id/namespaces", auth.RequirePermission("cluster", "write"), h.CreateNamespace)
	f.DELETE("/:id/namespaces/:name", auth.RequirePermission("cluster", "delete"), h.DeleteNamespace)
}

// List returns all clusters for the current tenant.
func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	clusters, err := h.svc.ListClusters(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, clusters)
}

// Create creates a new cluster.
func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()

	tenantID := c.GetString("tenant_id")

	var req models.CreateClusterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	cluster, err := h.svc.CreateCluster(ctx, tenantID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, cluster)
}

// Get retrieves cluster metadata by ID.
func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	cluster, err := h.svc.GetCluster(ctx, tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	if cluster == nil {
		errors.WriteError(c, errors.ErrNotFound, "cluster not found", 404)
		return
	}
	errors.WriteSuccess(c, cluster)
}

// Delete deletes a cluster.
func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if err := h.svc.DeleteCluster(ctx, tenantID, id); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	c.AbortWithStatus(http.StatusNoContent)
}

// GetInfo retrieves live K8s cluster information.
func (h *Handler) GetInfo(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetInfo")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	clusterID := c.Param("id")

	info, err := h.svc.GetClusterInfo(ctx, tenantID, clusterID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, info)
}

// CreateNamespace creates a namespace within a cluster via the K8s API.
func (h *Handler) CreateNamespace(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateNamespace")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	clusterID := c.Param("id")

	var req struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	if req.Name == "" {
		errors.WriteError(c, errors.ErrBadRequest, "namespace name is required", 400)
		return
	}

	ns, err := h.svc.CreateNamespace(ctx, tenantID, clusterID, req.Name)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, ns)
}

// DeleteNamespace deletes a namespace within a cluster via the K8s API.
func (h *Handler) DeleteNamespace(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteNamespace")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	clusterID := c.Param("id")
	name := c.Param("name")

	if name == "" {
		errors.WriteError(c, errors.ErrBadRequest, "namespace name is required", 400)
		return
	}

	if err := h.svc.DeleteNamespace(ctx, tenantID, clusterID, name); err != nil {
		// Namespace may have already been deleted; return no-content regardless.
	}
	c.AbortWithStatus(http.StatusNoContent)
}
