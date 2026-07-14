package handler

import (
	"strconv"

	"orion/platform-svc-go/internal/session/models"
	"orion/platform-svc-go/internal/session/service"

	"github.com/gin-gonic/gin"
)

// Handler exposes HTTP endpoints for session management operations.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler instance.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all session routes onto the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	s := rg.Group("/sessions")
	s.GET("", h.List)
	s.GET("/:id", h.Get)
	s.DELETE("/:id", h.Delete)
	s.POST("/:id/logout", h.LogoutSpecific)
	s.POST("/logout", h.LogoutCurrent)
	s.POST("/logout-all", h.LogoutAll)
}

// List retrieves the current user's sessions.
func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 50
	}

	items, err := h.svc.List(c.Request.Context(), tenantID, userID, (page-1)*pageSize, pageSize)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": items, "page": page, "page_size": pageSize})
}

// Get retrieves a single session by id.
func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	session, err := h.svc.GetByID(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, session)
}

// Delete removes a session by id.
func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Logout(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "session deleted"})
}

// LogoutSpecific logs out a specific session.
func (h *Handler) LogoutSpecific(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Logout(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "session logged out"})
}

// LogoutCurrent logs out the current session.
func (h *Handler) LogoutCurrent(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.LogoutSessionRequest
	if c.ShouldBindJSON(&req) != nil {
		respondBadRequest(c, "invalid request body")
		return
	}

	// Logout all sessions for the current user to effectively log out the current session.
	_, err := h.svc.LogoutAll(c.Request.Context(), tenantID, c.GetString("user_id"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "logged out"})
}

// LogoutAll logs out all sessions for the current user.
func (h *Handler) LogoutAll(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	_, err := h.svc.LogoutAll(c.Request.Context(), tenantID, c.GetString("user_id"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "all sessions logged out"})
}
