package rest

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/orion-platform/orion-ops/internal/executor"
	"github.com/orion-platform/orion-ops/internal/scheduler"
	"github.com/orion-platform/orion-ops/internal/terminal"
)

// RegisterRoutes registers all Ops REST API routes
func RegisterRoutes(r *gin.Engine, terminalMgr *terminal.Manager, batchExecutor *executor.BatchExecutor, cronScheduler *scheduler.CronScheduler) {
	v1 := r.Group("/api/v1/ops")
	{
		// Session routes
		sessions := v1.Group("/sessions")
		{
			sessions.POST("", CreateSession(terminalMgr))
			sessions.GET("/:id", GetSession(terminalMgr))
			sessions.DELETE("/:id", CloseSession(terminalMgr))
		}

		// Task routes
		tasks := v1.Group("/tasks")
		{
			tasks.POST("", ExecuteBatch(batchExecutor))
			tasks.GET("/:id", GetTask(batchExecutor))
			tasks.GET("/:id/results", GetTaskResults(batchExecutor))
		}

		// Cron routes
		cron := v1.Group("/cron")
		{
			cron.POST("", CreateCronJob(cronScheduler))
			cron.GET("", ListCronJobs(cronScheduler))
			cron.PUT("/:id", UpdateCronJob(cronScheduler))
			cron.DELETE("/:id", DeleteCronJob(cronScheduler))
		}
	}
}

// CreateSessionRequest represents the request for creating a session
type CreateSessionRequest struct {
	HostID      string `json:"host_id" binding:"required"`
	SessionType string `json:"session_type"`
	UserID      string `json:"user_id" binding:"required"`
}

// CreateSession creates a new terminal session
func CreateSession(mgr *terminal.Manager) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req CreateSessionRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		sessionType := req.SessionType
		if sessionType == "" {
			sessionType = string(terminal.SessionTypeSSH)
		}

		session, err := mgr.CreateSession(c.Request.Context(), req.HostID, sessionType, req.UserID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, session)
	}
}

// GetSession retrieves a session by ID
func GetSession(mgr *terminal.Manager) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		managedSession, ok := mgr.GetSession(id)
		if !ok {
			c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
			return
		}

		c.JSON(http.StatusOK, managedSession.Session)
	}
}

// CloseSession closes a terminal session
func CloseSession(mgr *terminal.Manager) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		if err := mgr.CloseSession(id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "session closed successfully"})
	}
}

// ExecuteBatch executes a command on multiple hosts
func ExecuteBatch(exec *executor.BatchExecutor) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input executor.ExecuteBatchInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		task, err := exec.ExecuteBatch(input)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, task)
	}
}

// GetTask retrieves a task by ID
func GetTask(exec *executor.BatchExecutor) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		task, err := exec.GetTask(id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
			return
		}

		c.JSON(http.StatusOK, task)
	}
}

// GetTaskResults retrieves all results for a task
func GetTaskResults(exec *executor.BatchExecutor) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		results, err := exec.GetTaskResults(id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"items":      results,
			"total_count": len(results),
		})
	}
}

// CreateCronJobRequest represents the request for creating a cron job
type CreateCronJobRequest struct {
	TenantID    int64  `json:"tenant_id" binding:"required"`
	UserID      string `json:"user_id" binding:"required"`
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Command     string `json:"command" binding:"required"`
	Schedule    string `json:"schedule" binding:"required"`
	HostIDs     string `json:"host_ids"`
	Timeout     int    `json:"timeout"`
}

// CreateCronJob creates a new cron job
func CreateCronJob(svc *scheduler.CronScheduler) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req CreateCronJobRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		timeout := req.Timeout
		if timeout <= 0 {
			timeout = 300 // default 5 minutes
		}

		job := &scheduler.CronJob{
			TenantID:    req.TenantID,
			UserID:      req.UserID,
			Name:        req.Name,
			Description: req.Description,
			Command:     req.Command,
			Schedule:    req.Schedule,
			Status:      scheduler.JobStatusActive,
			HostIDs:     req.HostIDs,
			Timeout:     timeout,
		}

		if err := svc.CreateCronJob(job); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, job)
	}
}

// ListCronJobs returns all cron jobs
func ListCronJobs(svc *scheduler.CronScheduler) gin.HandlerFunc {
	return func(c *gin.Context) {
		jobs, err := svc.ListCronJobs()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"items":      jobs,
			"total_count": len(jobs),
		})
	}
}

// UpdateCronJobRequest represents the request for updating a cron job
type UpdateCronJobRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Command     string `json:"command"`
	Schedule    string `json:"schedule"`
	Status      string `json:"status"`
	HostIDs     string `json:"host_ids"`
	Timeout     int    `json:"timeout"`
}

// UpdateCronJob updates an existing cron job
func UpdateCronJob(svc *scheduler.CronScheduler) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		var req UpdateCronJobRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		job := &scheduler.CronJob{
			Name:        req.Name,
			Description: req.Description,
			Command:     req.Command,
			Schedule:    req.Schedule,
			HostIDs:     req.HostIDs,
			Timeout:     req.Timeout,
		}

		if req.Status != "" {
			job.Status = scheduler.JobStatus(req.Status)
		}

		if err := svc.UpdateCronJob(id, job); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "cron job updated successfully"})
	}
}

// DeleteCronJob deletes a cron job
func DeleteCronJob(svc *scheduler.CronScheduler) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		if err := svc.DeleteCronJob(id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "cron job deleted successfully"})
	}
}