package handler

import (
	"errors"
	"strconv"

	"github.com/gin-gonic/gin"

	"orion/go-common/pkg/auth"
	"orion-tool-svc-go/internal/models"
	"orion-tool-svc-go/internal/service"
)

// ToolHandler handles HTTP requests for tools.
type ToolHandler struct {
	svc *service.ToolService
}

func NewToolHandler(svc *service.ToolService) *ToolHandler {
	return &ToolHandler{svc: svc}
}

func (h *ToolHandler) CreateTool(c *gin.Context) {
	var req models.CreateToolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	tenantID := auth.GetTenantID(c)
	userID := auth.GetUserID(c)
	if tenantID == "" || userID == "" {
		respondBadRequest(c, "tenant_id and user_id required")
		return
	}

	tool, err := h.svc.Create(c.Request.Context(), tenantID, userID, req)
	if err != nil {
		respondInternalError(c, "internal error")
		return
	}
	respondCreated(c, tool)
}

func (h *ToolHandler) GetTool(c *gin.Context) {
	tenantID := auth.GetTenantID(c)
	id := c.Param("id")

	tool, err := h.svc.Get(c.Request.Context(), tenantID, id)
	if err != nil {
		if errors.Is(err, models.ErrToolNotFound) {
			respondNotFound(c, "tool not found")
			return
		}
		respondInternalError(c, "internal error")
		return
	}
	respondSuccess(c, tool)
}

func (h *ToolHandler) ListTools(c *gin.Context) {
	tenantID := auth.GetTenantID(c)

	var params models.ToolListParams
	if err := c.ShouldBindQuery(&params); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	tools, total, err := h.svc.List(c.Request.Context(), tenantID, params)
	if err != nil {
		respondInternalError(c, "internal error")
		return
	}
	respondSuccess(c, gin.H{"data": tools, "total": total})
}

func (h *ToolHandler) UpdateTool(c *gin.Context) {
	tenantID := auth.GetTenantID(c)
	id := c.Param("id")

	var req models.UpdateToolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	tool, err := h.svc.Update(c.Request.Context(), tenantID, id, req)
	if err != nil {
		if errors.Is(err, models.ErrToolNotFound) {
			respondNotFound(c, "tool not found")
			return
		}
		respondInternalError(c, "internal error")
		return
	}
	respondSuccess(c, tool)
}

func (h *ToolHandler) DeleteTool(c *gin.Context) {
	tenantID := auth.GetTenantID(c)
	id := c.Param("id")

	if err := h.svc.Delete(c.Request.Context(), tenantID, id); err != nil {
		respondInternalError(c, "internal error")
		return
	}
	respondSuccess(c, map[string]any{"message": "deleted"})
}

func (h *ToolHandler) GetCategories(c *gin.Context) {
	tenantID := auth.GetTenantID(c)

	cats, err := h.svc.GetCategories(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, "internal error")
		return
	}
	respondSuccess(c, cats)
}

func (h *ToolHandler) SearchTools(c *gin.Context) {
	tenantID := auth.GetTenantID(c)
	query := c.Query("q")
	if len(query) < 2 {
		respondBadRequest(c, "search query must be at least 2 characters")
		return
	}

	tools, err := h.svc.Search(c.Request.Context(), tenantID, query)
	if err != nil {
		respondInternalError(c, "internal error")
		return
	}
	respondSuccess(c, tools)
}

func (h *ToolHandler) GetVersions(c *gin.Context) {
	tenantID := auth.GetTenantID(c)
	id := c.Param("id")

	versions, err := h.svc.GetVersions(c.Request.Context(), tenantID, id)
	if err != nil {
		if errors.Is(err, models.ErrToolNotFound) {
			respondNotFound(c, "tool not found")
			return
		}
		respondInternalError(c, "internal error")
		return
	}
	respondSuccess(c, versions)
}

func (h *ToolHandler) GetInvocations(c *gin.Context) {
	tenantID := auth.GetTenantID(c)
	id := c.Param("id")

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit < 1 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	invs, err := h.svc.GetInvocations(c.Request.Context(), tenantID, id, limit, offset)
	if err != nil {
		respondInternalError(c, "internal error")
		return
	}
	respondSuccess(c, invs)
}

// CreateVersion creates a new version record for a tool.
func (h *ToolHandler) CreateVersion(c *gin.Context) {
	tenantID := auth.GetTenantID(c)
	userID := c.GetHeader("X-User-ID")
	toolID := c.Param("id")

	if tenantID == "" || userID == "" {
		respondBadRequest(c, "X-Tenant-ID and X-User-ID headers required")
		return
	}

	var req models.CreateToolVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	version, err := h.svc.CreateVersion(c.Request.Context(), tenantID, userID, toolID, req)
	if err != nil {
		if errors.Is(err, models.ErrToolNotFound) {
			respondNotFound(c, "tool not found")
			return
		}
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, version)
}

// GetInvocationDetail retrieves a single invocation record.
func (h *ToolHandler) GetInvocationDetail(c *gin.Context) {
	tenantID := auth.GetTenantID(c)
	id := c.Param("id")

	inv, err := h.svc.GetInvocationDetail(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, "invocation not found")
		return
	}
	respondSuccess(c, inv)
}

// InvokeTool executes a tool and records the invocation.
func (h *ToolHandler) InvokeTool(c *gin.Context) {
	tenantID := auth.GetTenantID(c)
	userID := c.GetHeader("X-User-ID")
	toolID := c.Param("id")
	version := c.Query("version")

	if tenantID == "" || userID == "" {
		respondBadRequest(c, "X-Tenant-ID and X-User-ID headers required")
		return
	}

	var req models.InvokeToolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	inv, err := h.svc.InvokeTool(c.Request.Context(), tenantID, userID, toolID, version, req)
	if err != nil {
		if errors.Is(err, models.ErrToolNotFound) {
			respondNotFound(c, "tool not found")
			return
		}
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, inv)
}

// GetStats returns overall tenant usage statistics.
func (h *ToolHandler) GetStats(c *gin.Context) {
	tenantID := auth.GetTenantID(c)
	period := c.DefaultQuery("period", "day")

	stats, err := h.svc.GetStats(c.Request.Context(), tenantID, models.StatsPeriod(period))
	if err != nil {
		respondInternalError(c, "internal error")
		return
	}
	respondSuccess(c, stats)
}

// GetToolStats returns usage statistics for a specific tool.
func (h *ToolHandler) GetToolStats(c *gin.Context) {
	tenantID := auth.GetTenantID(c)
	toolID := c.Param("id")

	stats, err := h.svc.GetToolStats(c.Request.Context(), tenantID, toolID)
	if err != nil {
		if errors.Is(err, models.ErrToolNotFound) {
			respondNotFound(c, "tool not found")
			return
		}
		respondInternalError(c, "internal error")
		return
	}
	respondSuccess(c, stats)
}

// GetTopTools returns the most-used tools for a tenant.
func (h *ToolHandler) GetTopTools(c *gin.Context) {
	tenantID := auth.GetTenantID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if limit < 1 || limit > 50 {
		limit = 10
	}

	ranks, err := h.svc.GetTopTools(c.Request.Context(), tenantID, limit)
	if err != nil {
		respondInternalError(c, "internal error")
		return
	}
	respondSuccess(c, ranks)
}

// MarketSearch searches active tools with filters.
func (h *ToolHandler) MarketSearch(c *gin.Context) {
	tenantID := auth.GetTenantID(c)

	var params models.MarketSearchParams
	if err := c.ShouldBindQuery(&params); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	tools, total, err := h.svc.MarketSearch(c.Request.Context(), tenantID, params)
	if err != nil {
		respondInternalError(c, "internal error")
		return
	}
	respondSuccess(c, gin.H{"data": tools, "total": total})
}

// RegisterRoutes registers all tool routes on the given gin group.
func (h *ToolHandler) RegisterRoutes(g *gin.RouterGroup) {
	tools := g.Group("/tools")
	{
		tools.POST("", h.CreateTool)
		tools.GET("", h.ListTools)
		tools.GET("/search", h.SearchTools)
		tools.GET("/market", h.MarketSearch)
		tools.GET("/top", h.GetTopTools)
		tools.GET("/stats", h.GetStats)
		tools.GET("/:id", h.GetTool)
		tools.PUT("/:id", h.UpdateTool)
		tools.DELETE("/:id", h.DeleteTool)
		tools.POST("/:id/invocations", h.InvokeTool)
		tools.GET("/:id/invocations", h.GetInvocations)
		tools.GET("/:id/versions", h.GetVersions)
		tools.POST("/:id/versions", h.CreateVersion)
		tools.GET("/:id/stats", h.GetToolStats)
	}
	g.GET("/categories", h.GetCategories)
	g.GET("/invocations/:id", h.GetInvocationDetail)
}
