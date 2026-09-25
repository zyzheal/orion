// Package handler provides the HTTP layer for the CMDB collector.
//
// Endpoints are mounted under /api/v1/collector and mirror the TS blueprint
// routes.  The handler delegates to CollectorService and formats responses
// with the platform's middleware helpers.
//
// API contract:
//
//	GET    /collectors            — list registered adapters
//	GET    /collectors/:name      — adapter info (name + schema)
//	GET    /collectors/:name/targets     — list targets for an adapter
//	POST   /collectors/:name/targets     — register a target
//	DELETE /collectors/:name/targets/:id — delete a target
//	POST   /collectors/:name/discover     — run discovery on a target
//	POST   /collectors/:name/collect      — collect attributes from a device
//	GET    /collections                  — list recent collection results
//	GET    /collections/:collectionId    — single collection result
//	GET    /devices                      — list discovered devices
//	GET    /devices/:id                  — device details
//	GET    /health                       — health check (no auth)
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

// Handler wires the collector Service to HTTP endpoints.
type Handler struct {
	svc *service.Service
}

// NewHandler returns a new Handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all collector endpoints under the given RouterGroup.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	c := rg.Group("/collector")

	// --- Collectors ---
	c.GET("/collectors", auth.RequirePermission("cmdb", "read"), h.ListCollectors)
	c.GET("/collectors/:name", auth.RequirePermission("cmdb", "read"), h.GetCollector)

	// --- Targets ---
	c.GET("/collectors/:name/targets", auth.RequirePermission("cmdb", "read"), h.ListTargets)
	c.POST("/collectors/:name/targets", auth.RequirePermission("cmdb", "write"), h.CreateTarget)
	c.DELETE("/collectors/:name/targets/:id", auth.RequirePermission("cmdb", "delete"), h.DeleteTarget)

	// --- Actions ---
	c.POST("/collectors/:name/discover", auth.RequirePermission("cmdb", "write"), h.Discover)
	c.POST("/collectors/:name/collect", auth.RequirePermission("cmdb", "write"), h.Collect)

	// --- Collections ---
	c.GET("/collections", auth.RequirePermission("cmdb", "read"), h.ListCollections)
	c.GET("/collections/:collectionId", auth.RequirePermission("cmdb", "read"), h.GetCollection)

	// --- Devices ---
	c.GET("/devices", auth.RequirePermission("cmdb", "read"), h.ListDevices)
	c.GET("/devices/:id", auth.RequirePermission("cmdb", "read"), h.GetDevice)

	// --- Health ---
	c.GET("/health", h.Health)
}

// ---------- Collectors ----------

func (h *Handler) ListCollectors(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListCollectors")
	defer span.End()
	items := h.svc.ListCollectors()
	middleware.RespondSuccess(c, items)
}

func (h *Handler) GetCollector(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCollector")
	defer span.End()
	name := c.Param("name")
	collectors := h.svc.ListCollectors()
	for _, item := range collectors {
		if item.Name == name {
			middleware.RespondSuccess(c, item)
			return
		}
	}
	middleware.RespondNotFound(c, "collector not found")
}

// ---------- Targets ----------

func (h *Handler) ListTargets(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListTargets")
	defer span.End()
	tenantID, ok := h.tenantID(c)
	if !ok {
		return
	}
	collectorName := c.Param("name")
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if limit <= 0 || limit > 500 {
		limit = 50
	}
	// The route carries an adapter name, but cmdb_targets has no adapter or
	// collector column — targets are typed network|server|database|… and carry
	// a protocol tag. Passing :name through as a target-type filter therefore
	// matched nothing for every real target and this endpoint always answered
	// an empty page. List the tenant's targets; per-adapter scoping needs a
	// schema column first.
	targets, err := h.svc.ListTargets(ctx, tenantID, "", offset, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"targets":   targets,
		"total":     len(targets),
		"collector": collectorName,
	})
}

func (h *Handler) CreateTarget(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateTarget")
	defer span.End()
	var req struct {
		Name     string                 `json:"name" binding:"required"`
		Host     string                 `json:"host" binding:"required"`
		Port     int                    `json:"port"`
		Type     string                 `json:"type"`
		Protocol string                 `json:"protocol"`
		Config   map[string]interface{} `json:"config"`
		Metadata map[string]interface{} `json:"metadata"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	tenantID, ok := h.tenantID(c)
	if !ok {
		return
	}
	if req.Port == 0 {
		req.Port = 161 // default SNMP
	}
	if req.Type == "" {
		req.Type = "network"
	}
	if req.Protocol == "" {
		req.Protocol = "snmp"
	}

	target := &models.Target{
		Name:       req.Name,
		Host:       req.Host,
		Port:       req.Port,
		TargetType: req.Type,
		Protocol:   req.Protocol,
		TenantID:   tenantID,
		Config:     req.Config,
		Metadata:   req.Metadata,
	}

	repo := h.svc.Repository()
	if err := repo.CreateTarget(ctx, target); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, target)
}

func (h *Handler) DeleteTarget(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteTarget")
	defer span.End()
	tenantID, ok := h.tenantID(c)
	if !ok {
		return
	}
	id := c.Param("id")
	if err := h.svc.Repository().DeleteTarget(ctx, tenantID, id); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "target not found")
		} else {
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "target deleted"})
}

// ---------- Actions ----------

func (h *Handler) Discover(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Discover")
	defer span.End()
	var req models.DiscoverRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	collectorName := c.Param("name")
	tenantID, ok := h.tenantID(c)
	if !ok {
		return
	}

	result, err := h.svc.RunDiscovery(ctx, tenantID, req.TargetID, collectorName, req.Config)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) Collect(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Collect")
	defer span.End()
	var req models.CollectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	collectorName := c.Param("name")
	tenantID, ok := h.tenantID(c)
	if !ok {
		return
	}

	result, err := h.svc.RunCollection(ctx, tenantID, req.DeviceID, collectorName, req.Config)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// ---------- Collections ----------

func (h *Handler) ListCollections(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListCollections")
	defer span.End()
	tenantID, ok := h.tenantID(c)
	if !ok {
		return
	}
	collectorName := c.Query("collector")
	deviceID := c.Query("device_id")
	status := c.Query("status")
	offset := queryOffset(c.Query("offset"))
	limit := queryLimit(c.Query("limit"), 20)

	items, err := h.svc.Repository().ListCollections(ctx, tenantID, collectorName, deviceID, status, offset, limit)
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

func (h *Handler) GetCollection(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCollection")
	defer span.End()
	tenantID, ok := h.tenantID(c)
	if !ok {
		return
	}
	collectionID := c.Param("collectionId")

	collection, err := h.svc.Repository().GetCollection(ctx, tenantID, collectionID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "collection not found")
		} else {
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, collection)
}

// ---------- Devices ----------

func (h *Handler) ListDevices(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListDevices")
	defer span.End()
	tenantID, ok := h.tenantID(c)
	if !ok {
		return
	}
	deviceType := c.Query("type")
	vendor := c.Query("vendor")
	offset := queryOffset(c.Query("offset"))
	limit := queryLimit(c.Query("limit"), 20)

	items, err := h.svc.Repository().ListDevices(ctx, tenantID, deviceType, vendor, offset, limit)
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

func (h *Handler) GetDevice(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDevice")
	defer span.End()
	tenantID, ok := h.tenantID(c)
	if !ok {
		return
	}
	id := c.Param("id")

	device, err := h.svc.Repository().GetDevice(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "device not found")
		} else {
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, device)
}

// ---------- Health ----------

func (h *Handler) Health(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Health")
	defer span.End()
	middleware.RespondSuccess(c, models.HealthStatus{Status: "ok"})
}

// ---------- Helpers ----------

// tenantID returns the caller's tenant id from the Gin context. It fails
// closed: when the JWT middleware did not populate tenant_id the request is
// rejected with 401 instead of being folded into the
// 00000000-0000-0000-0000-000000000000 bucket, which would have shared every
// tenant-less request's targets, devices and collections with each other.
// Callers must stop when ok is false — the 401 has already been written.
func (h *Handler) tenantID(c *gin.Context) (string, bool) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return "", false
	}
	return tenantID, true
}

// queryLimit parses a "limit" query param as a page size, falling back to the
// default when it is missing, unparsable or <= 0. A page size of 0 would pass
// LIMIT 0 to the database and divide by zero in the Page calculation below, so
// it is treated like an absent param.
func queryLimit(value string, def int) int {
	if i, err := strconv.Atoi(value); err == nil && i > 0 {
		return i
	}
	return def
}

// queryOffset parses an "offset" query param, clamping a negative value to 0.
// Postgres rejects a negative OFFSET, so without the clamp `?offset=-1` turns a
// list endpoint into a 500; and offset/limit + 1 would put 0 or a negative
// number in the response's page field. Absent and unparsable values are 0.
func queryOffset(value string) int {
	if i, err := strconv.Atoi(value); err == nil && i > 0 {
		return i
	}
	return 0
}
