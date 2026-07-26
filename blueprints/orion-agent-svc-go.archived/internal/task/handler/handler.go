package handler

import (
	"net/http"
	"github.com/gin-gonic/gin"
	"github.com/orion/agent-svc/internal/task/service"
)

type TaskHandler struct {
	Service service.TaskService
}

func NewTaskHandler(svc service.TaskService) *TaskHandler {
	return &TaskHandler{Service: svc}
}

func (h *TaskHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/tasks", h.CreateTask)
	rg.GET("/tasks", h.ListTasks)
	rg.GET("/tasks/:id", h.GetTask)
	rg.POST("/tasks/:id/execute", h.ExecuteTask)
	rg.POST("/tasks/:id/cancel", h.CancelTask)
}

func (h *TaskHandler) CreateTask(c *gin.Context) {
	c.JSON(http.StatusCreated, gin.H{"code": 0, "message": "success"})
}

func (h *TaskHandler) ListTasks(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success"})
}

func (h *TaskHandler) GetTask(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success"})
}

func (h *TaskHandler) ExecuteTask(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success"})
}

func (h *TaskHandler) CancelTask(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success"})
}
