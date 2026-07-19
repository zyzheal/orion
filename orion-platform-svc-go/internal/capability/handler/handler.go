package handler

import (
	"context"
	"strconv"
	"strings"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/capability/models"
	"orion/platform-svc-go/internal/capability/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

// Service defines the contract the handler needs from the service layer.
type Service interface {
	Create(ctx context.Context, tenantID string, req models.CreateCapabilityRequest) (*models.Capability, error)
	Get(ctx context.Context, tenantID, id string) (*models.Capability, error)
	List(ctx context.Context, tenantID string, limit, offset int) ([]models.Capability, error)
	Update(ctx context.Context, tenantID, id string, req models.UpdateCapabilityRequest) (*models.Capability, error)
	Delete(ctx context.Context, tenantID, id string) error
	GetTree(ctx context.Context, tenantID string) ([]models.Capability, error)
	GrantCapabilityToRole(ctx context.Context, tenantID, capabilityID, roleName, grantedBy string) error
	RevokeCapabilityFromRole(ctx context.Context, tenantID, capabilityID, roleName string) error
	GrantCapabilityToUser(ctx context.Context, tenantID, capabilityID, targetUserID, grantedBy string, expiresInHours *int) error
	RevokeCapabilityFromUser(ctx context.Context, tenantID, capabilityID, targetUserID string) error
	MapCommandToCapability(ctx context.Context, tenantID, commandName, commandAction, capabilityID, environmentSuffix string) error
	GetCapabilityForCommand(ctx context.Context, tenantID, command, action, environment string) (*string, error)
	CheckPermission(ctx context.Context, tenantID string, req models.CheckPermissionRequest) (*models.CheckPermissionResult, error)
	GrantTemporaryPermission(ctx context.Context, req models.GrantTemporaryRequest) (*models.TemporaryPermission, error)
	GetActiveTemporaryPermissions(ctx context.Context, tenantID, userID string) ([]models.TemporaryPermission, error)
	RevokeTemporaryPermission(ctx context.Context, tenantID string, id int, revokedBy string, reason string) (*models.TemporaryPermission, error)
	GetAuditLogs(ctx context.Context, tenantID string, q models.AuditLogQuery) ([]models.AuditLog, error)
	CreatePermissionRequest(ctx context.Context, tenantID, userID, capabilityID string, body models.CreatePermissionRequestBody) (*models.PermissionRequest, error)
	GetPermissionRequestByTicket(ctx context.Context, tenantID string, ticketID int) (*models.PermissionRequest, error)
	ApproveRequest(ctx context.Context, tenantID string, ticketID int, approverID string, approverRoles []string) (*models.PermissionRequest, error)
	RejectRequest(ctx context.Context, tenantID string, ticketID int, rejecterID string, reason string) (bool, error)
	CleanupExpiredTemporaryPermissions(ctx context.Context, tenantID string) (*models.CleanupResult, error)
	RequestPermission(ctx context.Context, tenantID string, body models.RequestPermissionBody) (*models.PermissionRequest, error)
	GrantSimplified(ctx context.Context, req models.GrantSimplifiedRequest) (*models.TemporaryPermission, error)
	RevokeSimplified(ctx context.Context, tenantID string, id int, revokedBy string) (*models.TemporaryPermission, error)
	GetUserEffectiveCapabilities(ctx context.Context, tenantID, userID string, roles []string) ([]string, error)
	GetUserPermissionRequests(ctx context.Context, tenantID, userID string) ([]models.PermissionRequest, error)
}

// Handler wires Gin routes to the capability service.
type Handler struct {
	svc Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all capability endpoints under the given group.
// Mirrors /api/v1/capabilities routes from the TS source (27 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/capabilities")

	// --- Core CRUD ---
	// GET /capabilities - 列出能力
	f.GET("", auth.RequirePermission("capability", "read"), h.List)
	// POST /capabilities - 创建能力
	f.POST("", auth.RequirePermission("capability", "write"), h.Create)
	// GET /capabilities/tree - 获取能力树
	f.GET("/tree", auth.RequirePermission("capability", "read"), h.GetTree)
	// GET /capabilities/:id - 获取能力详情
	f.GET("/:id", auth.RequirePermission("capability", "read"), h.Get)
	// PUT /capabilities/:id - 更新能力
	f.PUT("/:id", auth.RequirePermission("capability", "write"), h.Update)
	// DELETE /capabilities/:id - 删除能力
	f.DELETE("/:id", auth.RequirePermission("capability", "delete"), h.Delete)

	// --- Role grants ---
	// POST /capabilities/:id/roles - 分配给角色
	f.POST("/:id/roles", auth.RequirePermission("capability", "write"), h.GrantToRole)
	// DELETE /capabilities/:id/roles/:roleName - 从角色撤销
	f.DELETE("/:id/roles/:roleName", auth.RequirePermission("capability", "delete"), h.RevokeFromRole)

	// --- User grants ---
	// POST /capabilities/:id/users - 分配给用户
	f.POST("/:id/users", auth.RequirePermission("capability", "write"), h.GrantToUser)
	// DELETE /capabilities/:id/users/:userId - 从用户撤销
	f.DELETE("/:id/users/:userId", auth.RequirePermission("capability", "delete"), h.RevokeFromUser)

	// --- Command mapping ---
	// POST /capabilities/commands/mapping - 映射命令到能力
	f.POST("/commands/mapping", auth.RequirePermission("capability", "write"), h.MapCommand)
	// GET /capabilities/commands/:command/actions/:action - 获取命令需要的能力
	// Mounted on the top-level group because it has no /:id segment.
	rg.GET("/capabilities/commands/:command/actions/:action", auth.RequirePermission("capability", "read"), h.GetCapabilityForCommand)

	// --- Permission check ---
	// POST /capabilities/check
	f.POST("/check", h.CheckPermission)

	// --- Temporary permissions (legacy API) ---
	// POST /capabilities/temporary - 授予临时权限（管理员操作）
	f.POST("/temporary", auth.RequirePermission("capability", "write"), h.GrantTemporary)
	// GET /capabilities/temporary/:userId - 查询用户的活跃临时权限
	f.GET("/temporary/:userId", auth.RequirePermission("capability", "read"), h.GetActiveTemporary)
	// DELETE /capabilities/temporary/:id - 撤销临时权限
	f.DELETE("/temporary/:id", auth.RequirePermission("capability", "delete"), h.RevokeTemporary)

	// --- Permission audit ---
	// GET /capabilities/audit - 查询权限审计日志
	rg.GET("/capabilities/audit", auth.RequirePermission("capability", "read"), h.GetAuditLogs)

	// --- Permission request (legacy API) ---
	// POST /capabilities/request - 提交权限申请
	f.POST("/request", h.RequestPermission)
	// GET /capabilities/request/:ticketId - 查询权限申请详情
	f.GET("/request/:ticketId", h.GetPermissionRequest)
	// POST /capabilities/request/:ticketId/approve - 审批权限申请
	f.POST("/request/:ticketId/approve", auth.RequirePermission("capability", "write"), h.ApproveRequest)
	// POST /capabilities/request/:ticketId/reject - 拒绝权限申请
	f.POST("/request/:ticketId/reject", auth.RequirePermission("capability", "write"), h.RejectRequest)

	// --- Cleanup ---
	// POST /capabilities/cleanup - 清理过期临时权限
	f.POST("/cleanup", auth.RequirePermission("capability", "delete"), h.CleanupExpired)

	// --- Simplified permission request API ---
	// POST /capabilities/request/permission - 简化版：申请权限
	rg.POST("/capabilities/request/permission", h.RequestPermissionSimplified)
	// POST /capabilities/grant - 简化版：授予临时权限
	f.POST("/grant", auth.RequirePermission("capability", "write"), h.GrantSimplified)
	// DELETE /capabilities/grant/:id - 简化版：撤销临时权限
	f.DELETE("/grant/:id", auth.RequirePermission("capability", "delete"), h.RevokeSimplified)

	// --- Effective capabilities ---
	// GET /capabilities/user/effective - 获取用户有效能力
	f.GET("/user/effective", h.GetEffectiveCapabilities)

	// --- User permission requests ---
	// GET /capabilities/request/user/:userId - 获取用户的权限申请记录
	rg.GET("/capabilities/request/user/:userId", h.GetUserPermissionRequests)
}

// --- Core CRUD handlers ---

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateCapabilityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Create(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, m)
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.Get(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "capability not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.List(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateCapabilityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Update(c.Request.Context(), tenantID, id, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "capability deleted"})
}

// GetTree handles GET /tree.
func (h *Handler) GetTree(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	tree, err := h.svc.GetTree(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, tree)
}

// --- Role-based capability grants ---

// GrantToRole handles POST /:id/roles.
func (h *Handler) GrantToRole(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	capabilityID := c.Param("id")
	grantedBy := c.GetString("user_id")
	var body models.GrantToRoleRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.GrantCapabilityToRole(c.Request.Context(), tenantID, capabilityID, body.RoleName, grantedBy); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"message": "capability granted to role"})
}

// RevokeFromRole handles DELETE /:id/roles/:roleName.
func (h *Handler) RevokeFromRole(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	capabilityID := c.Param("id")
	roleName := c.Param("roleName")
	if err := h.svc.RevokeCapabilityFromRole(c.Request.Context(), tenantID, capabilityID, roleName); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "capability revoked from role"})
}

// --- User-based capability grants ---

// GrantToUser handles POST /:id/users.
func (h *Handler) GrantToUser(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	capabilityID := c.Param("id")
	grantedBy := c.GetString("user_id")
	var body models.GrantToUserRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.GrantCapabilityToUser(c.Request.Context(), tenantID, capabilityID, body.UserID, grantedBy, body.ExpiresInHours); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"message": "capability granted to user"})
}

// RevokeFromUser handles DELETE /:id/users/:userId.
func (h *Handler) RevokeFromUser(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	capabilityID := c.Param("id")
	targetUserID := c.Param("userId")
	if err := h.svc.RevokeCapabilityFromUser(c.Request.Context(), tenantID, capabilityID, targetUserID); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "capability revoked from user"})
}

// --- Command-to-capability mapping ---

// MapCommand handles POST /commands/mapping.
func (h *Handler) MapCommand(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body models.MapCommandRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	var envSuffix string
	if body.EnvironmentSuffix != nil {
		envSuffix = *body.EnvironmentSuffix
	}
	if err := h.svc.MapCommandToCapability(c.Request.Context(), tenantID,
		body.CommandName, body.CommandAction, body.CapabilityID,
		envSuffix); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"message": "command mapped to capability"})
}

// GetCapabilityForCommand handles GET /commands/:command/actions/:action.
func (h *Handler) GetCapabilityForCommand(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	command := c.Param("command")
	action := c.Param("action")
	environment := c.Query("environment")
	capabilityID, err := h.svc.GetCapabilityForCommand(c.Request.Context(), tenantID, command, action, environment)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.GetCapabilityForCommandResult{CapabilityID: capabilityID})
}

// --- Permission check ---

// CheckPermission handles POST /check.
func (h *Handler) CheckPermission(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body models.CheckPermissionRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	// Default to current user if userId not provided.
	if body.UserID == "" {
		body.UserID = c.GetString("user_id")
	}
	result, err := h.svc.CheckPermission(c.Request.Context(), tenantID, body)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// --- Temporary permissions (legacy API) ---

// GrantTemporary handles POST /temporary.
func (h *Handler) GrantTemporary(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body models.GrantTemporaryRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if body.TenantID == "" {
		body.TenantID = tenantID
	}
	if body.ExpiresInHours <= 0 {
		middleware.RespondBadRequest(c, "invalid duration")
		return
	}
	if body.ExpiresInHours > 720 {
		middleware.RespondBadRequest(c, "duration exceeds limit")
		return
	}
	body.GrantedBy = c.GetString("user_id")
	perm, err := h.svc.GrantTemporaryPermission(c.Request.Context(), body)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, perm)
}

// GetActiveTemporary handles GET /temporary/:userId.
func (h *Handler) GetActiveTemporary(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.Param("userId")
	perms, err := h.svc.GetActiveTemporaryPermissions(c.Request.Context(), tenantID, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, perms)
}

// RevokeTemporary handles DELETE /temporary/:id.
func (h *Handler) RevokeTemporary(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		middleware.RespondBadRequest(c, "invalid id")
		return
	}
	var body struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&body)
	revoked, err := h.svc.RevokeTemporaryPermission(c.Request.Context(), tenantID, id, c.GetString("user_id"), body.Reason)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if revoked == nil {
		middleware.RespondNotFound(c, "temporary permission not found")
		return
	}
	middleware.RespondSuccess(c, revoked)
}

// --- Permission audit ---

// GetAuditLogs handles GET /audit.
func (h *Handler) GetAuditLogs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var q models.AuditLogQuery
	if u := c.Query("user_id"); u != "" {
		q.UserID = &u
	}
	if ca := c.Query("capability_id"); ca != "" {
		q.CapabilityID = &ca
	}
	if a := c.Query("action"); a != "" {
		q.Action = &a
	}
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil {
			q.Limit = &v
		}
	}
	if o := c.Query("offset"); o != "" {
		if v, err := strconv.Atoi(o); err == nil {
			q.Offset = &v
		}
	}
	logs, err := h.svc.GetAuditLogs(c.Request.Context(), tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, logs)
}

// --- Permission request (legacy API) ---

// RequestPermission handles POST /request.
func (h *Handler) RequestPermission(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body models.CreatePermissionRequestBody
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	// Validate capability exists.
	if _, err := h.svc.Get(c.Request.Context(), tenantID, body.CapabilityID); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondBadRequest(c, "invalid capability")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	userID := c.GetString("user_id")
	if body.UserID == "" {
		body.UserID = userID
	}
	req, err := h.svc.CreatePermissionRequest(c.Request.Context(), tenantID, userID, body.CapabilityID, body)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, req)
}

// GetPermissionRequest handles GET /request/:ticketId.
func (h *Handler) GetPermissionRequest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ticketID, err := strconv.Atoi(c.Param("ticketId"))
	if err != nil {
		middleware.RespondBadRequest(c, "invalid ticket id")
		return
	}
	req, err := h.svc.GetPermissionRequestByTicket(c.Request.Context(), tenantID, ticketID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if req == nil {
		middleware.RespondNotFound(c, "permission request not found")
		return
	}
	middleware.RespondSuccess(c, req)
}

// ApproveRequest handles POST /request/:ticketId/approve.
func (h *Handler) ApproveRequest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ticketID, err := strconv.Atoi(c.Param("ticketId"))
	if err != nil {
		middleware.RespondBadRequest(c, "invalid ticket id")
		return
	}
	var body models.ApproveRequestBody
	c.ShouldBindJSON(&body)
	if body.TenantID == "" {
		body.TenantID = tenantID
	}
	result, err := h.svc.ApproveRequest(c.Request.Context(), body.TenantID, ticketID, c.GetString("user_id"), body.ApproverRoles)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// RejectRequest handles POST /request/:ticketId/reject.
func (h *Handler) RejectRequest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ticketID, err := strconv.Atoi(c.Param("ticketId"))
	if err != nil {
		middleware.RespondBadRequest(c, "invalid ticket id")
		return
	}
	var body models.RejectRequestBody
	c.ShouldBindJSON(&body)
	success, err := h.svc.RejectRequest(c.Request.Context(), tenantID, ticketID, c.GetString("user_id"), body.Reason)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": success})
}

// --- Cleanup ---

// CleanupExpired handles POST /cleanup.
func (h *Handler) CleanupExpired(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.CleanupExpiredTemporaryPermissions(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// --- Simplified permission request API ---

// RequestPermissionSimplified handles POST /capabilities/request/permission.
func (h *Handler) RequestPermissionSimplified(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body models.RequestPermissionBody
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	userID := c.GetString("user_id")
	if body.UserID == "" {
		body.UserID = userID
	}
	req, err := h.svc.RequestPermission(c.Request.Context(), tenantID, body)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, req)
}

// GrantSimplified handles POST /grant.
func (h *Handler) GrantSimplified(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body models.GrantSimplifiedRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if body.TenantID == "" {
		body.TenantID = tenantID
	}
	body.GrantorId = c.GetString("user_id")
	perm, err := h.svc.GrantSimplified(c.Request.Context(), body)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, perm)
}

// RevokeSimplified handles DELETE /grant/:id.
func (h *Handler) RevokeSimplified(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		middleware.RespondBadRequest(c, "invalid id")
		return
	}
	revoked, err := h.svc.RevokeSimplified(c.Request.Context(), tenantID, id, c.GetString("user_id"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if revoked == nil {
		middleware.RespondNotFound(c, "permission not found")
		return
	}
	middleware.RespondSuccess(c, revoked)
}

// --- Effective capabilities ---

// GetEffectiveCapabilities handles GET /user/effective.
func (h *Handler) GetEffectiveCapabilities(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.Query("user_id")
	roles := c.Query("roles")
	if userID == "" {
		userID = c.GetString("user_id")
	}
	if roles == "" {
		roles = ""
	}
	capabilities, err := h.svc.GetUserEffectiveCapabilities(c.Request.Context(), tenantID, userID, splitQuery(roles))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.UserEffectiveCapabilities{
		UserID:       userID,
		Capabilities: capabilities,
	})
}

// --- User permission requests ---

// GetUserPermissionRequests handles GET /capabilities/request/user/:userId.
func (h *Handler) GetUserPermissionRequests(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.Param("userId")
	reqs, err := h.svc.GetUserPermissionRequests(c.Request.Context(), tenantID, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, reqs)
}

// --- Helpers ---

func stringPtr(s string) string {
	return s
}

func splitQuery(roles string) []string {
	if roles == "" {
		return nil
	}
	result := make([]string, 0)
	for _, r := range strings.FieldsFunc(roles, splitComma) {
		result = append(result, r)
	}
	return result
}

func splitComma(c rune) bool {
	return c == ','
}

