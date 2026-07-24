// Package handler provides HTTP handlers for the Runner CI task execution service.
// All endpoints are mounted under /api/v1/runner prefix via RegisterRoutes.
//
// API contract (translated from TS blueprint routes/runner-routes.ts):
//   POST   /api/v1/runner/agents        - Register a runner agent
//   GET    /api/v1/runner/agents         - List agents (paginated)
//   GET    /api/v1/runner/agents/:id     - Get agent info
//   PATCH  /api/v1/runner/agents/:id     - Update agent
//   DELETE /api/v1/runner/agents/:id     - Delete agent
//   POST   /api/v1/runner/agents/:id/heartbeat - Agent heartbeat
//   POST   /api/v1/runner/jobs           - Dispatch a job
//   GET    /api/v1/runner/jobs           - List jobs (paginated)
//   GET    /api/v1/runner/jobs/:id       - Get job details
//   PATCH  /api/v1/runner/jobs/:id       - Transition job status
//   DELETE /api/v1/runner/jobs/:id       - Delete job
//   POST   /api/v1/runner/jobs/:id/result - Report job result
//   GET    /api/v1/runner/health         - Health check (no auth)
package handler

import (
	"context"
	"net/http"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/runner/models"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Service defines the methods the handler calls on the service layer.
type Service interface {
	// Agent management
	AgentHealth(ctx context.Context) (string, error)
	RegisterAgent(ctx context.Context, tenantID string, req *models.CreateAgentRequest) (*models.RunnerAgent, error)
	GetAgent(ctx context.Context, tenantID, agentID string) (*models.AgentInfo, error)
	ListAgents(ctx context.Context, tenantID string, offset, limit int) ([]models.RunnerAgent, error)
	UpdateAgent(ctx context.Context, tenantID, agentID string, req *models.UpdateAgentRequest) (*models.RunnerAgent, error)
	DeleteAgent(ctx context.Context, tenantID, agentID string) error
	AgentHeartbeat(ctx context.Context, tenantID, agentID string, req *models.HeartbeatRequest) error
	CountAgents(ctx context.Context, tenantID string) (int, error)

	// Job management
	CreateJob(ctx context.Context, tenantID string, req *models.CreateJobRequest) (*models.RunnerJob, error)
	GetJob(ctx context.Context, tenantID, jobID string) (*models.RunnerJob, error)
	ListJobs(ctx context.Context, tenantID, status string, offset, limit int) ([]models.RunnerJob, error)
	ListJobsByAgent(ctx context.Context, tenantID, agentID string, offset, limit int) ([]models.RunnerJob, error)
	TransitionJob(ctx context.Context, tenantID, jobID string, req *models.UpdateJobStatusRequest) (*models.RunnerJob, error)
	DeleteJob(ctx context.Context, tenantID, jobID string) error
	ReportJobResult(ctx context.Context, jobID string) (*models.JobResult, error)
	CountJobs(ctx context.Context, tenantID string) (int, error)
}

type Handler struct{ svc Service }

func NewHandler(svc Service) *Handler { return &Handler{svc: svc} }

// RegisterRoutes mounts all runner endpoints under the given RouterGroup.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// Health (no auth, matches TS: unauthenticated)
	rg.GET("/runner/health", h.Health)

	// Agent endpoints — require write for mutations, read for queries
	rg.POST("/runner/agents", auth.RequirePermission("runner", "write"), h.RegisterAgent)
	rg.GET("/runner/agents", auth.RequirePermission("runner", "read"), h.ListAgents)
	rg.GET("/runner/agents/:id", auth.RequirePermission("runner", "read"), h.GetAgent)
	rg.PATCH("/runner/agents/:id", auth.RequirePermission("runner", "write"), h.UpdateAgent)
	rg.DELETE("/runner/agents/:id", auth.RequirePermission("runner", "write"), h.DeleteAgent)
	rg.POST("/runner/agents/:id/heartbeat", h.Heartbeat)

	// Job endpoints
	rg.POST("/runner/jobs", auth.RequirePermission("runner", "write"), h.CreateJob)
	rg.GET("/runner/jobs", auth.RequirePermission("runner", "read"), h.ListJobs)
	rg.GET("/runner/jobs/agent/:agentId", auth.RequirePermission("runner", "read"), h.ListJobsByAgent)
	rg.GET("/runner/jobs/:id", auth.RequirePermission("runner", "read"), h.GetJob)
	rg.PATCH("/runner/jobs/:id", auth.RequirePermission("runner", "write"), h.TransitionJob)
	rg.DELETE("/runner/jobs/:id", auth.RequirePermission("runner", "write"), h.DeleteJob)
	rg.POST("/runner/jobs/:id/result", h.ReportJobResult)
}

// ===========================================================================
// Health
// ===========================================================================

func (h *Handler) Health(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RunnerHealth")
	defer span.End()
	status, err := h.svc.AgentHealth(ctx)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"status": status})
}

// ===========================================================================
// Agent Management
// ===========================================================================

func (h *Handler) RegisterAgent(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RegisterAgent")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	agent, err := h.svc.RegisterAgent(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{
		"agent_id":     agent.AgentID,
		"status":       agent.Status,
		"max_concurrent": agent.MaxConcurrent,
		"name":         agent.Name,
	})
}

func (h *Handler) GetAgent(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAgent")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	agentID := c.Param("id")
	info, err := h.svc.GetAgent(ctx, tenantID, agentID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, info)
}

func (h *Handler) ListAgents(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAgents")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.ListAgents(ctx, tenantID, (page-1)*ps, ps)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if items == nil {
		items = []models.RunnerAgent{}
	}
	total, _ := h.svc.CountAgents(ctx, tenantID)
	middleware.RespondPaginated(c, items, (page-1)*ps, ps, total)
}

func (h *Handler) UpdateAgent(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateAgent")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	agentID := c.Param("id")
	var req models.UpdateAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	agent, err := h.svc.UpdateAgent(ctx, tenantID, agentID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, agent)
}

func (h *Handler) DeleteAgent(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteAgent")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	agentID := c.Param("id")
	err := h.svc.DeleteAgent(ctx, tenantID, agentID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondNoContent(c)
}

func (h *Handler) Heartbeat(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Heartbeat")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	agentID := c.Param("id")
	var req models.HeartbeatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	err := h.svc.AgentHeartbeat(ctx, tenantID, agentID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"status": "ok"})
}

// ===========================================================================
// Job Management
// ===========================================================================

func (h *Handler) CreateJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateJob")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	// Capacity check is handled inside CreateJob service; translate 503
	job, err := h.svc.CreateJob(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{
		"job_id":   job.JobID,
		"agent_id": job.AgentID,
		"status":   string(job.Status),
		"task_type": job.TaskType,
	})
}

func (h *Handler) GetJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetJob")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	jobID := c.Param("id")
	job, err := h.svc.GetJob(ctx, tenantID, jobID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, job)
}

func (h *Handler) ListJobs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListJobs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.ListJobs(ctx, tenantID, status, (page-1)*ps, ps)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if items == nil {
		items = []models.RunnerJob{}
	}
	total, _ := h.svc.CountJobs(ctx, tenantID)
	middleware.RespondPaginated(c, items, (page-1)*ps, ps, total)
}

func (h *Handler) ListJobsByAgent(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListJobsByAgent")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	agentID := c.Param("agentId")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.ListJobsByAgent(ctx, tenantID, agentID, (page-1)*ps, ps)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if items == nil {
		items = []models.RunnerJob{}
	}
	total, _ := h.svc.CountJobs(ctx, tenantID)
	middleware.RespondPaginated(c, items, (page-1)*ps, ps, total)
}

func (h *Handler) TransitionJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TransitionJob")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	jobID := c.Param("id")
	var req models.UpdateJobStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	job, err := h.svc.TransitionJob(ctx, tenantID, jobID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, job)
}

func (h *Handler) DeleteJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteJob")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	jobID := c.Param("id")
	err := h.svc.DeleteJob(ctx, tenantID, jobID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondNoContent(c)
}

func (h *Handler) ReportJobResult(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ReportJobResult")
	defer span.End()
	jobID := c.Param("id")
	result, err := h.svc.ReportJobResult(ctx, jobID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	// Return the result — the caller (platform orchestrator) performs the callback
	middleware.RespondSuccess(c, result)
}
