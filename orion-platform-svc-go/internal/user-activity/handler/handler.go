package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/user-activity/service"

	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetActivities")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.Param("id")
	currentUserID := c.GetString("user_id")

	// Verify ownership: the user can only access their own activities
	if userID != currentUserID && userID != tenantID {
		middleware.RespondForbidden(c, "Forbidden")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	result, err := h.svc.GetActivities(ctx, userID, page, pageSize)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"data":     result.Data,
		"total":    result.Total,
		"page":     result.Page,
		"pageSize": result.PageSize,
	})
}

func (h *Handler) GetActivity(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetActivity")
	defer span.End()
	_ = c.GetString("tenant_id")
	userID := c.Param("id")
	activityID := c.Param("activityId")
	currentUserID := c.GetString("user_id")

	if userID != currentUserID {
		middleware.RespondForbidden(c, "Forbidden")
		return
	}

	a, err := h.svc.GetActivity(ctx, userID, activityID)
	if err != nil {
		middleware.RespondNotFound(c, "Activity "+activityID+" not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"activity": a})
}

func (h *Handler) DeleteActivity(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteActivity")
	defer span.End()
	_ = c.GetString("tenant_id")
	userID := c.Param("id")
	activityID := c.Param("activityId")
	currentUserID := c.GetString("user_id")

	if userID != currentUserID {
		middleware.RespondForbidden(c, "Forbidden")
		return
	}

	err := h.svc.DeleteActivity(ctx, userID, activityID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "activity deleted"})
}
