package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/scheduled-notification/models"
	"orion/platform-svc-go/internal/scheduled-notification/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all scheduled-notification endpoints under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/scheduled-notifications")

	// GET /scheduled-notifications - List scheduled notifications
	f.GET("", auth.RequirePermission("notification", "read"), h.List)
	// POST /scheduled-notifications - Create scheduled notification
	f.POST("", auth.RequirePermission("notification", "write"), h.Create)
	// GET /scheduled-notifications/count - Get count of scheduled notifications
	f.GET("/count", auth.RequirePermission("notification", "read"), h.Count)
	// GET /scheduled-notifications/:id - Get scheduled notification by ID
	f.GET("/:id", auth.RequirePermission("notification", "read"), h.Get)
	// PUT /scheduled-notifications/:id - Update scheduled notification
	f.PUT("/:id", auth.RequirePermission("notification", "write"), h.Update)
	// DELETE /scheduled-notifications/:id - Delete scheduled notification
	f.DELETE("/:id", auth.RequirePermission("notification", "delete"), h.Delete)
	// POST /scheduled-notifications/:id/execute - Execute a scheduled notification
	f.POST("/:id/execute", auth.RequirePermission("notification", "write"), h.Execute)
	// POST /scheduled-notifications/:id/pause - Pause a scheduled notification
	f.POST("/:id/pause", auth.RequirePermission("notification", "write"), h.Pause)
	// POST /scheduled-notifications/:id/resume - Resume a scheduled notification
	f.POST("/:id/resume", auth.RequirePermission("notification", "write"), h.Resume)
	// GET /scheduled-notifications/:id/logs - Get execution logs for a scheduled notification
	f.GET("/:id/logs", auth.RequirePermission("notification", "read"), h.GetLogs)
}

// getTenantID extracts tenant_id from Gin context, falling back to a zero UUID.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

func (h *Handler) getUserID(c *gin.Context) string {
	userID := c.GetString("user_id")
	return userID
}

// getPagination extracts page and pageSize from query parameters.
func (h *Handler) getPagination(c *gin.Context) (int, int) {
	page := 1
	pageSize := 20
	if p, err := strconv.Atoi(c.Query("page")); err == nil && p > 0 {
		page = p
	}
	if ps, err := strconv.Atoi(c.Query("pageSize")); err == nil && ps > 0 {
		pageSize = ps
	}
	return page, pageSize
}

// --- Handlers ---

func (h *Handler) List(c *gin.Context) {
	tenantID := h.getTenantID(c)
	page, pageSize := h.getPagination(c)

	filter := &models.ListFilter{}
	if ch := c.Query("channel"); ch != "" {
		filter.Channel = &ch
	}
	if st := c.Query("status"); st != "" {
		filter.Status = &st
	}
	if en := c.Query("enabled"); en != "" {
		enabled := en == "true"
		filter.Enabled = &enabled
	}

	schedules, total, err := h.svc.List(c.Request.Context(), tenantID, filter, page, pageSize)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, models.PaginatedResponse{
		Data:     schedules,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

func (h *Handler) Create(c *gin.Context) {
	var req models.CreateScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	userID := h.getUserID(c)
	schedule, err := h.svc.Create(c.Request.Context(), tenantID, userID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, schedule)
}

func (h *Handler) Get(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	schedule, err := h.svc.Get(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "scheduled notification not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, schedule)
}

func (h *Handler) Update(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	schedule, err := h.svc.Update(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "scheduled notification not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, schedule)
}

func (h *Handler) Delete(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.Delete(c.Request.Context(), tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if !deleted {
		respondNotFound(c, "scheduled notification not found")
		return
	}
	respondSuccess(c, gin.H{"message": "scheduled notification deleted"})
}

func (h *Handler) Count(c *gin.Context) {
	tenantID := h.getTenantID(c)
	total, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"total": total})
}

func (h *Handler) Execute(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	err := h.svc.Execute(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "scheduled notification not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "scheduled notification executed"})
}

func (h *Handler) Pause(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	schedule, err := h.svc.Pause(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "scheduled notification not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, schedule)
}

func (h *Handler) Resume(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	schedule, err := h.svc.Resume(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "scheduled notification not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, schedule)
}

func (h *Handler) GetLogs(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	logs, err := h.svc.GetLogs(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "scheduled notification not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, logs)
}