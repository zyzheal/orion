package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/team/models"
	"orion/platform-svc-go/internal/team/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

// Service defines the contract the handler needs from the service layer.
type Service interface {
	Create(ctx context.Context, tenantID string, req models.CreateTeamRequest) (*models.Team, error)
	Get(ctx context.Context, tenantID, id string) (*models.Team, error)
	List(ctx context.Context, tenantID string, limit, offset int) ([]models.Team, error)
	Update(ctx context.Context, tenantID, id string, req models.UpdateTeamRequest) (*models.Team, error)
	Delete(ctx context.Context, tenantID, id string) (*service.DeleteResult, error)
	GetUserTeams(ctx context.Context, userID, tenantID string) ([]models.Team, error)
	GetMembers(ctx context.Context, teamID, tenantID string) ([]models.TeamMember, error)
	AddMember(ctx context.Context, teamID, userID, tenantID, role, addedBy string) error
	RemoveMember(ctx context.Context, teamID, userID, tenantID string) (bool, error)
	UpdateMemberRole(ctx context.Context, teamID, userID, tenantID, newRole string) error
	GetRoles(ctx context.Context, teamID, tenantID string) ([]models.TeamRole, error)
	AssignRole(ctx context.Context, teamID, roleName, tenantID, grantedBy string) error
	RemoveRole(ctx context.Context, teamID, roleName, tenantID string) (bool, error)
}

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// GET / - list teams (read)
	rg.GET("", auth.RequirePermission("team", "read"), h.List)
	// POST / - create team (write)
	rg.POST("", auth.RequirePermission("team", "write"), h.Create)
	// GET /my - get current user's teams (no permission check, just auth via middleware)
	rg.GET("/my", h.GetUserTeams)
	// GET /:id - get team detail (read)
	rg.GET("/:id", auth.RequirePermission("team", "read"), h.Get)
	// PUT /:id - update team (write)
	rg.PUT("/:id", auth.RequirePermission("team", "write"), h.Update)
	// DELETE /:id - delete team (write/delete)
	rg.DELETE("/:id", auth.RequirePermission("team", "delete"), h.Delete)
	// GET /:id/members - get team members (read)
	rg.GET("/:id/members", auth.RequirePermission("team", "read"), h.GetMembers)
	// POST /:id/members - add member (write)
	rg.POST("/:id/members", auth.RequirePermission("team", "write"), h.AddMember)
	// DELETE /:id/members/:userId - remove member (write/delete)
	rg.DELETE("/:id/members/:userId", auth.RequirePermission("team", "delete"), h.RemoveMember)
	// PUT /:id/members/:userId/role - update member role (write)
	rg.PUT("/:id/members/:userId/role", auth.RequirePermission("team", "write"), h.UpdateMemberRole)
	// GET /:id/roles - get team roles (read)
	rg.GET("/:id/roles", auth.RequirePermission("team", "read"), h.GetRoles)
	// POST /:id/roles - assign role (write)
	rg.POST("/:id/roles", auth.RequirePermission("team", "write"), h.AssignRole)
	// DELETE /:id/roles/:roleName - remove role (write/delete)
	rg.DELETE("/:id/roles/:roleName", auth.RequirePermission("team", "delete"), h.RemoveRole)
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

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateTeamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Create(c.Request.Context(), tenantID, req)
	if err != nil {
		// Check for known error types
		msg := err.Error()
		if msg != "" {
			// Pass through to client
		}
		middleware.RespondBadRequest(c, msg)
		return
	}
	middleware.RespondCreated(c, m)
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.Get(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "not found")
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateTeamRequest
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
	result, err := h.svc.Delete(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "deleted", "data": result})
}

func (h *Handler) GetUserTeams(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	teams, err := h.svc.GetUserTeams(c.Request.Context(), userID, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, teams)
}

func (h *Handler) GetMembers(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	teamID := c.Param("id")
	members, err := h.svc.GetMembers(c.Request.Context(), teamID, tenantID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, members)
}

func (h *Handler) AddMember(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	teamID := c.Param("id")
	var req models.AddMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	role := "member"
	if req.Role != nil {
		role = *req.Role
	}
	err := h.svc.AddMember(c.Request.Context(), teamID, req.UserID, tenantID, role, userID)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"message": "member added"})
}

func (h *Handler) RemoveMember(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	teamID := c.Param("id")
	userID := c.Param("userId")
	removed, err := h.svc.RemoveMember(c.Request.Context(), teamID, userID, tenantID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	if !removed {
		middleware.RespondNotFound(c, "member not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "member removed"})
}

func (h *Handler) UpdateMemberRole(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	teamID := c.Param("id")
	userID := c.Param("userId")
	var req models.UpdateMemberRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	err := h.svc.UpdateMemberRole(c.Request.Context(), teamID, userID, tenantID, req.Role)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "member role updated"})
}

func (h *Handler) GetRoles(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	teamID := c.Param("id")
	roles, err := h.svc.GetRoles(c.Request.Context(), teamID, tenantID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, roles)
}

func (h *Handler) AssignRole(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	teamID := c.Param("id")
	var req models.AssignRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	err := h.svc.AssignRole(c.Request.Context(), teamID, req.RoleName, tenantID, userID)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"message": "role assigned"})
}

func (h *Handler) RemoveRole(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	teamID := c.Param("id")
	roleName := c.Param("roleName")
	removed, err := h.svc.RemoveRole(c.Request.Context(), teamID, roleName, tenantID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	if !removed {
		middleware.RespondNotFound(c, "role not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "role removed"})
}
