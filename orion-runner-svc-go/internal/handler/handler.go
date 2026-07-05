package handler

import (
	"net/http"
	"strconv"

	"orion/runner-svc-go/internal/models"
	"orion/runner-svc-go/internal/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// Handler exposes HTTP endpoints for the runner-svc.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all runner-svc routes on the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// Runner CRUD + lifecycle
	runners := rg.Group("/runners")
	runners.POST("", auth.RequirePermission("runner", "write"), h.CreateRunner)
	runners.GET("", h.ListRunners)
	runners.GET("/count", h.CountRunners)
	runners.GET("/:id", h.GetRunner)
	runners.PUT("/:id", auth.RequirePermission("runner", "write"), h.UpdateRunner)
	runners.DELETE("/:id", auth.RequirePermission("runner", "delete"), h.DeleteRunner)
	runners.POST("/:id/heartbeat", auth.RequirePermission("runner", "write"), h.Heartbeat)
	runners.POST("/select", auth.RequirePermission("runner", "write"), h.SelectRunner)
	runners.GET("/stale", h.GetStaleRunners)
	runners.POST("/stale/mark-offline", auth.RequirePermission("runner", "write"), h.MarkStaleRunnersOffline)
	runners.GET("/:id/jobs", h.ListRunnerJobs)

	// Pipeline run CRUD
	runs := rg.Group("/runs")
	runs.POST("", auth.RequirePermission("runner", "write"), h.CreateRun)
	runs.GET("", h.ListRuns)
	runs.GET("/:id", h.GetRun)
	runs.GET("/:id/detail", h.GetRunDetail)
	runs.POST("/:id/start", auth.RequirePermission("runner", "execute"), h.StartRun)
	runs.POST("/:id/complete", auth.RequirePermission("runner", "execute"), h.CompleteRun)
	runs.POST("/:id/cancel", auth.RequirePermission("runner", "execute"), h.CancelRun)
	runs.DELETE("/:id", auth.RequirePermission("runner", "delete"), h.DeleteRun)
	runs.GET("/:id/completion", h.CheckRunCompletion)

	// Stage execution
	runs.POST("/:runId/stages", auth.RequirePermission("runner", "write"), h.AddStage)
	runs.GET("/:runId/stages", h.GetStages)

	// Task execution
	stages := rg.Group("/stages")
	stages.GET("/:stageId/tasks", h.GetTasks)
	stages.POST("/:stageId/tasks", auth.RequirePermission("runner", "write"), h.AddTask)

	// Task lifecycle
	tasks := rg.Group("/tasks")
	tasks.GET("/:taskId", h.GetTask)
	tasks.POST("/:taskId/start", auth.RequirePermission("runner", "execute"), h.StartTask)
	tasks.POST("/:taskId/complete", auth.RequirePermission("runner", "execute"), h.CompleteTask)
	tasks.POST("/:taskId/fail", auth.RequirePermission("runner", "write"), h.FailTask)
	tasks.POST("/:taskId/logs", auth.RequirePermission("runner", "write"), h.AppendTaskLogs)

	// Runner jobs
	jobs := rg.Group("/jobs")
	jobs.POST("", auth.RequirePermission("runner", "write"), h.CreateRunnerJob)
	jobs.GET("/:id", h.GetRunnerJob)
	jobs.POST("/:id/start", auth.RequirePermission("runner", "execute"), h.MarkJobStarted)
	jobs.POST("/:id/complete", auth.RequirePermission("runner", "execute"), h.MarkJobComplete)
	jobs.POST("/:id/fail", auth.RequirePermission("runner", "write"), h.MarkJobFailed)
}

// ==================== Runner Endpoints ====================

func (h *Handler) CreateRunner(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateRunnerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	runner, err := h.svc.Create(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, runner)
}

func (h *Handler) ListRunners(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	offset := (page - 1) * ps
	if offset < 0 {
		offset = 0
	}
	items, err := h.svc.List(c.Request.Context(), tenantID, offset, ps)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) CountRunners(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

func (h *Handler) GetRunner(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	runner, err := h.svc.GetByID(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "runner not found"})
		return
	}
	c.JSON(http.StatusOK, runner)
}

func (h *Handler) UpdateRunner(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateRunnerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	runner, err := h.svc.Update(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, runner)
}

func (h *Handler) DeleteRunner(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) Heartbeat(c *gin.Context) {
	runner, err := h.svc.Heartbeat(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "runner not found"})
		return
	}
	c.JSON(http.StatusOK, runner)
}

func (h *Handler) SelectRunner(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req struct {
		Labels []string `json:"labels" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	runner, err := h.svc.SelectRunner(c.Request.Context(), tenantID, req.Labels)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, runner)
}

func (h *Handler) GetStaleRunners(c *gin.Context) {
	timeout, _ := strconv.Atoi(c.DefaultQuery("timeout_minutes", "5"))
	stale, err := h.svc.GetStaleRunners(c.Request.Context(), timeout)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": stale, "count": len(stale)})
}

func (h *Handler) MarkStaleRunnersOffline(c *gin.Context) {
	timeout, _ := strconv.Atoi(c.DefaultQuery("timeout_minutes", "5"))
	count, err := h.svc.MarkStaleRunnersOffline(c.Request.Context(), timeout)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"marked_offline": count})
}

func (h *Handler) ListRunnerJobs(c *gin.Context) {
	jobs, err := h.svc.ListRunnerJobs(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": jobs})
}

// ==================== Pipeline Run Endpoints ====================

func (h *Handler) CreateRun(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreatePipelineRunRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	run, err := h.svc.CreateRun(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, run)
}

func (h *Handler) ListRuns(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	offset := (page - 1) * ps
	if offset < 0 {
		offset = 0
	}

	filter := &models.RunListFilter{
		PipelineID:  c.Query("pipeline_id"),
		Status:      c.Query("status"),
		TriggerType: c.Query("trigger_type"),
		Limit:       ps,
		Offset:      offset,
	}

	runs, err := h.svc.ListRuns(c.Request.Context(), tenantID, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": runs})
}

func (h *Handler) GetRun(c *gin.Context) {
	run, err := h.svc.GetRun(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "run not found"})
		return
	}
	c.JSON(http.StatusOK, run)
}

func (h *Handler) GetRunDetail(c *gin.Context) {
	run, stages, tasks, err := h.svc.GetRunDetail(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "run not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"run":    run,
		"stages": stages,
		"tasks":  tasks,
	})
}

func (h *Handler) StartRun(c *gin.Context) {
	run, err := h.svc.StartRun(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, run)
}

func (h *Handler) CompleteRun(c *gin.Context) {
	var req struct {
		Status      string  `json:"status" binding:"required"`
		ErrorMessage *string `json:"error_message"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Status != "success" && req.Status != "failed" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status must be 'success' or 'failed'"})
		return
	}
	run, err := h.svc.CompleteRun(c.Request.Context(), c.Param("id"), req.Status, req.ErrorMessage)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, run)
}

func (h *Handler) CancelRun(c *gin.Context) {
	run, err := h.svc.CancelRun(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, run)
}

func (h *Handler) DeleteRun(c *gin.Context) {
	if err := h.svc.DeleteRun(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) CheckRunCompletion(c *gin.Context) {
	result, err := h.svc.CheckRunCompletion(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// ==================== Stage Endpoints ====================

func (h *Handler) AddStage(c *gin.Context) {
	runID := c.Param("runId")
	var req struct {
		StageName string  `json:"stage_name" binding:"required"`
		StageID   *string `json:"stage_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	stage, err := h.svc.AddStage(c.Request.Context(), runID, req.StageName, req.StageID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, stage)
}

func (h *Handler) GetStages(c *gin.Context) {
	stages, err := h.svc.GetStages(c.Request.Context(), c.Param("runId"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": stages})
}

// ==================== Task Endpoints ====================

func (h *Handler) GetTasks(c *gin.Context) {
	tasks, err := h.svc.GetTasks(c.Request.Context(), c.Param("stageId"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": tasks})
}

func (h *Handler) AddTask(c *gin.Context) {
	stageID := c.Param("stageId")
	var req struct {
		TaskName string                 `json:"task_name" binding:"required"`
		TaskType string                 `json:"task_type" binding:"required"`
		Input    map[string]interface{} `json:"input"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	task, err := h.svc.AddTask(c.Request.Context(), stageID, req.TaskName, req.TaskType, req.Input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, task)
}

func (h *Handler) GetTask(c *gin.Context) {
	task, err := h.svc.GetTask(c.Request.Context(), c.Param("taskId"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}
	c.JSON(http.StatusOK, task)
}

func (h *Handler) StartTask(c *gin.Context) {
	task, err := h.svc.StartTask(c.Request.Context(), c.Param("taskId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, task)
}

func (h *Handler) CompleteTask(c *gin.Context) {
	var req struct {
		Output map[string]interface{} `json:"output"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	task, err := h.svc.CompleteTask(c.Request.Context(), c.Param("taskId"), req.Output)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, task)
}

func (h *Handler) FailTask(c *gin.Context) {
	var req struct {
		ErrorMessage string `json:"error_message" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	task, err := h.svc.FailTask(c.Request.Context(), c.Param("taskId"), req.ErrorMessage)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, task)
}

func (h *Handler) AppendTaskLogs(c *gin.Context) {
	var req struct {
		Logs string `json:"logs" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.AppendTaskLogs(c.Request.Context(), c.Param("taskId"), req.Logs); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "logs appended"})
}

// ==================== Runner Job Endpoints ====================

func (h *Handler) CreateRunnerJob(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateRunnerJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	job, err := h.svc.CreateRunnerJob(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, job)
}

func (h *Handler) GetRunnerJob(c *gin.Context) {
	job, err := h.svc.GetRunnerJob(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "job not found"})
		return
	}
	c.JSON(http.StatusOK, job)
}

func (h *Handler) MarkJobStarted(c *gin.Context) {
	job, err := h.svc.MarkJobStarted(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, job)
}

func (h *Handler) MarkJobComplete(c *gin.Context) {
	var req struct {
		Result map[string]interface{} `json:"result"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	job, err := h.svc.MarkJobComplete(c.Request.Context(), c.Param("id"), req.Result)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, job)
}

func (h *Handler) MarkJobFailed(c *gin.Context) {
	var req struct {
		Error string `json:"error" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	job, err := h.svc.MarkJobFailed(c.Request.Context(), c.Param("id"), req.Error)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, job)
}
