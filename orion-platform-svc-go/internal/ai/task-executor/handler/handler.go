package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/ai/task-executor/models"
	"orion/platform-svc-go/internal/ai/task-executor/service"
)

type TaskExecutorHandler struct {
	svc *service.TaskExecutorService
}

func NewTaskExecutorHandler(svc *service.TaskExecutorService) *TaskExecutorHandler {
	return &TaskExecutorHandler{svc: svc}
}

func (h *TaskExecutorHandler) GetTenantID(c *gin.Context) string {
	return c.GetString("tenantId")
}

// RegisterRoutes registers task-executor routes.
func (h *TaskExecutorHandler) RegisterRoutes(rg *gin.RouterGroup) {
	tasks := rg.Group("/task-executor/tasks")
	tasks.GET("", auth.RequirePermission("ai", "read"), h.ListTasks)
	tasks.POST("", auth.RequirePermission("ai", "write"), h.CreateTask)
	tasks.GET("/:id", auth.RequirePermission("ai", "read"), h.GetTask)
	tasks.POST("/:id/execute", auth.RequirePermission("ai", "execute"), h.ExecuteTask)
	tasks.POST("/:id/cancel", auth.RequirePermission("ai", "execute"), h.CancelTask)
}

// ListTasks returns paginated tasks.
func (h *TaskExecutorHandler) ListTasks(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AITaskExecListTasks")
	defer span.End()
	tenantID := h.GetTenantID(c)
	status := c.Query("status")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	resp, err := h.svc.QueryTasks(ctx, tenantID, status, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "total": resp.Total, "data": resp.Data})
}

// CreateTask creates a new task.
func (h *TaskExecutorHandler) CreateTask(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AITaskExecCreateTask")
	defer span.End()
	tenantID := h.GetTenantID(c)
	var req models.CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}

	task, err := h.svc.CreateTask(ctx, tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "message": "created", "data": task})
}

// GetTask returns a task by ID.
func (h *TaskExecutorHandler) GetTask(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AITaskExecGetTask")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	task, err := h.svc.GetTask(ctx, tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": task})
}

// ExecuteTask executes a task.
func (h *TaskExecutorHandler) ExecuteTask(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AITaskExecExecute")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	var req models.ExecuteRequest
	req.TaskID = id
	if err := c.ShouldBindJSON(&req); err != nil {
		req.TaskID = id
		req.Input = map[string]interface{}{}
	}

	task, err := h.svc.ExecuteTask(ctx, tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": task})
}

// CancelTask cancels a task.
func (h *TaskExecutorHandler) CancelTask(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AITaskExecCancel")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	task, err := h.svc.CancelTask(ctx, tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": task})
}
