package handler

import (
	"go.opentelemetry.io/otel"
	"strconv"

	"orion/platform-svc-go/internal/ci-cd/runner/models"
	"orion/platform-svc-go/internal/ci-cd/runner/service"

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
	runs.GET("/:id/detail", h.GetRunDetail)
	runs.POST("/:id/start", auth.RequirePermission("runner", "execute"), h.StartRun)
	runs.POST("/:id/complete", auth.RequirePermission("runner", "execute"), h.CompleteRun)
	runs.POST("/:id/cancel", auth.RequirePermission("runner", "execute"), h.CancelRun)
	runs.DELETE("/:id", auth.RequirePermission("runner", "delete"), h.DeleteRun)
	runs.GET("/:id/completion", h.CheckRunCompletion)

	// Stage execution
	runs.POST("/:id/stages", auth.RequirePermission("runner", "write"), h.AddStage)
	runs.GET("/:id/stages", h.GetStages)

	// Task execution
	stages := rg.Group("/stages")
	stages.GET("/:stageId/tasks", h.GetTasks)
	stages.POST("/:stageId/tasks", auth.RequirePermission("runner", "write"), h.AddTask)

	// Task lifecycle
	tasks := rg.Group("/tasks")
	// GET /tasks/:id is served by ai_intelligenceH (registered first); the
	// duplicate registration was removed because Gin panics on a second
	// (method, path) pair.
	tasks.POST("/:id/start", auth.RequirePermission("runner", "execute"), h.StartTask)
	tasks.POST("/:id/complete", auth.RequirePermission("runner", "execute"), h.CompleteTask)
	tasks.POST("/:id/fail", auth.RequirePermission("runner", "write"), h.FailTask)
	tasks.POST("/:id/logs", auth.RequirePermission("runner", "write"), h.AppendTaskLogs)

	// Runner jobs
	jobs := rg.Group("/jobs")
	jobs.POST("", auth.RequirePermission("runner", "write"), h.CreateRunnerJob)
	jobs.GET("/:id", h.GetRunnerJob)
	jobs.POST("/:id/start", auth.RequirePermission("runner", "execute"), h.MarkJobStarted)
	jobs.POST("/:id/complete", auth.RequirePermission("runner", "execute"), h.MarkJobComplete)
	jobs.POST("/:id/fail", auth.RequirePermission("runner", "write"), h.MarkJobFailed)

	// Runner job result callback — Runner agent reports job result (Node.js compatible)
	// POST /runners/:id/jobs/:jobId/result — accepts {status: 'completed'|'failed', result?, error?}
	runners.POST("/:id/jobs/:jobId/result", auth.RequirePermission("runner", "write"), h.ReportJobResult)
}

// ==================== Runner Endpoints ====================

func (h *Handler) CreateRunner(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerCreateRunner")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateRunnerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	runner, err := h.svc.Create(ctx, tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, runner)
}

func (h *Handler) ListRunners(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerListRunners")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	offset := (page - 1) * ps
	if offset < 0 {
		offset = 0
	}
	items, err := h.svc.List(ctx, tenantID, offset, ps)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) CountRunners(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerCountRunners")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

func (h *Handler) GetRunner(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerGetRunner")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	runner, err := h.svc.GetByID(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, "runner not found")
		return
	}
	respondSuccess(c, runner)
}

func (h *Handler) UpdateRunner(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerUpdateRunner")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.UpdateRunnerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	runner, err := h.svc.Update(ctx, tenantID, c.Param("id"), &req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, runner)
}

func (h *Handler) DeleteRunner(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerDeleteRunner")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(ctx, tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) Heartbeat(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerHeartbeat")
	defer span.End()
	runner, err := h.svc.Heartbeat(ctx, c.Param("id"))
	if err != nil {
		respondNotFound(c, "runner not found")
		return
	}
	respondSuccess(c, runner)
}

func (h *Handler) SelectRunner(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerSelectRunner")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req struct {
		Labels []string `json:"labels" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	runner, err := h.svc.SelectRunner(ctx, tenantID, req.Labels)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, runner)
}

func (h *Handler) GetStaleRunners(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerGetStaleRunners")
	defer span.End()
	timeout, _ := strconv.Atoi(c.DefaultQuery("timeout_minutes", "5"))
	stale, err := h.svc.GetStaleRunners(ctx, timeout)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"runners": stale, "count": len(stale)})
}

func (h *Handler) MarkStaleRunnersOffline(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerMarkStaleRunnersOffline")
	defer span.End()
	timeout, _ := strconv.Atoi(c.DefaultQuery("timeout_minutes", "5"))
	count, err := h.svc.MarkStaleRunnersOffline(ctx, timeout)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"marked_offline": count})
}

func (h *Handler) ListRunnerJobs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerListRunnerJobs")
	defer span.End()
	jobs, err := h.svc.ListRunnerJobs(ctx, c.Param("id"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, jobs)
}

// ==================== Pipeline Run Endpoints ====================

func (h *Handler) CreateRun(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerCreateRun")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreatePipelineRunRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	run, err := h.svc.CreateRun(ctx, tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, run)
}

func (h *Handler) ListRuns(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerListRuns")
	defer span.End()
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

	runs, err := h.svc.ListRuns(ctx, tenantID, filter)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, runs)
}

func (h *Handler) GetRun(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerGetRun")
	defer span.End()
	run, err := h.svc.GetRun(ctx, c.Param("id"))
	if err != nil {
		respondNotFound(c, "run not found")
		return
	}
	respondSuccess(c, run)
}

func (h *Handler) GetRunDetail(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerGetRunDetail")
	defer span.End()
	run, stages, tasks, err := h.svc.GetRunDetail(ctx, c.Param("id"))
	if err != nil {
		respondNotFound(c, "run not found")
		return
	}
	respondSuccess(c, gin.H{
		"run":    run,
		"stages": stages,
		"tasks":  tasks,
	})
}

func (h *Handler) StartRun(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerStartRun")
	defer span.End()
	run, err := h.svc.StartRun(ctx, c.Param("id"))
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, run)
}

func (h *Handler) CompleteRun(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerCompleteRun")
	defer span.End()
	var req struct {
		Status       string  `json:"status" binding:"required"`
		ErrorMessage *string `json:"error_message"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if req.Status != "success" && req.Status != "failed" {
		respondBadRequest(c, "status must be 'success' or 'failed'")
		return
	}
	run, err := h.svc.CompleteRun(ctx, c.Param("id"), req.Status, req.ErrorMessage)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, run)
}

func (h *Handler) CancelRun(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerCancelRun")
	defer span.End()
	run, err := h.svc.CancelRun(ctx, c.Param("id"))
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, run)
}

func (h *Handler) DeleteRun(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerDeleteRun")
	defer span.End()
	if err := h.svc.DeleteRun(ctx, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) CheckRunCompletion(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerCheckRunCompletion")
	defer span.End()
	result, err := h.svc.CheckRunCompletion(ctx, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// ==================== Stage Endpoints ====================

func (h *Handler) AddStage(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerAddStage")
	defer span.End()
	runID := c.Param("id")
	var req struct {
		StageName string  `json:"stage_name" binding:"required"`
		StageID   *string `json:"stage_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	stage, err := h.svc.AddStage(ctx, runID, req.StageName, req.StageID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, stage)
}

func (h *Handler) GetStages(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerGetStages")
	defer span.End()
	stages, err := h.svc.GetStages(ctx, c.Param("id"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, stages)
}

// ==================== Task Endpoints ====================

func (h *Handler) GetTasks(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerGetTasks")
	defer span.End()
	tasks, err := h.svc.GetTasks(ctx, c.Param("stageId"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, tasks)
}

func (h *Handler) AddTask(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerAddTask")
	defer span.End()
	stageID := c.Param("stageId")
	var req struct {
		TaskName string                 `json:"task_name" binding:"required"`
		TaskType string                 `json:"task_type" binding:"required"`
		Input    map[string]interface{} `json:"input"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	task, err := h.svc.AddTask(ctx, stageID, req.TaskName, req.TaskType, req.Input)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, task)
}

func (h *Handler) GetTask(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerGetTask")
	defer span.End()
	task, err := h.svc.GetTask(ctx, c.Param("id"))
	if err != nil {
		respondNotFound(c, "task not found")
		return
	}
	respondSuccess(c, task)
}

func (h *Handler) StartTask(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerStartTask")
	defer span.End()
	task, err := h.svc.StartTask(ctx, c.Param("id"))
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, task)
}

func (h *Handler) CompleteTask(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerCompleteTask")
	defer span.End()
	var req struct {
		Output map[string]interface{} `json:"output"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	task, err := h.svc.CompleteTask(ctx, c.Param("id"), req.Output)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, task)
}

func (h *Handler) FailTask(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerFailTask")
	defer span.End()
	var req struct {
		ErrorMessage string `json:"error_message" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	task, err := h.svc.FailTask(ctx, c.Param("id"), req.ErrorMessage)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, task)
}

func (h *Handler) AppendTaskLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerAppendTaskLogs")
	defer span.End()
	var req struct {
		Logs string `json:"logs" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.AppendTaskLogs(ctx, c.Param("id"), req.Logs); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "logs appended"})
}

// ==================== Runner Job Endpoints ====================

func (h *Handler) CreateRunnerJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerCreateRunnerJob")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateRunnerJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	job, err := h.svc.CreateRunnerJob(ctx, tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, job)
}

func (h *Handler) GetRunnerJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerGetRunnerJob")
	defer span.End()
	job, err := h.svc.GetRunnerJob(ctx, c.Param("id"))
	if err != nil {
		respondNotFound(c, "job not found")
		return
	}
	respondSuccess(c, job)
}

func (h *Handler) MarkJobStarted(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerMarkJobStarted")
	defer span.End()
	job, err := h.svc.MarkJobStarted(ctx, c.Param("id"))
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, job)
}

func (h *Handler) MarkJobComplete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerMarkJobComplete")
	defer span.End()
	var req struct {
		Result map[string]interface{} `json:"result"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	job, err := h.svc.MarkJobComplete(ctx, c.Param("id"), req.Result)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, job)
}

func (h *Handler) MarkJobFailed(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerMarkJobFailed")
	defer span.End()
	var req struct {
		Error string `json:"error" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	job, err := h.svc.MarkJobFailed(ctx, c.Param("id"), req.Error)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, job)
}

// ReportJobResult is the Runner agent callback endpoint — Node.js compatible.
// POST /runners/:id/jobs/:jobId/result
// Body: {status: 'completed'|'failed', result?: map, error?: string}
func (h *Handler) ReportJobResult(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CIRunnerReportJobResult")
	defer span.End()
	var req struct {
		Status string                 `json:"status" binding:"required"`
		Result map[string]interface{} `json:"result"`
		Error  string                 `json:"error"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, "Missing status field")
		return
	}

	jobID := c.Param("jobId")
	runnerID := c.Param("id")

	if req.Status == "completed" {
		if req.Result == nil {
			req.Result = map[string]interface{}{}
		}
		job, err := h.svc.MarkJobComplete(ctx, jobID, req.Result)
		if err != nil {
			respondBadRequest(c, err.Error())
			return
		}
		respondSuccess(c, gin.H{"status": "ok", "jobId": job.ID})
	} else if req.Status == "failed" {
		errMsg := req.Error
		if errMsg == "" {
			errMsg = "Unknown error"
		}
		if _, err := h.svc.MarkJobFailed(ctx, jobID, errMsg); err != nil {
			respondBadRequest(c, err.Error())
			return
		}
		respondSuccess(c, gin.H{"status": "ok", "jobId": jobID})
	} else {
		respondBadRequest(c, "status must be 'completed' or 'failed'")
		return
	}

	_ = runnerID
}
