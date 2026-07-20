package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"

	"orion/platform-svc-go/internal/visor-exec/models"
	v_service "orion/platform-svc-go/internal/visor-exec/service"

	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *v_service.Service
}

func NewHandler(svc *v_service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	v := rg.Group("/visor-exec")

	v.POST("/commands", auth.RequirePermission("visor_exec", "write"), h.ExecuteCommand)
	v.GET("/commands", auth.RequirePermission("visor_exec", "read"), h.ListCommandLogs)
	v.GET("/commands/count", auth.RequirePermission("visor_exec", "read"), h.CountCommandLogs)
	v.GET("/commands/:id", auth.RequirePermission("visor_exec", "read"), h.GetCommandLogByID)
	v.GET("/commands/:id/details", auth.RequirePermission("visor_exec", "read"), h.GetCommandLogDetails)

	v.POST("/templates", auth.RequirePermission("visor_exec", "write"), h.CreateTemplate)
	v.GET("/templates", auth.RequirePermission("visor_exec", "read"), h.ListTemplates)
	v.GET("/templates/count", auth.RequirePermission("visor_exec", "read"), h.CountTemplates)
	v.GET("/templates/:id", auth.RequirePermission("visor_exec", "read"), h.GetTemplateByID)
	v.PUT("/templates/:id", auth.RequirePermission("visor_exec", "write"), h.UpdateTemplate)
	v.DELETE("/templates/:id", auth.RequirePermission("visor_exec", "delete"), h.DeleteTemplate)

	v.POST("/cron-jobs", auth.RequirePermission("visor_exec", "write"), h.CreateCronJob)
	v.GET("/cron-jobs", auth.RequirePermission("visor_exec", "read"), h.ListCronJobs)
	v.GET("/cron-jobs/count", auth.RequirePermission("visor_exec", "read"), h.CountCronJobs)
	v.GET("/cron-jobs/:id", auth.RequirePermission("visor_exec", "read"), h.GetCronJobByID)
	v.PUT("/cron-jobs/:id", auth.RequirePermission("visor_exec", "write"), h.UpdateCronJob)
	v.DELETE("/cron-jobs/:id", auth.RequirePermission("visor_exec", "delete"), h.DeleteCronJob)
	v.PATCH("/cron-jobs/:id/toggle", auth.RequirePermission("visor_exec", "manage"), h.ToggleCronJob)
	v.POST("/cron-jobs/:id/run", auth.RequirePermission("visor_exec", "manage"), h.RunCronJobNow)
	v.GET("/cron-jobs/:id/logs", auth.RequirePermission("visor_exec", "read"), h.ListCronJobLogs)
	v.GET("/cron-jobs/:id/logs/count", auth.RequirePermission("visor_exec", "read"), h.CountCronJobLogs)

	v.POST("/upload-tasks", auth.RequirePermission("visor_exec", "write"), h.CreateUploadTask)
	v.GET("/upload-tasks", auth.RequirePermission("visor_exec", "read"), h.ListUploadTasks)
	v.GET("/upload-tasks/count", auth.RequirePermission("visor_exec", "read"), h.CountUploadTasks)
	v.GET("/upload-tasks/:id", auth.RequirePermission("visor_exec", "read"), h.GetUploadTaskByID)
	v.PATCH("/upload-tasks/:id/cancel", auth.RequirePermission("visor_exec", "manage"), h.CancelUploadTask)
}

func (h *Handler) ExecuteCommand(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExecuteCommand")
	defer span.End()
	var req struct {
		Command string   `json:"command" binding:"required"`
		HostIDs []string `json:"hostIds"`
		Timeout int      `json:"timeout"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Timeout <= 0 {
		req.Timeout = 300
	}
	log, err := h.svc.ExecuteCommand(ctx, req.Command, req.HostIDs, req.Timeout)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, log)
}

func (h *Handler) ListCommandLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListCommandLogs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if pageSize <= 0 {
		pageSize = 20
	}
	logs, err := h.svc.ListCommandLogs(ctx, tenantID, page, pageSize)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, logs)
}

func (h *Handler) CountCommandLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CountCommandLogs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.CountCommandLogs(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"count": count})
}

func (h *Handler) GetCommandLogByID(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCommandLogByID")
	defer span.End()
	id := c.Param("id")
	log, err := h.svc.GetCommandLogByID(ctx, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, log)
}

func (h *Handler) GetCommandLogDetails(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCommandLogDetails")
	defer span.End()
	id := c.Param("id")
	details, err := h.svc.GetCommandLogDetails(ctx, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, details)
}

func (h *Handler) CreateTemplate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateTemplate")
	defer span.End()
	var req models.CreateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Content == "" {
		middleware.RespondBadRequest(c, "content is required")
		return
	}
	tpl, err := h.svc.CreateTemplate(ctx, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, tpl)
}

func (h *Handler) ListTemplates(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListTemplates")
	defer span.End()
	tpls, err := h.svc.ListTemplates(ctx)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, tpls)
}

func (h *Handler) CountTemplates(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CountTemplates")
	defer span.End()
	count, err := h.svc.CountTemplates(ctx)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"count": count})
}

func (h *Handler) GetTemplateByID(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTemplateByID")
	defer span.End()
	id := c.Param("id")
	tpl, err := h.svc.GetTemplateByID(ctx, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, tpl)
}

func (h *Handler) UpdateTemplate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateTemplate")
	defer span.End()
	id := c.Param("id")
	var req models.UpdateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Name == nil && req.Content == nil && req.Description == nil && req.Category == nil {
		middleware.RespondBadRequest(c, "at least one field is required")
		return
	}
	tpl, err := h.svc.UpdateTemplate(ctx, id, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, tpl)
}

func (h *Handler) DeleteTemplate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteTemplate")
	defer span.End()
	id := c.Param("id")
	if err := h.svc.DeleteTemplate(ctx, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "template deleted"})
}

func (h *Handler) CreateCronJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateCronJob")
	defer span.End()
	var req models.CreateCronJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.CronExpression == "" {
		middleware.RespondBadRequest(c, "cronExpression is required")
		return
	}
	job, err := h.svc.CreateCronJob(ctx, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, job)
}

func (h *Handler) ListCronJobs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListCronJobs")
	defer span.End()
	jobs, err := h.svc.ListCronJobs(ctx)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, jobs)
}

func (h *Handler) CountCronJobs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CountCronJobs")
	defer span.End()
	count, err := h.svc.CountCronJobs(ctx)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"count": count})
}

func (h *Handler) GetCronJobByID(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCronJobByID")
	defer span.End()
	id := c.Param("id")
	job, err := h.svc.GetCronJobByID(ctx, id)
	if err != nil {
		if v_service.IsNotFound(err) {
			middleware.RespondNotFound(c, "cron job not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, job)
}

func (h *Handler) UpdateCronJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateCronJob")
	defer span.End()
	id := c.Param("id")
	var req models.UpdateCronJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	job, err := h.svc.UpdateCronJob(ctx, id, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, job)
}

func (h *Handler) DeleteCronJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteCronJob")
	defer span.End()
	id := c.Param("id")
	if err := h.svc.DeleteCronJob(ctx, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "cron job deleted"})
}

func (h *Handler) ToggleCronJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ToggleCronJob")
	defer span.End()
	id := c.Param("id")
	enabledStr := c.Query("enabled")
	enabled := enabledStr == "true" || enabledStr == "1"
	job, err := h.svc.ToggleCronJob(ctx, id, enabled)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, job)
}

func (h *Handler) RunCronJobNow(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RunCronJobNow")
	defer span.End()
	id := c.Param("id")
	log, err := h.svc.RunCronJobNow(ctx, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, log)
}

func (h *Handler) ListCronJobLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListCronJobLogs")
	defer span.End()
	jobID := c.Param("id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if pageSize <= 0 {
		pageSize = 20
	}
	logs, err := h.svc.ListCronJobLogs(ctx, jobID, page, pageSize)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, logs)
}

func (h *Handler) CountCronJobLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CountCronJobLogs")
	defer span.End()
	jobID := c.Param("id")
	count, err := h.svc.CountCronJobLogs(ctx, jobID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"count": count})
}

func (h *Handler) CreateUploadTask(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateUploadTask")
	defer span.End()
	var req models.CreateUploadTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.TargetPath == "" {
		middleware.RespondBadRequest(c, "targetPath is required")
		return
	}
	task, err := h.svc.CreateUploadTask(ctx, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, task)
}

func (h *Handler) ListUploadTasks(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListUploadTasks")
	defer span.End()
	tasks, err := h.svc.ListUploadTasks(ctx)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, tasks)
}

func (h *Handler) CountUploadTasks(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CountUploadTasks")
	defer span.End()
	count, err := h.svc.CountUploadTasks(ctx)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"count": count})
}

func (h *Handler) GetUploadTaskByID(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetUploadTaskByID")
	defer span.End()
	id := c.Param("id")
	task, err := h.svc.GetUploadTaskByID(ctx, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, task)
}

func (h *Handler) CancelUploadTask(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CancelUploadTask")
	defer span.End()
	id := c.Param("id")
	task, err := h.svc.CancelUploadTask(ctx, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, task)
}
