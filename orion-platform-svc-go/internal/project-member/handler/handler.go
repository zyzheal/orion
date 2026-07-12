package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/project-member/models"
	"orion/platform-svc-go/internal/project-member/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers the project-member endpoints.
// Mirrors TS routes at /api/v1/project-members with prefix /project-members.
//
// GET    /:projectId           — list project members (project:read)
// POST   /:projectId           — add a member (project:write)
// DELETE /:projectId/:userId   — remove a member (project:delete)
// GET    /:projectId/check/:userId — check membership (project:read)
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/project-members")

	// GET /:projectId/check/:userId — must be registered before /:projectId/*
	// to avoid conflict with the variadic catch-all; Gin requires more specific
	// routes first, but ":projectId/check/:userId" is a concrete pattern so
	// Gin resolves it correctly regardless of order. Register first for clarity.
	f.GET("/:projectId/check/:userId", auth.RequirePermission("project", "read"), h.Check)
	// GET  /:projectId — list members
	f.GET("/:projectId", auth.RequirePermission("project", "read"), h.List)
	// POST /:projectId — add member
	f.POST("/:projectId", auth.RequirePermission("project", "write"), h.Add)
	// DELETE /:projectId/:userId — remove member
	f.DELETE("/:projectId/:userId", auth.RequirePermission("project", "delete"), h.Remove)
}

// List returns all members of a project.
// GET /api/v1/project-members/:projectId
func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	projectID := c.Param("projectId")
	members, err := h.svc.GetProjectMembers(c.Request.Context(), tenantID, projectID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": members, "total": len(members)})
}

// Add adds a user to a project with the given role.
// POST /api/v1/project-members/:projectId
func (h *Handler) Add(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	projectID := c.Param("projectId")
	var req models.AddMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	created, err := h.svc.AddProjectMember(c.Request.Context(), tenantID, projectID, req.UserID, req.Role)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if !created {
		respondSuccess(c, gin.H{"message": "Member already exists", "user_id": req.UserID, "role": req.Role})
		return
	}
	respondCreated(c, gin.H{"message": "Member added", "user_id": req.UserID, "role": req.Role})
}

// Remove removes a user from a project.
// DELETE /api/v1/project-members/:projectId/:userId
func (h *Handler) Remove(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	projectID := c.Param("projectId")
	userID := c.Param("userId")
	if err := h.svc.RemoveProjectMember(c.Request.Context(), tenantID, projectID, userID); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "Member removed"})
}

// Check verifies whether a user is a member of a project.
// GET /api/v1/project-members/:projectId/check/:userId
func (h *Handler) Check(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	projectID := c.Param("projectId")
	userID := c.Param("userId")
	isMember, err := h.svc.IsProjectMember(c.Request.Context(), tenantID, projectID, userID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"isMember": isMember})
}
