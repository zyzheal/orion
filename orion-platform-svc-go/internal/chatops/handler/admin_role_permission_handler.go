package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/chatops/models"
	"orion/platform-svc-go/internal/chatops/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel/trace"
)

func (h *Handler) GetAllRoles(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAllRoles")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	roles, err := h.svc.GetAllRoles(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": roles})
}

func (h *Handler) CreateRole(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateRole")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Name == "" {
		middleware.RespondBadRequest(c, "name is required")
		return
	}
	role, err := h.svc.CreateRole(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"data": role})
}

func (h *Handler) UpdateRole(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateRole")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	role, err := h.svc.UpdateRole(ctx, tenantID, id, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "role not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": role})
}

func (h *Handler) DeleteRole(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteRole")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteRole(ctx, tenantID, id); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "role not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

// ---- Admin: Command Permissions ----

func (h *Handler) GetAllCommandPermissions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAllCommandPermissions")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	perms, err := h.svc.GetAllCommandPermissions(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": perms})
}

func (h *Handler) CreateCommandPermission(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateCommandPermission")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateCommandPermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Command == "" || req.Capability == "" {
		middleware.RespondBadRequest(c, "command and capability are required")
		return
	}
	perm, err := h.svc.CreateCommandPermission(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"data": perm})
}

func (h *Handler) UpdateCommandPermission(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateCommandPermission")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateCommandPermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	perm, err := h.svc.UpdateCommandPermission(ctx, tenantID, id, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "command permission not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": perm})
}

func (h *Handler) DeleteCommandPermission(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteCommandPermission")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteCommandPermission(ctx, tenantID, id); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "command permission not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

// ---- Admin: Environment Permissions ----

func (h *Handler) GetAllEnvironmentPermissions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAllEnvironmentPermissions")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	perms, err := h.svc.GetAllEnvironmentPermissions(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": perms})
}

func (h *Handler) CreateEnvironmentPermission(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateEnvironmentPermission")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateEnvironmentPermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Environment == "" {
		middleware.RespondBadRequest(c, "environment is required")
		return
	}
	perm, err := h.svc.CreateEnvironmentPermission(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"data": perm})
}

func (h *Handler) UpdateEnvironmentPermission(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateEnvironmentPermission")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateEnvironmentPermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	perm, err := h.svc.UpdateEnvironmentPermission(ctx, tenantID, id, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "environment permission not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": perm})
}

func (h *Handler) DeleteEnvironmentPermission(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteEnvironmentPermission")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	_id := c.Param("id")
	if err := h.svc.DeleteEnvironmentPermission(ctx, tenantID, _id); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "environment permission not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

// ---- Admin: Command Versions ----

func (h *Handler) GetAllCommandVersions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAllCommandVersions")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	perPage, _ := strconv.Atoi(c.DefaultQuery("perPage", "20"))
	result, err := h.svc.GetAllCommandVersions(ctx, tenantID, 1, perPage)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result.Versions, "total": result.Total})
}

func (h *Handler) GetVersionsByCommand(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetVersionsByCommand")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	commandID := c.Param("commandId")
	versions, err := h.svc.GetVersionsByCommand(ctx, tenantID, commandID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": versions})
}

func (h *Handler) CreateCommandVersion(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateCommandVersion")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateCommandVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.CommandID == "" || req.CommandText == "" {
		middleware.RespondBadRequest(c, "command_id and command_text are required")
		return
	}
	req.CreatedBy = c.GetString("user_id")
	version, err := h.svc.CreateCommandVersion(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"data": version})
}

func (h *Handler) RollbackCommandVersion(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RollbackCommandVersion")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	commandID := c.Param("commandId")
	version, err := strconv.Atoi(c.Param("version"))
	if err != nil {
		middleware.RespondBadRequest(c, "invalid version")
		return
	}
	// Get all versions and find the target
	versions, err := h.svc.GetVersionsByCommand(ctx, tenantID, commandID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if version <= 0 || version > len(versions) {
		middleware.RespondNotFound(c, "version not found")
		return
	}
	target := versions[version-1]
	// Create a new version from the rollback target
	req := models.CreateCommandVersionRequest{
		CommandID:   target.CommandID,
		CommandText: target.CommandText,
		Description: "rollback from version " + strconv.Itoa(version),
		Changelog:   "rollback to version " + strconv.Itoa(version),
		CreatedBy:   c.GetString("user_id"),
	}
	newVersion, err := h.svc.CreateCommandVersion(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": newVersion})
}

func (h *Handler) AddVersionTag(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AddVersionTag")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	versionID := c.Param("versionId")
	var req models.AddTagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.TagName == "" {
		middleware.RespondBadRequest(c, "tag_name is required")
		return
	}
	if err := h.svc.AddTag(ctx, tenantID, versionID, req.TagName, c.GetString("user_id")); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

func (h *Handler) RemoveVersionTag(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RemoveVersionTag")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	versionID := c.Param("versionId")
	tagName := c.Param("tagName")
	if err := h.svc.RemoveTag(ctx, tenantID, versionID, tagName); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

func (h *Handler) DeleteCommandVersion(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteCommandVersion")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteCommandVersion(ctx, tenantID, id); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "version not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

// ---- Admin: Rate Limits ----


