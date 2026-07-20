package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/cmdb/models"
	"orion/platform-svc-go/internal/cmdb/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all cmdb endpoints under the given group.
// Mirrors /api/v1/cmdb routes from the TS source (30 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/cmdb")

	// --- CI CRUD ---
	// POST /cmdb/cis - Create CI
	f.POST("/cis", auth.RequirePermission("cmdb", "write"), h.CreateCI)
	// GET /cmdb/cis/:id - Get CI by ID
	f.GET("/cis/:id", auth.RequirePermission("cmdb", "read"), h.GetCI)
	// GET /cmdb/cis/by-id/:ciId - Get CI by CI ID
	f.GET("/cis/by-id/:ciId", auth.RequirePermission("cmdb", "read"), h.GetCIByID)
	// PUT /cmdb/cis/:id - Update CI
	f.PUT("/cis/:id", auth.RequirePermission("cmdb", "write"), h.UpdateCI)
	// DELETE /cmdb/cis/:id - Delete CI
	f.DELETE("/cis/:id", auth.RequirePermission("cmdb", "delete"), h.DeleteCI)
	// GET /cmdb/cis - List CIs
	f.GET("/cis", auth.RequirePermission("cmdb", "read"), h.ListCIs)

	// --- Batch Operations ---
	// POST /cmdb/batch-create - Batch create CIs
	f.POST("/batch-create", auth.RequirePermission("cmdb", "write"), h.BatchCreate)
	// PUT /cmdb/batch-update - Batch update CIs
	f.PUT("/batch-update", auth.RequirePermission("cmdb", "write"), h.BatchUpdate)
	// DELETE /cmdb/batch-delete - Batch delete CIs
	f.DELETE("/batch-delete", auth.RequirePermission("cmdb", "delete"), h.BatchDelete)
	// POST /cmdb/ci/query - Batch query CIs
	f.POST("/ci/query", auth.RequirePermission("cmdb", "read"), h.BatchQuery)

	// --- Export ---
	// GET /cmdb/ci/export/:id - Export single CI
	f.GET("/ci/export/:id", auth.RequirePermission("cmdb", "read"), h.ExportCI)
	// GET /cmdb/export - Export all CIs
	f.GET("/export", auth.RequirePermission("cmdb", "read"), h.ExportAllCIs)
	// POST /cmdb/import - Import CIs
	f.POST("/import", auth.RequirePermission("cmdb", "write"), h.ImportCIs)

	// --- Relations ---
	// GET /cmdb/cis/:ciId/relations - Get CI relations
	f.GET("/cis/:ciId/relations", auth.RequirePermission("cmdb", "read"), h.GetRelations)
	// POST /cmdb/relations - Create relation
	f.POST("/relations", auth.RequirePermission("cmdb", "write"), h.CreateRelation)
	// DELETE /cmdb/relations/:relationId - Delete relation
	f.DELETE("/relations/:relationId", auth.RequirePermission("cmdb", "delete"), h.DeleteRelation)

	// --- Versions ---
	// GET /cmdb/cis/:ciId/versions - Get CI versions
	f.GET("/cis/:ciId/versions", auth.RequirePermission("cmdb", "read"), h.GetVersions)
	// GET /cmdb/cis/:ciId/versions/current - Get current version
	f.GET("/cis/:ciId/versions/current", auth.RequirePermission("cmdb", "read"), h.GetCurrentVersion)
	// POST /cmdb/cis/:ciId/versions/restore - Restore to version
	f.POST("/cis/:ciId/versions/restore", auth.RequirePermission("cmdb", "write"), h.RestoreVersion)

	// --- Topology ---
	// GET /cmdb/topology - Get topology
	f.GET("/topology", auth.RequirePermission("cmdb", "read"), h.GetTopology)
	// GET /cmdb/topology/:ciId/dependencies - Service dependencies
	f.GET("/topology/:ciId/dependencies", auth.RequirePermission("cmdb", "read"), h.GetServiceDependencies)
	// GET /cmdb/topology/:ciId/impact - Impact analysis
	f.GET("/topology/:ciId/impact", auth.RequirePermission("cmdb", "read"), h.GetImpactAnalysis)

	// --- Health ---
	// GET /cmdb/health - Health check
	f.GET("/health", h.Health)

	// --- Integration (Hosts, K8s, CICD, Execute) ---

	// GET /cmdb/hosts - List hosts
	f.GET("/hosts", auth.RequirePermission("cmdb", "read"), h.ListHosts)
	// GET /cmdb/hosts/:ciId - Get host by CI ID
	f.GET("/hosts/:ciId", auth.RequirePermission("cmdb", "read"), h.GetHost)
	// GET /cmdb/k8s - List K8s resources
	f.GET("/k8s", auth.RequirePermission("cmdb", "read"), h.ListK8sResources)
	// POST /cmdb/k8s/sync/start - Start K8s sync
	f.POST("/k8s/sync/start", auth.RequirePermission("cmdb", "write"), h.StartK8sSync)
	// POST /cmdb/k8s/sync/stop - Stop K8s sync
	f.POST("/k8s/sync/stop", auth.RequirePermission("cmdb", "write"), h.StopK8sSync)
	// GET /cmdb/cicd - List CI/CD resources
	f.GET("/cicd", auth.RequirePermission("cmdb", "read"), h.ListCICDResources)
	// POST /cmdb/execute - Execute script
	f.POST("/execute", auth.RequirePermission("cmdb", "write"), h.ExecuteScript)
}

// --- CI CRUD handlers ---

func (h *Handler) CreateCI(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateCI")
	defer span.End()
	var req models.CreateCIRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	ci, err := h.svc.Create(ctx, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, ci)
}

func (h *Handler) GetCI(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCI")
	defer span.End()
	id := c.Param("id")
	ci, err := h.svc.Get(ctx, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "CI not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, ci)
}

func (h *Handler) GetCIByID(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCIByID")
	defer span.End()
	ciID := c.Param("ciId")
	tenantIDStr := c.Query("tenantId")
	var tenantID *string
	if tenantIDStr != "" {
		tenantID = &tenantIDStr
	}
	ci, err := h.svc.GetByCiId(ctx, ciID, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "CI not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, ci)
}

func (h *Handler) UpdateCI(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateCI")
	defer span.End()
	id := c.Param("id")
	var req models.UpdateCIRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	ci, err := h.svc.Update(ctx, id, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, ci)
}

func (h *Handler) DeleteCI(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteCI")
	defer span.End()
	id := c.Param("id")
	deleted, err := h.svc.Delete(ctx, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "CI not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "CI deleted"})
}

func (h *Handler) ListCIs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListCIs")
	defer span.End()
	tenantID := h.getDefaultTenantID(c.Query("tenantId"))
	ciType := ptrIf(c.Query("ciType"))
	status := ptrIf(c.Query("status"))
	page := h.getQueryInt(c.Query("page"), 1)
	limit := h.getQueryInt(c.Query("limit"), 20)
	items, total, err := h.svc.List(ctx, ciType, status, tenantID, page, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:     items,
		Total:    total,
		Page:     page,
		PageSize: limit,
	})
}

// --- Batch operation handlers ---

func (h *Handler) BatchCreate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "BatchCreate")
	defer span.End()
	var req models.BatchCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	result, err := h.svc.BatchCreate(ctx, req.Items, tenantID, req.CreatedBy)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

func (h *Handler) BatchUpdate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "BatchUpdate")
	defer span.End()
	var req models.BatchUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	result, err := h.svc.BatchUpdate(ctx, req.Items, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) BatchDelete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "BatchDelete")
	defer span.End()
	var req models.BatchDeleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	result, err := h.svc.BatchDelete(ctx, req.Items, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) BatchQuery(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "BatchQuery")
	defer span.End()
	var req models.BatchQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	items, total, err := h.svc.BatchQuery(ctx, &req, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	limit := 20
	if req.Limit != nil {
		limit = *req.Limit
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:     items,
		Total:    total,
		Page:     1,
		PageSize: limit,
	})
}

// --- Export / Import handlers ---

func (h *Handler) ExportCI(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExportCI")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	ci, err := h.svc.ExportCI(ctx, id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "CI not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", "attachment; filename=\"ci-export.json\"")
	middleware.RespondSuccess(c, ci)
}

func (h *Handler) ExportAllCIs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExportAllCIs")
	defer span.End()
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	ciType := ptrIf(c.Query("ciType"))
	status := ptrIf(c.Query("status"))
	environment := ptrIf(c.Query("environment"))
	search := ptrIf(c.Query("search"))
	includeArchived := c.Query("includeArchived") == "true"
	result, err := h.svc.ExportCIs(ctx, ciType, status, environment, search, tenantID, includeArchived)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", "attachment; filename=\"cmdb-export.json\"")
	middleware.RespondSuccess(c, result)
}

func (h *Handler) ImportCIs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ImportCIs")
	defer span.End()
	var req models.ImportCIsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	result, err := h.svc.ImportCIs(ctx, req.CIs, tenantID, req.SkipDuplicates, req.CreatedBy)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// --- Relation handlers ---

func (h *Handler) GetRelations(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRelations")
	defer span.End()
	ciID := c.Param("ciId")
	relations, err := h.svc.GetRelations(ctx, ciID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, relations)
}

func (h *Handler) CreateRelation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateRelation")
	defer span.End()
	var req models.CreateRelationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	rel, err := h.svc.CreateRelation(ctx, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, rel)
}

func (h *Handler) DeleteRelation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteRelation")
	defer span.End()
	relationID := c.Param("relationId")
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	deleted, err := h.svc.DeleteRelation(ctx, relationID, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "relation not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "relation deleted"})
}

// --- Version handlers ---

func (h *Handler) GetVersions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetVersions")
	defer span.End()
	ciID := c.Param("ciId")
	versions, err := h.svc.GetVersions(ctx, ciID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, versions)
}

func (h *Handler) GetCurrentVersion(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCurrentVersion")
	defer span.End()
	ciID := c.Param("ciId")
	version, err := h.svc.GetCurrentVersion(ctx, ciID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, version)
}

func (h *Handler) RestoreVersion(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RestoreVersion")
	defer span.End()
	ciID := c.Param("ciId")
	var req models.RestoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	ci, err := h.svc.RestoreToVersion(ctx, ciID, req.Version, req.User, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, ci)
}

// --- Topology handlers ---

func (h *Handler) GetTopology(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTopology")
	defer span.End()
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	ciType := ptrIf(c.Query("ciType"))
	depthStr := c.Query("depth")
	var depth *int
	if depthStr != "" {
		v, err := strconv.Atoi(depthStr)
		if err == nil {
			depth = &v
		}
	}
	result, err := h.svc.GetTopology(ctx, ciType, depth, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) GetServiceDependencies(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetServiceDependencies")
	defer span.End()
	ciID := c.Param("ciId")
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	result, err := h.svc.GetServiceDependencies(ctx, tenantID, ciID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) GetImpactAnalysis(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetImpactAnalysis")
	defer span.End()
	ciID := c.Param("ciId")
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	result, err := h.svc.GetImpactAnalysis(ctx, tenantID, ciID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// --- Health handler ---

func (h *Handler) Health(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Health")
	defer span.End()
	status, err := h.svc.Health(ctx)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, status)
}

// --- Integration (Hosts, K8s, CICD, Execute) handlers ---

func (h *Handler) ListHosts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListHosts")
	defer span.End()
	status := ptrIf(c.Query("status"))
	tags := ptrIf(c.Query("tags"))
	limit := h.getQueryInt(c.Query("limit"), 20)
	offset := h.getQueryInt(c.Query("offset"), 0)
	items, total, err := h.svc.ListHosts(ctx, status, tags, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:     items,
		Total:    total,
		Page:     offset/limit + 1,
		PageSize: limit,
	})
}

func (h *Handler) GetHost(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetHost")
	defer span.End()
	ciID := c.Param("ciId")
	host, err := h.svc.GetHost(ctx, ciID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "Host not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, host)
}

func (h *Handler) ListK8sResources(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListK8sResources")
	defer span.End()
	kind := ptrIf(c.Query("kind"))
	namespace := ptrIf(c.Query("namespace"))
	limit := h.getQueryInt(c.Query("limit"), 20)
	offset := h.getQueryInt(c.Query("offset"), 0)
	items, total, err := h.svc.ListK8sResources(ctx, kind, namespace, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:     items,
		Total:    total,
		Page:     offset/limit + 1,
		PageSize: limit,
	})
}

func (h *Handler) StartK8sSync(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StartK8sSync")
	defer span.End()
	var req models.StartK8sSyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.StartK8sSync(ctx, &req); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "K8s sync started"})
}

func (h *Handler) StopK8sSync(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StopK8sSync")
	defer span.End()
	if err := h.svc.StopK8sSync(ctx); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "K8s sync stopped"})
}

func (h *Handler) ListCICDResources(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListCICDResources")
	defer span.End()
	status := ptrIf(c.Query("status"))
	limit := h.getQueryInt(c.Query("limit"), 20)
	offset := h.getQueryInt(c.Query("offset"), 0)
	items, total, err := h.svc.ListCICDResources(ctx, status, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:     items,
		Total:    total,
		Page:     offset/limit + 1,
		PageSize: limit,
	})
}

func (h *Handler) ExecuteScript(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExecuteScript")
	defer span.End()
	var req models.ScriptExecRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.ExecuteScript(ctx, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// --- Helpers ---

// getDefaultTenantID returns the tenant ID from the context or defaults to a zero UUID.
func (h *Handler) getDefaultTenantID(tenantID string) string {
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

// getQueryInt parses a query parameter as int with a default.
func (h *Handler) getQueryInt(value string, defaultVal int) int {
	if value == "" {
		return defaultVal
	}
	i, err := strconv.Atoi(value)
	if err != nil {
		return defaultVal
	}
	return i
}

// ptrIf returns a string pointer if non-empty, nil otherwise.
func ptrIf(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
