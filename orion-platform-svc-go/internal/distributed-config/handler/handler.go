package handler

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/distributed-config/models"
	"orion/platform-svc-go/internal/distributed-config/service"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct {
	svc service.ServiceInterface
}

func NewHandler(svc service.ServiceInterface) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/config")

	// Namespace
	f.GET("/namespaces", auth.RequirePermission("config", "read"), h.ListNamespaces)
	f.POST("/namespaces", auth.RequirePermission("config", "write"), h.CreateNamespace)
	f.GET("/namespaces/:id", auth.RequirePermission("config", "read"), h.GetNamespace)

	// Group
	f.GET("/groups", auth.RequirePermission("config", "read"), h.ListGroups)
	f.POST("/groups", auth.RequirePermission("config", "write"), h.CreateGroup)
	f.GET("/groups/:id", auth.RequirePermission("config", "read"), h.GetGroup)

	// Item
	f.GET("/items", auth.RequirePermission("config", "read"), h.ListItems)
	f.POST("/items", auth.RequirePermission("config", "write"), h.CreateItem)
	// Phase 302: 生效值（三层 Level 合并后的实际生效配置）
	f.GET("/items/effective", auth.RequirePermission("config", "read"), h.ResolveEffectiveConfig)
	f.GET("/items/:id", auth.RequirePermission("config", "read"), h.GetItem)
	f.PUT("/items/:id", auth.RequirePermission("config", "write"), h.UpdateItem)
	f.DELETE("/items/:id", auth.RequirePermission("config", "delete"), h.DeleteItem)
	f.GET("/items/:id/history", auth.RequirePermission("config", "read"), h.GetItemHistory)
	// Phase 302: 列出被下层覆盖的 item
	f.GET("/items/:id/overrides", auth.RequirePermission("config", "read"), h.ListOverrides)

	// Snapshot
	f.POST("/snapshots", auth.RequirePermission("config", "write"), h.PublishSnapshot)
	f.GET("/snapshots", auth.RequirePermission("config", "read"), h.ListSnapshots)
	f.GET("/snapshots/:id/data", auth.RequirePermission("config", "read"), h.GetSnapshotData)

	// Release
	f.POST("/releases", auth.RequirePermission("config", "write"), h.PublishRelease)
	f.POST("/releases/rollback", auth.RequirePermission("config", "delete"), h.RollbackRelease)
	f.GET("/releases", auth.RequirePermission("config", "read"), h.ListReleases)
	f.GET("/releases/:id", auth.RequirePermission("config", "read"), h.GetRelease)
	f.GET("/releases/:id/history", auth.RequirePermission("config", "read"), h.GetReleaseHistory)

	// Audit
	f.GET("/audit", auth.RequirePermission("config", "read"), h.ListAudit)
}

func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return ""
	}
	return tenantID
}

// --- Namespace ---

func (h *Handler) ListNamespaces(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DistributedConfigListNamespaces")
	defer span.End()
	tenantID := h.getTenantID(c)
	namespaces, err := h.svc.ListNamespaces(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, namespaces)
}

func (h *Handler) CreateNamespace(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DistributedConfigCreateNamespace")
	defer span.End()
	var req models.CreateNamespaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	ns, err := h.svc.CreateNamespace(ctx, &req, h.getTenantID(c))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, ns)
}

func (h *Handler) GetNamespace(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DistributedConfigGetNamespace")
	defer span.End()
	ns, err := h.svc.GetNamespace(ctx, c.Param("id"), h.getTenantID(c))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, ns)
}

// --- Group ---

func (h *Handler) ListGroups(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DistributedConfigListGroups")
	defer span.End()
	f := models.GetItemsFilter{}
	c.ShouldBindQuery(&f)
	groups, err := h.svc.ListGroups(ctx, h.getTenantID(c), f.NamespaceID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, groups)
}

func (h *Handler) CreateGroup(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DistributedConfigCreateGroup")
	defer span.End()
	var req models.CreateGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	g, err := h.svc.CreateGroup(ctx, &req, h.getTenantID(c))
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, g)
}

func (h *Handler) GetGroup(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DistributedConfigGetGroup")
	defer span.End()
	g, err := h.svc.GetGroup(ctx, c.Param("id"), h.getTenantID(c))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, g)
}

// --- Item ---

func (h *Handler) ListItems(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DistributedConfigListItems")
	defer span.End()
	f := models.GetItemsFilter{}
	c.ShouldBindQuery(&f)
	items, err := h.svc.ListItems(ctx, h.getTenantID(c), &f)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) CreateItem(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DistributedConfigCreateItem")
	defer span.End()
	var req models.CreateItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.CreateItem(ctx, &req, h.getTenantID(c))
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, item)
}

func (h *Handler) GetItem(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DistributedConfigGetItem")
	defer span.End()
	item, err := h.svc.GetItem(ctx, c.Param("id"), h.getTenantID(c))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, item)
}

func (h *Handler) UpdateItem(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DistributedConfigUpdateItem")
	defer span.End()
	var req models.UpdateItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	operator := c.GetString("user_id")
	if operator == "" {
		operator = "system"
	}
	item, err := h.svc.UpdateItem(ctx, c.Param("id"), h.getTenantID(c), operator, &req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, item)
}

func (h *Handler) DeleteItem(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DistributedConfigDeleteItem")
	defer span.End()
	deleted, err := h.svc.DeleteItem(ctx, c.Param("id"), h.getTenantID(c))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "item not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"deleted": true})
}

func (h *Handler) GetItemHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DistributedConfigGetItemHistory")
	defer span.End()
	history, err := h.svc.GetItemHistory(ctx, c.Param("id"), h.getTenantID(c))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, history)
}

// --- Phase 302: 三层 Level 覆盖 ---

// ResolveEffectiveConfig 返回按 Level 优先级合并后的实际生效配置。
// Query 参数：namespaceId（可选）、userId（可选，保留扩展）
func (h *Handler) ResolveEffectiveConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DistributedConfigResolveEffectiveConfig")
	defer span.End()
	namespaceID := c.Query("namespaceId")
	userID := c.Query("userId")
	result, err := h.svc.ResolveEffectiveConfig(ctx, h.getTenantID(c), namespaceID, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// ListOverrides 返回所有下层覆盖某个 item 的 records（override_of = itemID）。
func (h *Handler) ListOverrides(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DistributedConfigListOverrides")
	defer span.End()
	items, err := h.svc.ListOverrides(ctx, h.getTenantID(c), c.Param("id"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

// --- Snapshot ---

func (h *Handler) PublishSnapshot(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DistributedConfigPublishSnapshot")
	defer span.End()
	var req models.PublishSnapshotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	groupID := c.Query("groupId")
	if groupID == "" {
		middleware.RespondBadRequest(c, "groupId is required")
		return
	}
	snap, err := h.svc.PublishSnapshot(ctx, groupID, req.Environment, req.Operator, h.getTenantID(c))
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, snap)
}

func (h *Handler) ListSnapshots(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DistributedConfigListSnapshots")
	defer span.End()
	groupID := c.Query("groupId")
	env := c.Query("environment")
	snaps, err := h.svc.ListSnapshots(ctx, h.getTenantID(c), groupID, env)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, snaps)
}

func (h *Handler) GetSnapshotData(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DistributedConfigGetSnapshotData")
	defer span.End()
	data, err := h.svc.GetSnapshotData(ctx, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, data)
}

// --- Release ---

func (h *Handler) PublishRelease(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DistributedConfigPublishRelease")
	defer span.End()
	var req models.PublishReleaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	release, err := h.svc.PublishRelease(ctx, &req, h.getTenantID(c))
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, release)
}

func (h *Handler) RollbackRelease(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DistributedConfigRollbackRelease")
	defer span.End()
	var req models.RollbackReleaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	release, err := h.svc.RollbackRelease(ctx, &req, h.getTenantID(c))
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, release)
}

func (h *Handler) GetRelease(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DistributedConfigGetRelease")
	defer span.End()
	release, err := h.svc.GetRelease(ctx, c.Param("id"), h.getTenantID(c))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, release)
}

func (h *Handler) ListReleases(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DistributedConfigListReleases")
	defer span.End()
	f := models.GetReleasesFilter{}
	c.ShouldBindQuery(&f)
	releases, err := h.svc.ListReleases(ctx, h.getTenantID(c), &f)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, releases)
}

func (h *Handler) GetReleaseHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DistributedConfigGetReleaseHistory")
	defer span.End()
	history, err := h.svc.GetReleaseHistory(ctx, c.Param("id"), h.getTenantID(c))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, history)
}

// --- Audit ---

func (h *Handler) ListAudit(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DistributedConfigListAudit")
	defer span.End()
	limit := 50
	if v := c.Query("limit"); v != "" {
		fmt.Sscanf(v, "%d", &limit)
	}
	audits, err := h.svc.ListAudit(ctx, h.getTenantID(c), limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, audits)
}
