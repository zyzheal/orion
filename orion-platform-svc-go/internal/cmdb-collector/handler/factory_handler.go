// Package handler provides the HTTP layer for the CMDB collector adapter
// catalog and discovery job / asset management.
//
// Endpoints are mounted under /api/cmdb and cover the adapter catalog CRUD
// (cmdb_adapters), discovery job submission (cmdb_discovery_jobs), and
// asset inventory queries (cmdb_assets).  The handler delegates to
// service.AdapterFactory.
//
// API contract:
//   GET    /api/cmdb/adapters              — List adapters
//   GET    /api/cmdb/adapters/:id          — Get adapter
//   POST   /api/cmdb/adapters              — Create adapter
//   PUT    /api/cmdb/adapters/:id          — Update adapter
//   DELETE /api/cmdb/adapters/:id          — Delete adapter
//   POST   /api/cmdb/adapters/:id/discover — Run discovery
//   GET    /api/cmdb/discoveries           — List discovery jobs
//   GET    /api/cmdb/discoveries/:id       — Get discovery job
//   GET    /api/cmdb/assets                — List assets
//   GET    /api/cmdb/assets/:id            — Get asset
package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/cmdb-collector/models"
	"orion/platform-svc-go/internal/cmdb-collector/service"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// FactoryHandler wires the AdapterFactory to HTTP endpoints.
type FactoryHandler struct {
	factory *service.AdapterFactory
}

// NewFactoryHandler returns a new FactoryHandler.
func NewFactoryHandler(factory *service.AdapterFactory) *FactoryHandler {
	return &FactoryHandler{factory: factory}
}

// RegisterRoutes mounts all adapter catalog / discovery / asset endpoints
// under the given RouterGroup (expected to be registered at /api/cmdb).
func (h *FactoryHandler) RegisterRoutes(rg *gin.RouterGroup) {
	// --- Adapters ---
	rg.GET("/adapters", auth.RequirePermission("cmdb", "read"), h.ListAdapters)
	rg.POST("/adapters", auth.RequirePermission("cmdb", "write"), h.CreateAdapter)
	rg.GET("/adapters/:id", auth.RequirePermission("cmdb", "read"), h.GetAdapter)
	rg.PUT("/adapters/:id", auth.RequirePermission("cmdb", "write"), h.UpdateAdapter)
	rg.DELETE("/adapters/:id", auth.RequirePermission("cmdb", "delete"), h.DeleteAdapter)
	rg.POST("/adapters/:id/discover", auth.RequirePermission("cmdb", "write"), h.RunDiscover)

	// --- Discovery jobs ---
	rg.GET("/discoveries", auth.RequirePermission("cmdb", "read"), h.ListJobs)
	rg.GET("/discoveries/:id", auth.RequirePermission("cmdb", "read"), h.GetJob)

	// --- Assets ---
	rg.GET("/assets", auth.RequirePermission("cmdb", "read"), h.ListAssets)
	rg.GET("/assets/:id", auth.RequirePermission("cmdb", "read"), h.GetAsset)
}

// ===========================================================================
// Adapters
// ===========================================================================

func (h *FactoryHandler) ListAdapters(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAdapters")
	defer span.End()
	tenantID := h.tenantID(c)
	filter := service.ListAdaptersFilter{
		Category: c.Query("category"),
		Offset:   h.queryInt(c.Query("offset"), 0),
		Limit:    h.queryInt(c.Query("limit"), 20),
	}

	items, err := h.factory.ListAdapters(c.Request.Context(), tenantID, filter)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *FactoryHandler) CreateAdapter(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateAdapter")
	defer span.End()
	var req models.AdapterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.tenantID(c)
	adapter := &models.CMDBAdapter{
		TenantID:    tenantID,
		Name:        req.Name,
		Category:    req.Category,
		Vendor:      req.Vendor,
		Description: req.Description,
		Config:      req.Config,
		Enabled:     true,
	}
	if req.Enabled {
		adapter.Enabled = true
	}

	if err := h.factory.CreateAdapter(c.Request.Context(), tenantID, adapter); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, adapter)
}

func (h *FactoryHandler) GetAdapter(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAdapter")
	defer span.End()
	id := c.Param("id")
	tenantID := h.tenantID(c)

	adapter, err := h.factory.GetAdapter(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, adapter)
}

func (h *FactoryHandler) UpdateAdapter(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateAdapter")
	defer span.End()
	id := c.Param("id")
	tenantID := h.tenantID(c)

	var req models.AdapterUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	// Load existing adapter.
	existing, err := h.factory.GetAdapter(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}

	// Merge request fields onto existing.
	if req.Name != nil {
		existing.Name = *req.Name
	}
	if req.Category != nil {
		existing.Category = *req.Category
	}
	if req.Vendor != nil {
		existing.Vendor = *req.Vendor
	}
	if req.Description != nil {
		existing.Description = *req.Description
	}
	if req.Config != nil {
		existing.Config = *req.Config
	}
	if req.Enabled != nil {
		existing.Enabled = *req.Enabled
	}

	if err := h.factory.UpdateAdapter(c.Request.Context(), tenantID, existing); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, existing)
}

func (h *FactoryHandler) DeleteAdapter(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteAdapter")
	defer span.End()
	id := c.Param("id")
	tenantID := h.tenantID(c)

	if err := h.factory.DeleteAdapter(c.Request.Context(), tenantID, id); err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "adapter deleted"})
}

// ===========================================================================
// Discovery
// ===========================================================================

func (h *FactoryHandler) RunDiscover(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RunDiscover")
	defer span.End()
	adapterID := c.Param("id")

	var req models.DiscoveryJobRequest
	req.AdapterID = adapterID // default to path param
	if err := c.ShouldBindJSON(&req); err != nil {
		// No body is acceptable; fall back to path param.
		if req.AdapterID == "" {
			req.AdapterID = adapterID
		}
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.AdapterID == "" {
		req.AdapterID = adapterID
	}
	tenantID := h.tenantID(c)

	job, err := h.factory.CreateJob(c.Request.Context(), tenantID, req.AdapterID, req.Target)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, job)
}

// ===========================================================================
// Discovery jobs
// ===========================================================================

func (h *FactoryHandler) ListJobs(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListJobs")
	defer span.End()
	tenantID := h.tenantID(c)
	offset := h.queryInt(c.Query("offset"), 0)
	limit := h.queryInt(c.Query("limit"), 20)

	items, err := h.factory.ListJobs(c.Request.Context(), tenantID, c.Query("adapter_id"), c.Query("status"), offset, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:     items,
		Total:    len(items),
		Page:     offset/limit + 1,
		PageSize: limit,
	})
}

func (h *FactoryHandler) GetJob(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetJob")
	defer span.End()
	id := c.Param("id")
	tenantID := h.tenantID(c)

	job, err := h.factory.GetJob(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, job)
}

// ===========================================================================
// Assets
// ===========================================================================

func (h *FactoryHandler) ListAssets(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAssets")
	defer span.End()
	tenantID := h.tenantID(c)
	offset := h.queryInt(c.Query("offset"), 0)
	limit := h.queryInt(c.Query("limit"), 20)

	filter := service.ListAssetsFilter{
		AdapterID: c.Query("adapter_id"),
		AssetType: c.Query("asset_type"),
		Status:    c.Query("status"),
		Offset:    offset,
		Limit:     limit,
	}

	items, err := h.factory.ListAssets(c.Request.Context(), tenantID, filter)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:     items,
		Total:    len(items),
		Page:     offset/limit + 1,
		PageSize: limit,
	})
}

func (h *FactoryHandler) GetAsset(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAsset")
	defer span.End()
	id := c.Param("id")
	tenantID := h.tenantID(c)

	asset, err := h.factory.GetAsset(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, asset)
}

// ===========================================================================
// Helpers
// ===========================================================================

func (h *FactoryHandler) tenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		tenantID = "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

func (h *FactoryHandler) queryInt(value string, defaultVal int) int {
	if value == "" {
		return defaultVal
	}
	i, err := strconv.Atoi(value)
	if err != nil {
		return defaultVal
	}
	return i
}
