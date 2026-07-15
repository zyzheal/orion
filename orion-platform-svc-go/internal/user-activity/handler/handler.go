package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/user-activity/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	read := auth.RequirePermission("user-activity", "read")
	write := auth.RequirePermission("user-activity", "write")
	del := auth.RequirePermission("user-activity", "delete")

	// ===== User Activity =====
	rg.GET("/users/:id/activities", read, h.GetActivities)
	rg.GET("/users/:id/activities/:activityId", read, h.GetActivity)
	rg.DELETE("/users/:id/activities/:activityId", del, h.DeleteActivity)

	_ = write
}

func (h *Handler) GetActivities(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.Param("id")
	currentUserID := c.GetString("user_id")

	// Verify ownership: the user can only access their own activities
	if userID != currentUserID && userID != tenantID {
		respondForbidden(c, "Forbidden")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	result, err := h.svc.GetActivities(c.Request.Context(), userID, page, pageSize)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{
		"data":     result.Data,
		"total":    result.Total,
		"page":     result.Page,
		"pageSize": result.PageSize,
	})
}

func (h *Handler) GetActivity(c *gin.Context) {
	_ = c.GetString("tenant_id")
	userID := c.Param("id")
	activityID := c.Param("activityId")
	currentUserID := c.GetString("user_id")

	if userID != currentUserID {
		respondForbidden(c, "Forbidden")
		return
	}

	a, err := h.svc.GetActivity(c.Request.Context(), userID, activityID)
	if err != nil {
		respondNotFound(c, "Activity "+activityID+" not found")
		return
	}
	respondSuccess(c, gin.H{"activity": a})
}

func (h *Handler) DeleteActivity(c *gin.Context) {
	_ = c.GetString("tenant_id")
	userID := c.Param("id")
	activityID := c.Param("activityId")
	currentUserID := c.GetString("user_id")

	if userID != currentUserID {
		respondForbidden(c, "Forbidden")
		return
	}

	err := h.svc.DeleteActivity(c.Request.Context(), userID, activityID)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "activity deleted"})
}

func respondForbidden(c *gin.Context, message string) {
	c.AbortWithStatusJSON(403, gin.H{
		"success": false,
		"error":   message,
	})
}
