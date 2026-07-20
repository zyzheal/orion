package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/artifact/models"
	"orion/platform-svc-go/internal/artifact/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel/trace"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all artifact endpoints under /artifacts (20 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/artifacts")

	// --- Core CRUD ---
	// POST /artifacts - 创建制品
	f.POST("", auth.RequirePermission("artifact", "write"), h.Create)
	// GET /artifacts - 获取制品列表
	f.GET("", auth.RequirePermission("artifact", "read"), h.List)
	// GET /artifacts/:id - 获取制品详情
	f.GET("/:id", auth.RequirePermission("artifact", "read"), h.Get)
	// PUT /artifacts/:id - 更新制品
	f.PUT("/:id", auth.RequirePermission("artifact", "write"), h.Update)
	// DELETE /artifacts/:id - 删除制品
	f.DELETE("/:id", auth.RequirePermission("artifact", "write"), h.Delete)

	// --- Tags ---
	// POST /artifacts/:id/tags - 添加标签
	f.POST("/:id/tags", auth.RequirePermission("artifact", "write"), h.AddTags)
	// DELETE /artifacts/:id/tags - 移除标签
	f.DELETE("/:id/tags", auth.RequirePermission("artifact", "write"), h.RemoveTags)
	// GET /artifacts/:id/tags - 获取标签
	f.GET("/:id/tags", auth.RequirePermission("artifact", "read"), h.GetTags)

	// --- Download ---
	// GET /artifacts/:id/download - 下载制品
	// Must be registered before /:id/downloads to avoid Gin param conflict
	f.GET("/:id/download", auth.RequirePermission("artifact", "read"), h.Download)
	// GET /artifacts/:id/downloads - 获取下载历史
	f.GET("/:id/downloads", auth.RequirePermission("artifact", "read"), h.GetDownloadHistory)

	// --- Search ---
	// GET /artifacts/search - 搜索制品
	// Mounted on top-level group because it contains a colon-less path segment
	rg.GET("/artifacts/search", auth.RequirePermission("artifact", "read"), h.Search)

	// --- Promote ---
	// POST /artifacts/:id/promote - 制品升级
	f.POST("/:id/promote", auth.RequirePermission("artifact", "write"), h.Promote)
	// GET /artifacts/:id/stage - 获取当前阶段
	f.GET("/:id/stage", auth.RequirePermission("artifact", "read"), h.GetStage)
	// GET /artifacts/:id/history - 获取晋升历史
	f.GET("/:id/history", auth.RequirePermission("artifact", "read"), h.GetPromotionHistory)

	// --- Deprecate / Quarantine ---
	// POST /artifacts/:id/deprecate - 废弃制品
	f.POST("/:id/deprecate", auth.RequirePermission("artifact", "write"), h.Deprecate)
	// POST /artifacts/:id/quarantine - 隔离制品
	f.POST("/:id/quarantine", auth.RequirePermission("artifact", "write"), h.Quarantine)

	// --- Stats ---
	// GET /artifacts/stats - 获取统计信息
	rg.GET("/artifacts/stats", auth.RequirePermission("artifact", "read"), h.GetStats)
	// GET /artifacts/types - 获取制品类型统计
	rg.GET("/artifacts/types", auth.RequirePermission("artifact", "read"), h.GetTypeStats)
	// GET /artifacts/namespaces - 获取命名空间列表
	rg.GET("/artifacts/namespaces", auth.RequirePermission("artifact", "read"), h.GetNamespaces)
}

// --- Core CRUD ---

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateArtifactRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondConflict(c, err.Error())
		return
	}
	middleware.RespondCreated(c, m)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.svc.List(ctx, tenantID, models.ListArtifactsQuery{
		Namespace: c.Query("namespace"),
		Name:      c.Query("name"),
		Type:      c.Query("type"),
		Status:    c.Query("status"),
		Limit:     limit,
		Offset:    offset,
	})
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, resp)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "artifact not found")
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateArtifactRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Update(ctx, tenantID, id, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Delete(ctx, tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "artifact deleted"})
}

// --- Tags ---

func (h *Handler) AddTags(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AddTags")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var body models.AddTagsRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.AddTags(ctx, tenantID, id, body.Tags); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "tags added"})
}

func (h *Handler) RemoveTags(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RemoveTags")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var body models.RemoveTagsRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.RemoveTags(ctx, tenantID, id, body.Tags); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "tags removed"})
}

func (h *Handler) GetTags(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTags")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	tags, err := h.svc.GetTags(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.ArtifactTagResponse{ArtifactID: id, Tags: tags})
}

// --- Download ---

func (h *Handler) Download(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Download")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	downloadedBy := c.GetString("user_id")
	var req models.DownloadArtifactRequest
	req.DownloadedBy = downloadedBy
	req.IPAddress = func() *string { s := c.ClientIP(); return &s }()
	req.UserAgent = func() *string { s := c.GetHeader("User-Agent"); return &s }()
	m, err := h.svc.Download(ctx, tenantID, id, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "artifact not found")
			return
		}
	middleware.RespondForbidden(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"artifact": m, "storage_path": m.StoragePath})
}

func (h *Handler) GetDownloadHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDownloadHistory")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	hist, err := h.svc.GetDownloadHistory(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, hist)
}

// --- Search ---

func (h *Handler) Search(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Search")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	query := c.Query("query")
	if query == "" {
		middleware.RespondBadRequest(c, "query is required")
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	artifacts, err := h.svc.Search(ctx, tenantID, query, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, artifacts)
}

// --- Promote ---

func (h *Handler) Promote(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Promote")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var body models.PromoteArtifactRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	// Default promotedBy to current user.
	if body.PromotedBy == "" {
		body.PromotedBy = c.GetString("user_id")
	}
	promotion, err := h.svc.Promote(ctx, tenantID, id, body)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, promotion)
}

func (h *Handler) GetStage(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStage")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	stage, err := h.svc.GetCurrentStage(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "artifact not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"stage": *stage})
}

func (h *Handler) GetPromotionHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetPromotionHistory")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	hist, err := h.svc.GetPromotionHistory(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"history": hist})
}

// --- Deprecate ---

func (h *Handler) Deprecate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Deprecate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.Deprecate(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

// --- Quarantine ---

func (h *Handler) Quarantine(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Quarantine")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var body models.QuarantineArtifactRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Quarantine(ctx, tenantID, id, body)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

// --- Stats ---

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

func (h *Handler) GetTypeStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTypeStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	types, err := h.svc.GetTypeStats(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, types)
}

func (h *Handler) GetNamespaces(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetNamespaces")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ns, err := h.svc.GetNamespaces(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, ns)
}
