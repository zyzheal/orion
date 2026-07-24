// Package handler exposes the global search API via Gin routes.
package handler

import (
	"net/http"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/global-search/index"
	"orion/platform-svc-go/internal/global-search/models"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Handler provides the HTTP endpoints for global search.
type Handler struct {
	registry *index.IndexerRegistry
}

// NewHandler creates a new search handler.
func NewHandler(registry *index.IndexerRegistry) *Handler {
	return &Handler{registry: registry}
}

// RegisterRoutes mounts the search routes under /api/v1.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/search")
	r.POST("", auth.RequirePermission("search", "read"), h.Search)
	r.POST("/bulk", auth.RequirePermission("search", "read"), h.BulkSearch)
	r.GET("/modules", auth.RequirePermission("search", "read"), h.ListModules)
	r.GET("/status", auth.RequirePermission("search", "read"), h.Status)
	r.POST("/reindex", auth.RequirePermission("search", "write"), h.Reindex)
	r.DELETE("/:module", auth.RequirePermission("search", "delete"), h.DeleteModule)
}

// searchRequest is the JSON body for the search endpoint.
type searchRequest struct {
	Query         string            `json:"query" binding:"required"`
	Modules       []string          `json:"modules,omitempty"`
	Filters       map[string]string `json:"filters,omitempty"`
	ModuleFilters map[string]map[string]string `json:"module_filters,omitempty"`
	Page          int               `json:"page"`
	PageSize      int               `json:"page_size"`
	SortBy        string            `json:"sort_by,omitempty"`
	SortOrder     string            `json:"sort_order,omitempty"`
}

// bulkSearchRequest supports multiple queries in a single call.
type bulkSearchRequest struct {
	Queries []searchRequest `json:"queries" binding:"required"`
}

func (h *Handler) Search(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "global-search")
	defer span.End()

	var req searchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	sr := &models.SearchRequest{
		Query:       req.Query,
		Modules:     req.Modules,
		Filters:     req.Filters,
		ModuleFilters: req.ModuleFilters,
		From:        (req.Page - 1) * req.PageSize,
		Size:        req.PageSize,
		SortBy:      req.SortBy,
		SortOrder:   req.SortOrder,
	}

	if sr.Size <= 0 {
		sr.Size = 20
	}
	if sr.Size > 100 {
		sr.Size = 100
	}

	resp, err := h.registry.Search(ctx, sr)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	errors.WriteSuccess(c, resp)
}

func (h *Handler) BulkSearch(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "global-bulk-search")
	defer span.End()

	var req bulkSearchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	results := make([]models.SearchResponse, 0, len(req.Queries))
	for _, q := range req.Queries {
		sr := &models.SearchRequest{
			Query:   q.Query,
			Modules: q.Modules,
			Filters: q.Filters,
			From:    (q.Page - 1) * q.PageSize,
			Size:    q.PageSize,
			SortBy:  q.SortBy,
			SortOrder: q.SortOrder,
		}
		if sr.Size <= 0 {
			sr.Size = 20
		}
		resp, err := h.registry.Search(ctx, sr)
		if err != nil {
			middleware.RespondInternalError(c, err.Error())
			return
		}
		results = append(results, *resp)
	}

	errors.WriteSuccess(c, gin.H{"results": results})
}

func (h *Handler) ListModules(c *gin.Context) {
_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "global-search-modules")
	defer span.End()

	modules := h.registry.All()
	if modules == nil {
		modules = []string{}
	}
	errors.WriteSuccess(c, gin.H{"modules": modules})
}

func (h *Handler) Status(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "global-search-status")
	defer span.End()

	statuses := h.registry.Status(ctx)
	errors.WriteSuccess(c, gin.H{"indexers": statuses})
}

func (h *Handler) Reindex(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "global-search-reindex")
	defer span.End()

	var req models.ReindexRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	results, err := h.registry.Reindex(ctx, req.Module)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if len(results) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "no indexers registered"})
		return
	}
	errors.WriteSuccess(c, results)
}

func (h *Handler) DeleteModule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "global-search-delete-module")
	defer span.End()

	module := c.Param("module")
	ix := h.registry.Get(module)
	if ix == nil {
		middleware.RespondNotFound(c, "module not found: "+module)
		return
	}
	if err := ix.DeleteIndex(ctx); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted", "module": module})
}
