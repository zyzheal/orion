package handler

import (
	"orion/platform-svc-go/internal/chatops/models"
	"orion/platform-svc-go/internal/chatops/service"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// AdminHandler manages chatops admin endpoints.
type AdminHandler struct {
	svc *service.AdminService
}

// NewAdminHandler creates a new AdminHandler.
func NewAdminHandler(svc *service.AdminService) *AdminHandler {
	return &AdminHandler{svc: svc}
}

// ==================== Capability Mappings ====================

func (h *AdminHandler) CreateCapabilityMapping(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateCapabilityMappingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.CreateCapabilityMapping(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, m)
}

func (h *AdminHandler) ListCapabilityMappings(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListCapabilityMappings(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *AdminHandler) UpdateCapabilityMapping(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateCapabilityMappingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.UpdateCapabilityMapping(c.Request.Context(), tenantID, c.Param("id"), req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, m)
}

func (h *AdminHandler) DeleteCapabilityMapping(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteCapabilityMapping(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

// ==================== Approval Configs ====================

func (h *AdminHandler) GetApprovalConfigs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	configs, err := h.svc.GetApprovalConfigs(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, configs)
}

func (h *AdminHandler) BulkUpdateApprovalConfigs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var reqs []models.UpdateApprovalConfigRequest
	if err := c.ShouldBindJSON(&reqs); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	configs, err := h.svc.BulkUpdateApprovalConfigs(c.Request.Context(), tenantID, reqs)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, configs)
}

func (h *AdminHandler) GetApprovalConfigByCapability(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	cfg, err := h.svc.GetApprovalConfigByCapability(c.Request.Context(), tenantID, c.Param("capability"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, cfg)
}

func (h *AdminHandler) UpdateApprovalConfigByCapability(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateApprovalConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	cfg, err := h.svc.UpdateApprovalConfigByCapability(c.Request.Context(), tenantID, c.Param("capability"), req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, cfg)
}

// ==================== Approvers ====================

func (h *AdminHandler) ListApprovers(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	approvers, err := h.svc.ListApprovers(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, approvers)
}

func (h *AdminHandler) GetApproverSchedule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	schedule, err := h.svc.GetApproverSchedule(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, schedule)
}

func (h *AdminHandler) UpdateApproverSchedule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var reqs []models.UpdateApproverScheduleRequest
	if err := c.ShouldBindJSON(&reqs); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	schedule, err := h.svc.UpdateApproverSchedule(c.Request.Context(), tenantID, reqs)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, schedule)
}

// ==================== Approval Global Config ====================

func (h *AdminHandler) GetApprovalGlobalConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	cfg, err := h.svc.GetApprovalGlobalConfig(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, cfg)
}

func (h *AdminHandler) UpdateApprovalGlobalConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateApprovalGlobalConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	cfg, err := h.svc.UpdateApprovalGlobalConfig(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, cfg)
}

// ==================== Roles ====================

func (h *AdminHandler) CreateRole(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateAdminRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	role, err := h.svc.CreateRole(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, role)
}

func (h *AdminHandler) ListRoles(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	roles, err := h.svc.ListRoles(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, roles)
}

func (h *AdminHandler) UpdateRole(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateAdminRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	role, err := h.svc.UpdateRole(c.Request.Context(), tenantID, c.Param("id"), req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, role)
}

func (h *AdminHandler) DeleteRole(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteRole(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

// ==================== Command Permissions ====================

func (h *AdminHandler) CreateCommandPermission(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateCommandPermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	p, err := h.svc.CreateCommandPermission(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, p)
}

func (h *AdminHandler) ListCommandPermissions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	perms, err := h.svc.ListCommandPermissions(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, perms)
}

func (h *AdminHandler) UpdateCommandPermission(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateCommandPermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	p, err := h.svc.UpdateCommandPermission(c.Request.Context(), tenantID, c.Param("id"), req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, p)
}

func (h *AdminHandler) DeleteCommandPermission(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteCommandPermission(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

// ==================== Environment Permissions ====================

func (h *AdminHandler) CreateEnvironmentPermission(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateEnvironmentPermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	p, err := h.svc.CreateEnvironmentPermission(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, p)
}

func (h *AdminHandler) ListEnvironmentPermissions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	perms, err := h.svc.ListEnvironmentPermissions(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, perms)
}

func (h *AdminHandler) UpdateEnvironmentPermission(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateEnvironmentPermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	p, err := h.svc.UpdateEnvironmentPermission(c.Request.Context(), tenantID, c.Param("id"), req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, p)
}

func (h *AdminHandler) DeleteEnvironmentPermission(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteEnvironmentPermission(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

// ==================== Command Versions ====================

func (h *AdminHandler) ListCommandVersions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	versions, err := h.svc.ListCommandVersions(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, versions)
}

func (h *AdminHandler) ListCommandVersionsByCommand(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	versions, err := h.svc.ListCommandVersionsByCommand(c.Request.Context(), tenantID, c.Param("commandId"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, versions)
}

func (h *AdminHandler) CreateCommandVersion(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateCommandVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	ver, err := h.svc.CreateCommandVersion(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, ver)
}

func (h *AdminHandler) RollbackCommandVersion(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ver, err := h.svc.RollbackCommandVersion(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, ver)
}

func (h *AdminHandler) AddCommandVersionTag(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.AddCommandVersionTagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	ver, err := h.svc.AddCommandVersionTag(c.Request.Context(), tenantID, c.Param("id"), req.Tag)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, ver)
}

func (h *AdminHandler) DeleteCommandVersionTag(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteCommandVersionTag(c.Request.Context(), tenantID, c.Param("id"), c.Param("tag")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "tag deleted"})
}

func (h *AdminHandler) DeleteCommandVersion(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteCommandVersion(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

// RegisterRoutes registers all admin routes with the gin router group.
func (h *AdminHandler) RegisterRoutes(rg *gin.RouterGroup) {
	admin := rg.Group("/admin")
	admin.Use(auth.RequirePermission("chatops", "admin"))
	{
		// Capability Mappings
		cm := admin.Group("/capability-mappings")
		{
			cm.POST("", h.CreateCapabilityMapping)
			cm.GET("", h.ListCapabilityMappings)
			cm.PUT("/:id", h.UpdateCapabilityMapping)
			cm.DELETE("/:id", h.DeleteCapabilityMapping)
		}

		// Approval Configs
		ac := admin.Group("/approval-configs")
		{
			ac.GET("", h.GetApprovalConfigs)
			ac.PUT("", h.BulkUpdateApprovalConfigs)
			ac.GET("/:capability", h.GetApprovalConfigByCapability)
			ac.PUT("/:capability", h.UpdateApprovalConfigByCapability)
		}

		// Approvers
		ap := admin.Group("/approvers")
		{
			ap.GET("", h.ListApprovers)
			ap.GET("/schedule", h.GetApproverSchedule)
			ap.PUT("/schedule", h.UpdateApproverSchedule)
		}

		// Approval Global Config
		agc := admin.Group("/approval-global-config")
		{
			agc.GET("", h.GetApprovalGlobalConfig)
			agc.PUT("", h.UpdateApprovalGlobalConfig)
		}

		// Roles
		roles := admin.Group("/roles")
		{
			roles.POST("", h.CreateRole)
			roles.GET("", h.ListRoles)
			roles.PUT("/:id", h.UpdateRole)
			roles.DELETE("/:id", h.DeleteRole)
		}

		// Command Permissions
		cp := admin.Group("/command-permissions")
		{
			cp.POST("", h.CreateCommandPermission)
			cp.GET("", h.ListCommandPermissions)
			cp.PUT("/:id", h.UpdateCommandPermission)
			cp.DELETE("/:id", h.DeleteCommandPermission)
		}

		// Environment Permissions
		ep := admin.Group("/environment-permissions")
		{
			ep.POST("", h.CreateEnvironmentPermission)
			ep.GET("", h.ListEnvironmentPermissions)
			ep.PUT("/:id", h.UpdateEnvironmentPermission)
			ep.DELETE("/:id", h.DeleteEnvironmentPermission)
		}

		// Command Versions
		cv := admin.Group("/command-versions")
		{
			cv.GET("", h.ListCommandVersions)
			cv.GET("/by-command/:commandId", h.ListCommandVersionsByCommand)
			cv.POST("", h.CreateCommandVersion)
			cv.POST("/:id/rollback", h.RollbackCommandVersion)
			cv.POST("/:id/tags", h.AddCommandVersionTag)
			cv.DELETE("/:id/tags/:tag", h.DeleteCommandVersionTag)
			cv.DELETE("/:id", h.DeleteCommandVersion)
		}
	}
}