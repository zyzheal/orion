package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/workflow-task/models"
	"orion/platform-svc-go/internal/workflow-task/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all workflow-task endpoints under the given group.
// Mirrors /api/v1/workflow-tasks routes from the TS source (4 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/workflow-tasks")

	// GET /workflow-tasks - List tasks (query: assigneeId, status, page, pageSize)
	f.GET("", auth.RequirePermission("workflow", "read"), h.ListTasks)
	// GET /workflow-tasks/:id - Get task detail
	f.GET("/:id", auth.RequirePermission("workflow", "read"), h.GetTask)
	// POST /workflow-tasks/:id/claim - Claim task
	f.POST("/:id/claim", auth.RequirePermission("workflow", "write"), h.ClaimTask)
	// POST /workflow-tasks/:id/complete - Complete task
	f.POST("/:id/complete", auth.RequirePermission("workflow", "write"), h.CompleteTask)
}

// getTenantID extracts tenant_id from Gin context, falling back to a zero UUID.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

// ListTasks handler - GET /workflow-tasks
func (h *Handler) ListTasks(c *gin.Context) {
	tenantID := h.getTenantID(c)

	filter := &models.ListFilter{}

	if assigneeID := c.Query("assigneeId"); assigneeID != "" {
		filter.AssigneeID = &assigneeID
	}
	if status := c.Query("status"); status != "" {
		filter.Status = &status
	}
	if pageStr := c.Query("page"); pageStr != "" {
		if page, err := strconv.Atoi(pageStr); err == nil && page > 0 {
			filter.Page = page
		}
	}
	if pageSizeStr := c.Query("pageSize"); pageSizeStr != "" {
		if pageSize, err := strconv.Atoi(pageSizeStr); err == nil && pageSize > 0 {
			filter.PageSize = pageSize
		}
	}

	tasks, total, err := h.svc.ListTasks(c.Request.Context(), tenantID, filter)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	page := filter.Page
	if page == 0 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize == 0 {
		pageSize = 20
	}

	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:     tasks,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

// GetTask handler - GET /workflow-tasks/:id
func (h *Handler) GetTask(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	task, err := h.svc.GetTask(c.Request.Context(), id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "workflow task not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, task)
}

// ClaimTask handler - POST /workflow-tasks/:id/claim
func (h *Handler) ClaimTask(c *gin.Context) {
	id := c.Param("id")
	var req models.ClaimTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	tenantID := h.getTenantID(c)
	// Use the authenticated user as the assignee
	assigneeID := c.GetString("user_id")
	if assigneeID == "" {
		middleware.RespondBadRequest(c, "user_id not found in context")
		return
	}

	task, err := h.svc.Claim(c.Request.Context(), id, tenantID, assigneeID, req.Comment)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "workflow task not found")
			return
		}
		if err == service.ErrTaskInvalidStatus {
			middleware.RespondBadRequest(c, "task is not in pending status")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, task)
}

// CompleteTask handler - POST /workflow-tasks/:id/complete
func (h *Handler) CompleteTask(c *gin.Context) {
	id := c.Param("id")
	var req models.CompleteTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	tenantID := h.getTenantID(c)
	task, err := h.svc.Complete(c.Request.Context(), id, tenantID, req.Comment, req.FormData)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "workflow task not found")
			return
		}
		if err == service.ErrTaskAlreadyCompleted {
			middleware.RespondBadRequest(c, "task is already completed")
			return
		}
		if err == service.ErrTaskCancelled {
			middleware.RespondBadRequest(c, "task has been cancelled")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, task)
}
