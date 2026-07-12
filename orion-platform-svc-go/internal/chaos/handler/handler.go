package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/chaos/models"
	"orion/platform-svc-go/internal/chaos/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all chaos endpoints under the given group.
// Mirrors /api/v1/chaos routes from the TS source (18 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/chaos/experiments", auth.RequirePermission("chaos", "write"), h.Create)
	rg.GET("/chaos/experiments", auth.RequirePermission("chaos", "read"), h.List)
	rg.GET("/chaos/experiments/:id", auth.RequirePermission("chaos", "read"), h.Get)
	rg.PUT("/chaos/experiments/:id", auth.RequirePermission("chaos", "write"), h.Update)
	rg.POST("/chaos/experiments/:id/activate", auth.RequirePermission("chaos", "write"), h.Activate)
	rg.POST("/chaos/experiments/:id/archive", auth.RequirePermission("chaos", "delete"), h.Archive)
	rg.POST("/chaos/experiments/:id/run", auth.RequirePermission("chaos", "write"), h.Run)

	rg.GET("/chaos/runs/:runId", auth.RequirePermission("chaos", "read"), h.GetRun)
	rg.POST("/chaos/runs/:runId/rollback", auth.RequirePermission("chaos", "write"), h.Rollback)

	rg.POST("/chaos/inject/cpu-spike", auth.RequirePermission("chaos", "write"), h.CpuSpike)
	rg.POST("/chaos/inject/memory-leak", auth.RequirePermission("chaos", "write"), h.MemoryLeak)
	rg.POST("/chaos/inject/network-latency", auth.RequirePermission("chaos", "write"), h.NetworkLatency)
	rg.POST("/chaos/inject/service-down", auth.RequirePermission("chaos", "write"), h.ServiceDown)

	rg.GET("/chaos/experiments-running", auth.RequirePermission("chaos", "read"), h.GetRunning)
	rg.POST("/chaos/recover/:experimentId", auth.RequirePermission("chaos", "write"), h.Recover)
	rg.POST("/chaos/validate-recovery/:experimentId", auth.RequirePermission("chaos", "read"), h.ValidateRecovery)
	rg.GET("/chaos/recovery-report/:experimentId", auth.RequirePermission("chaos", "read"), h.RecoveryReport)
	rg.POST("/chaos/pre-release-verify", auth.RequirePermission("chaos", "write"), h.PreReleaseVerify)
}

// --- Experiment CRUD ---

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateExperimentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Create(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, m)
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.Get(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "experiment not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	status := c.Query("status")
	items, err := h.svc.List(c.Request.Context(), tenantID, status, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateExperimentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Update(c.Request.Context(), tenantID, id, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, m)
}

// --- Experiment Activation ---

// Activate handles POST /experiments/:id/activate.
func (h *Handler) Activate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.ActivateExperiment(c.Request.Context(), tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, m)
}

// Archive handles POST /experiments/:id/archive.
func (h *Handler) Archive(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.ArchiveExperiment(c.Request.Context(), tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, m)
}

// --- Experiment Execution ---

// Run handles POST /experiments/:id/run.
func (h *Handler) Run(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.RunExperimentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	run, err := h.svc.RunExperiment(c.Request.Context(), tenantID, id, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, run)
}

// GetRun handles GET /runs/:runId.
func (h *Handler) GetRun(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	runID := c.Param("runId")
	run, err := h.svc.GetRun(c.Request.Context(), tenantID, runID)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "run not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, run)
}

// Rollback handles POST /runs/:runId/rollback.
func (h *Handler) Rollback(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	runID := c.Param("runId")
	var body models.RollbackRunRequest
	c.ShouldBindJSON(&body)
	run, err := h.svc.RollbackRun(c.Request.Context(), tenantID, runID, body.Reason)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, run)
}

// --- Running Experiments ---

// GetRunning handles GET /experiments-running.
func (h *Handler) GetRunning(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.GetRunningExperiments(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"experiments": items, "total": len(items)})
}

// --- Fault Injection (Direct) ---

// CpuSpike handles POST /inject/cpu-spike.
func (h *Handler) CpuSpike(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body models.InjectRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.ExecuteCPUSpike(c.Request.Context(), tenantID, body.Target, body.Config)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, result)
}

// MemoryLeak handles POST /inject/memory-leak.
func (h *Handler) MemoryLeak(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body models.InjectRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.ExecuteMemoryLeak(c.Request.Context(), tenantID, body.Target, body.Config)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, result)
}

// NetworkLatency handles POST /inject/network-latency.
func (h *Handler) NetworkLatency(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body models.InjectRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.ExecuteNetworkLatency(c.Request.Context(), tenantID, body.Target, body.Config)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, result)
}

// ServiceDown handles POST /inject/service-down.
func (h *Handler) ServiceDown(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body models.InjectRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.ExecuteServiceDown(c.Request.Context(), tenantID, body.Target, body.Config)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, result)
}

// --- Recovery ---

// Recover handles POST /recover/:experimentId.
func (h *Handler) Recover(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	experimentID := c.Param("experimentId")
	result, err := h.svc.RecoverExperiment(c.Request.Context(), tenantID, experimentID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// ValidateRecovery handles POST /validate-recovery/:experimentId.
func (h *Handler) ValidateRecovery(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	experimentID := c.Param("experimentId")
	val, err := h.svc.ValidateRecovery(c.Request.Context(), tenantID, experimentID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, val)
}

// RecoveryReport handles GET /recovery-report/:experimentId.
func (h *Handler) RecoveryReport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	experimentID := c.Param("experimentId")
	report, err := h.svc.GenerateRecoveryReport(c.Request.Context(), tenantID, experimentID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, report)
}

// --- Pre-release Verify ---

// PreReleaseVerify handles POST /pre-release-verify.
func (h *Handler) PreReleaseVerify(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.PreReleaseVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.PreReleaseVerify(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}
