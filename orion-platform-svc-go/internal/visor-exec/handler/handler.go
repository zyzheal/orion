package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"

	"orion/platform-svc-go/internal/visor-exec/models"
	v_service "orion/platform-svc-go/internal/visor-exec/service"

	"github.com/gin-gonic/gin"
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
	var req struct {
		Command string   `json:"command" binding:"required"`
		HostIDs []string `json:"hostIds"`
		Timeout int      `json:"timeout"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if req.Timeout <= 0 {
		req.Timeout = 300
	}
	log, err := h.svc.ExecuteCommand(c.Request.Context(), req.Command, req.HostIDs, req.Timeout)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, log)
}

func (h *Handler) ListCommandLogs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if pageSize <= 0 {
		pageSize = 20
	}
	logs, err := h.svc.ListCommandLogs(c.Request.Context(), tenantID, page, pageSize)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, logs)
}

func (h *Handler) CountCommandLogs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
count, err := h.svc.CountCommandLogs(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

func (h *Handler) GetCommandLogByID(c *gin.Context) {
	id := c.Param("id")
	log, err := h.svc.GetCommandLogByID(c.Request.Context(), id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, log)
}

func (h *Handler) GetCommandLogDetails(c *gin.Context) {
	id := c.Param("id")
	details, err := h.svc.GetCommandLogDetails(c.Request.Context(), id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, details)
}

func (h *Handler) CreateTemplate(c *gin.Context) {
	var req models.CreateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if req.Content == "" {
		respondBadRequest(c, "content is required")
		return
	}
	tpl, err := h.svc.CreateTemplate(c.Request.Context(), req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, tpl)
}

func (h *Handler) ListTemplates(c *gin.Context) {
	tpls, err := h.svc.ListTemplates(c.Request.Context())
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, tpls)
}

func (h *Handler) CountTemplates(c *gin.Context) {
count, err := h.svc.CountTemplates(c.Request.Context())
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

func (h *Handler) GetTemplateByID(c *gin.Context) {
	id := c.Param("id")
	tpl, err := h.svc.GetTemplateByID(c.Request.Context(), id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, tpl)
}

func (h *Handler) UpdateTemplate(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if req.Name == nil && req.Content == nil && req.Description == nil && req.Category == nil {
		respondBadRequest(c, "at least one field is required")
		return
	}
	tpl, err := h.svc.UpdateTemplate(c.Request.Context(), id, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, tpl)
}

func (h *Handler) DeleteTemplate(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.DeleteTemplate(c.Request.Context(), id); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "template deleted"})
}

func (h *Handler) CreateCronJob(c *gin.Context) {
	var req models.CreateCronJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if req.CronExpression == "" {
		respondBadRequest(c, "cronExpression is required")
		return
	}
	job, err := h.svc.CreateCronJob(c.Request.Context(), req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, job)
}

func (h *Handler) ListCronJobs(c *gin.Context) {
	jobs, err := h.svc.ListCronJobs(c.Request.Context())
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, jobs)
}

func (h *Handler) CountCronJobs(c *gin.Context) {
count, err := h.svc.CountCronJobs(c.Request.Context())
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

func (h *Handler) GetCronJobByID(c *gin.Context) {
	id := c.Param("id")
	job, err := h.svc.GetCronJobByID(c.Request.Context(), id)
	if err != nil {
		if v_service.IsNotFound(err) {
			respondNotFound(c, "cron job not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, job)
}

func (h *Handler) UpdateCronJob(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateCronJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	job, err := h.svc.UpdateCronJob(c.Request.Context(), id, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, job)
}

func (h *Handler) DeleteCronJob(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.DeleteCronJob(c.Request.Context(), id); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "cron job deleted"})
}

func (h *Handler) ToggleCronJob(c *gin.Context) {
	id := c.Param("id")
	enabledStr := c.Query("enabled")
	enabled := enabledStr == "true" || enabledStr == "1"
	job, err := h.svc.ToggleCronJob(c.Request.Context(), id, enabled)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, job)
}

func (h *Handler) RunCronJobNow(c *gin.Context) {
	id := c.Param("id")
	log, err := h.svc.RunCronJobNow(c.Request.Context(), id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, log)
}

func (h *Handler) ListCronJobLogs(c *gin.Context) {
	jobID := c.Param("id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if pageSize <= 0 {
		pageSize = 20
	}
	logs, err := h.svc.ListCronJobLogs(c.Request.Context(), jobID, page, pageSize)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, logs)
}

func (h *Handler) CountCronJobLogs(c *gin.Context) {
	jobID := c.Param("id")
	count, err := h.svc.CountCronJobLogs(c.Request.Context(), jobID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

func (h *Handler) CreateUploadTask(c *gin.Context) {
	var req models.CreateUploadTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if req.TargetPath == "" {
		respondBadRequest(c, "targetPath is required")
		return
	}
	task, err := h.svc.CreateUploadTask(c.Request.Context(), req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, task)
}

func (h *Handler) ListUploadTasks(c *gin.Context) {
	tasks, err := h.svc.ListUploadTasks(c.Request.Context())
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, tasks)
}

func (h *Handler) CountUploadTasks(c *gin.Context) {
	count, err := h.svc.CountUploadTasks(c.Request.Context())
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

func (h *Handler) GetUploadTaskByID(c *gin.Context) {
	id := c.Param("id")
	task, err := h.svc.GetUploadTaskByID(c.Request.Context(), id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, task)
}

func (h *Handler) CancelUploadTask(c *gin.Context) {
	id := c.Param("id")
	task, err := h.svc.CancelUploadTask(c.Request.Context(), id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, task)
}
