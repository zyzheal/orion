package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/cmdb/models"
	"orion/platform-svc-go/internal/cmdb/service"

	"github.com/gin-gonic/gin"
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
}

// --- CI CRUD handlers ---

func (h *Handler) CreateCI(c *gin.Context) {
	var req models.CreateCIRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	ci, err := h.svc.Create(c.Request.Context(), &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, ci)
}

func (h *Handler) GetCI(c *gin.Context) {
	id := c.Param("id")
	ci, err := h.svc.Get(c.Request.Context(), id)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "CI not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, ci)
}

func (h *Handler) GetCIByID(c *gin.Context) {
	ciID := c.Param("ciId")
	tenantIDStr := c.Query("tenantId")
	var tenantID *int64
	if tenantIDStr != "" {
		v, err := strconv.ParseInt(tenantIDStr, 10, 64)
		if err == nil {
			tenantID = &v
		}
	}
	ci, err := h.svc.GetByCiId(c.Request.Context(), ciID, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "CI not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, ci)
}

func (h *Handler) UpdateCI(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateCIRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	ci, err := h.svc.Update(c.Request.Context(), id, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, ci)
}

func (h *Handler) DeleteCI(c *gin.Context) {
	id := c.Param("id")
	deleted, err := h.svc.Delete(c.Request.Context(), id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if !deleted {
		respondNotFound(c, "CI not found")
		return
	}
	respondSuccess(c, gin.H{"message": "CI deleted"})
}

func (h *Handler) ListCIs(c *gin.Context) {
	tenantID := h.getDefaultTenantID(c.Query("tenantId"))
	ciType := ptrIf(c.Query("ciType"))
	status := ptrIf(c.Query("status"))
	page := h.getQueryInt(c.Query("page"), 1)
	limit := h.getQueryInt(c.Query("limit"), 20)
	items, total, err := h.svc.List(c.Request.Context(), ciType, status, tenantID, page, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, models.PaginatedResponse{
		Data:     items,
		Total:    total,
		Page:     page,
		PageSize: limit,
	})
}

// --- Batch operation handlers ---

func (h *Handler) BatchCreate(c *gin.Context) {
	var req models.BatchCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	result, err := h.svc.BatchCreate(c.Request.Context(), req.Items, tenantID, req.CreatedBy)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, result)
}

func (h *Handler) BatchUpdate(c *gin.Context) {
	var req models.BatchUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	result, err := h.svc.BatchUpdate(c.Request.Context(), req.Items, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) BatchDelete(c *gin.Context) {
	var req models.BatchDeleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	result, err := h.svc.BatchDelete(c.Request.Context(), req.Items, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) BatchQuery(c *gin.Context) {
	var req models.BatchQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	items, total, err := h.svc.BatchQuery(c.Request.Context(), &req, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	limit := 20
	if req.Limit != nil {
		limit = *req.Limit
	}
	respondSuccess(c, models.PaginatedResponse{
		Data:     items,
		Total:    total,
		Page:     1,
		PageSize: limit,
	})
}

// --- Export / Import handlers ---

func (h *Handler) ExportCI(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	ci, err := h.svc.ExportCI(c.Request.Context(), id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "CI not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", "attachment; filename=\"ci-export.json\"")
	respondSuccess(c, ci)
}

func (h *Handler) ExportAllCIs(c *gin.Context) {
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	ciType := ptrIf(c.Query("ciType"))
	status := ptrIf(c.Query("status"))
	environment := ptrIf(c.Query("environment"))
	search := ptrIf(c.Query("search"))
	includeArchived := c.Query("includeArchived") == "true"
	result, err := h.svc.ExportCIs(c.Request.Context(), ciType, status, environment, search, tenantID, includeArchived)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", "attachment; filename=\"cmdb-export.json\"")
	respondSuccess(c, result)
}

func (h *Handler) ImportCIs(c *gin.Context) {
	var req models.ImportCIsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	result, err := h.svc.ImportCIs(c.Request.Context(), req.CIs, tenantID, req.SkipDuplicates, req.CreatedBy)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// --- Relation handlers ---

func (h *Handler) GetRelations(c *gin.Context) {
	ciID := c.Param("ciId")
	relations, err := h.svc.GetRelations(c.Request.Context(), ciID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, relations)
}

func (h *Handler) CreateRelation(c *gin.Context) {
	var req models.CreateRelationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	rel, err := h.svc.CreateRelation(c.Request.Context(), &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, rel)
}

func (h *Handler) DeleteRelation(c *gin.Context) {
	relationID := c.Param("relationId")
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	deleted, err := h.svc.DeleteRelation(c.Request.Context(), relationID, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if !deleted {
		respondNotFound(c, "relation not found")
		return
	}
	respondSuccess(c, gin.H{"message": "relation deleted"})
}

// --- Version handlers ---

func (h *Handler) GetVersions(c *gin.Context) {
	ciID := c.Param("ciId")
	versions, err := h.svc.GetVersions(c.Request.Context(), ciID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, versions)
}

func (h *Handler) GetCurrentVersion(c *gin.Context) {
	ciID := c.Param("ciId")
	version, err := h.svc.GetCurrentVersion(c.Request.Context(), ciID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, version)
}

func (h *Handler) RestoreVersion(c *gin.Context) {
	ciID := c.Param("ciId")
	var req models.RestoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	ci, err := h.svc.RestoreToVersion(c.Request.Context(), ciID, req.Version, req.User, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, ci)
}

// --- Topology handlers ---

func (h *Handler) GetTopology(c *gin.Context) {
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
	result, err := h.svc.GetTopology(c.Request.Context(), ciType, depth, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) GetServiceDependencies(c *gin.Context) {
	ciID := c.Param("ciId")
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	result, err := h.svc.GetServiceDependencies(c.Request.Context(), tenantID, ciID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) GetImpactAnalysis(c *gin.Context) {
	ciID := c.Param("ciId")
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	result, err := h.svc.GetImpactAnalysis(c.Request.Context(), tenantID, ciID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// --- Health handler ---

func (h *Handler) Health(c *gin.Context) {
	status, err := h.svc.Health(c.Request.Context())
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, status)
}

// --- Helpers ---

// getDefaultTenantID returns the tenant ID from the context or defaults to 1.
func (h *Handler) getDefaultTenantID(tenantID string) int64 {
	if tenantID == "" {
		return 1
	}
	v, err := strconv.ParseInt(tenantID, 10, 64)
	if err != nil {
		return 1
	}
	return v
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
