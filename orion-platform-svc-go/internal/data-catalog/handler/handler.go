package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/data-catalog/models"
	"orion/platform-svc-go/internal/data-catalog/service"

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

// RegisterRoutes mounts data-catalog endpoints under /api/v1/data-catalog.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/data-catalog")

	// CRUD on /entries
	// POST /data-catalog/entries
	f.POST("/entries", auth.RequirePermission("data-catalog", "write"), h.CreateEntry)
	// GET /data-catalog/entries
	f.GET("/entries", auth.RequirePermission("data-catalog", "read"), h.ListEntries)
	// GET /data-catalog/entries/:id
	f.GET("/entries/:id", auth.RequirePermission("data-catalog", "read"), h.GetEntry)
	// PUT /data-catalog/entries/:id
	f.PUT("/entries/:id", auth.RequirePermission("data-catalog", "write"), h.UpdateEntry)
	// DELETE /data-catalog/entries/:id
	f.DELETE("/entries/:id", auth.RequirePermission("data-catalog", "write"), h.DeleteEntry)
	// GET /data-catalog/entries/table/:tableName — browse entries by table
	f.GET("/entries/table/:tableName", auth.RequirePermission("data-catalog", "read"), h.GetEntriesByTable)

	// Search / filter
	// GET /data-catalog/search
	f.GET("/search", auth.RequirePermission("data-catalog", "read"), h.SearchEntries)

	// Auto-discovery
	// POST /data-catalog/discover
	f.POST("/discover", auth.RequirePermission("data-catalog", "write"), h.Discover)

	// Statistics
	// GET /data-catalog/statistics
	f.GET("/statistics", auth.RequirePermission("data-catalog", "read"), h.GetStatistics)
}

// --- CRUD handlers ---

func (h *Handler) CreateEntry(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateEntry")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateEntryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.CreateEntry(ctx, tenantID, req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, m)
}

func (h *Handler) ListEntries(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListEntries")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListEntries(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) GetEntry(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetEntry")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.GetEntry(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "catalog entry not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) UpdateEntry(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateEntry")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	_ = span.End // unused
	id := c.Param("id")
	var req models.UpdateEntryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.UpdateEntry(ctx, tenantID, id, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "catalog entry not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) DeleteEntry(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteEntry")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteEntry(ctx, tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondNoContent(c)
}

func (h *Handler) GetEntriesByTable(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetEntriesByTable")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	tableName := c.Param("tableName")
	items, err := h.svc.GetEntriesByTable(ctx, tenantID, tableName)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

// --- Search ---

func (h *Handler) SearchEntries(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SearchEntries")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	q := models.SearchRequest{
		Query:     c.Query("q"),
		DataType:  c.Query("dataType"),
		TableName: c.Query("tableName"),
		Owner:     c.Query("owner"),
		SchemaVer: c.Query("schemaVersion"),
		Page:      page,
		Limit:     limit,
	}
	resp, err := h.svc.SearchEntries(ctx, tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, resp)
}

// --- Auto-discovery ---

func (h *Handler) Discover(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Discover")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	summary := h.svc.Discover(ctx, tenantID)
	middleware.RespondSuccess(c, summary)
}

// --- Statistics ---

func (h *Handler) GetStatistics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStatistics")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListEntries(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	stats := gin.H{
		"totalEntries": len(items),
		"message":      "statistics endpoint — derive from entry list; full stats to be added in future",
	}
	middleware.RespondSuccess(c, stats)
}
