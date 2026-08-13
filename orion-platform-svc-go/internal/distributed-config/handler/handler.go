package handler

import (
	"fmt"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/distributed-config/models"
	"orion/platform-svc-go/internal/distributed-config/service"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
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
	f.GET("/items/:id", auth.RequirePermission("config", "read"), h.GetItem)
	f.PUT("/items/:id", auth.RequirePermission("config", "write"), h.UpdateItem)
	f.DELETE("/items/:id", auth.RequirePermission("config", "delete"), h.DeleteItem)
	f.GET("/items/:id/history", auth.RequirePermission("config", "read"), h.GetItemHistory)

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
	tenantID := h.getTenantID(c)
	namespaces, err := h.svc.ListNamespaces(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, namespaces)
}

func (h *Handler) CreateNamespace(c *gin.Context) {
	var req models.CreateNamespaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	ns, err := h.svc.CreateNamespace(c.Request.Context(), &req, h.getTenantID(c))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, ns)
}

func (h *Handler) GetNamespace(c *gin.Context) {
	ns, err := h.svc.GetNamespace(c.Request.Context(), c.Param("id"), h.getTenantID(c))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, ns)
}

// --- Group ---

func (h *Handler) ListGroups(c *gin.Context) {
	f := models.GetItemsFilter{}
	c.ShouldBindQuery(&f)
	groups, err := h.svc.ListGroups(c.Request.Context(), h.getTenantID(c), f.NamespaceID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, groups)
}

func (h *Handler) CreateGroup(c *gin.Context) {
	var req models.CreateGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	g, err := h.svc.CreateGroup(c.Request.Context(), &req, h.getTenantID(c))
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, g)
}

func (h *Handler) GetGroup(c *gin.Context) {
	g, err := h.svc.GetGroup(c.Request.Context(), c.Param("id"), h.getTenantID(c))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, g)
}

// --- Item ---

func (h *Handler) ListItems(c *gin.Context) {
	f := models.GetItemsFilter{}
	c.ShouldBindQuery(&f)
	items, err := h.svc.ListItems(c.Request.Context(), h.getTenantID(c), &f)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) CreateItem(c *gin.Context) {
	var req models.CreateItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.CreateItem(c.Request.Context(), &req, h.getTenantID(c))
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, item)
}

func (h *Handler) GetItem(c *gin.Context) {
	item, err := h.svc.GetItem(c.Request.Context(), c.Param("id"), h.getTenantID(c))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, item)
}

func (h *Handler) UpdateItem(c *gin.Context) {
	var req models.UpdateItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	operator := c.GetString("user_id")
	if operator == "" {
		operator = "system"
	}
	item, err := h.svc.UpdateItem(c.Request.Context(), c.Param("id"), h.getTenantID(c), operator, &req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, item)
}

func (h *Handler) DeleteItem(c *gin.Context) {
	deleted, err := h.svc.DeleteItem(c.Request.Context(), c.Param("id"), h.getTenantID(c))
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
	history, err := h.svc.GetItemHistory(c.Request.Context(), c.Param("id"), h.getTenantID(c))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, history)
}

// --- Snapshot ---

func (h *Handler) PublishSnapshot(c *gin.Context) {
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
	snap, err := h.svc.PublishSnapshot(c.Request.Context(), groupID, req.Environment, req.Operator, h.getTenantID(c))
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, snap)
}

func (h *Handler) ListSnapshots(c *gin.Context) {
	groupID := c.Query("groupId")
	env := c.Query("environment")
	snaps, err := h.svc.ListSnapshots(c.Request.Context(), h.getTenantID(c), groupID, env)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, snaps)
}

func (h *Handler) GetSnapshotData(c *gin.Context) {
	data, err := h.svc.GetSnapshotData(c.Request.Context(), c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, data)
}

// --- Release ---

func (h *Handler) PublishRelease(c *gin.Context) {
	var req models.PublishReleaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	release, err := h.svc.PublishRelease(c.Request.Context(), &req, h.getTenantID(c))
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, release)
}

func (h *Handler) RollbackRelease(c *gin.Context) {
	var req models.RollbackReleaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	release, err := h.svc.RollbackRelease(c.Request.Context(), &req, h.getTenantID(c))
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, release)
}

func (h *Handler) GetRelease(c *gin.Context) {
	release, err := h.svc.GetRelease(c.Request.Context(), c.Param("id"), h.getTenantID(c))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, release)
}

func (h *Handler) ListReleases(c *gin.Context) {
	f := models.GetReleasesFilter{}
	c.ShouldBindQuery(&f)
	releases, err := h.svc.ListReleases(c.Request.Context(), h.getTenantID(c), &f)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, releases)
}

func (h *Handler) GetReleaseHistory(c *gin.Context) {
	history, err := h.svc.GetReleaseHistory(c.Request.Context(), c.Param("id"), h.getTenantID(c))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, history)
}

// --- Audit ---

func (h *Handler) ListAudit(c *gin.Context) {
	limit := 50
	if v := c.Query("limit"); v != "" {
		fmt.Sscanf(v, "%d", &limit)
	}
	audits, err := h.svc.ListAudit(c.Request.Context(), h.getTenantID(c), limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, audits)
}
