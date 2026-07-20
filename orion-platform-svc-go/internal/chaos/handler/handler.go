package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/chaos/models"
	"orion/platform-svc-go/internal/chaos/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel/trace"
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateExperimentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, m)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "experiment not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	status := c.Query("status")
	items, err := h.svc.List(ctx, tenantID, status, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateExperimentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Update(ctx, tenantID, id, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

// --- Experiment Activation ---

// Activate handles POST /experiments/:id/activate.
func (h *Handler) Activate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Activate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.ActivateExperiment(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

// Archive handles POST /experiments/:id/archive.
func (h *Handler) Archive(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Archive")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.ArchiveExperiment(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

// --- Experiment Execution ---

// Run handles POST /experiments/:id/run.
func (h *Handler) Run(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Run")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.RunExperimentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	run, err := h.svc.RunExperiment(ctx, tenantID, id, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, run)
}

// GetRun handles GET /runs/:runId.
func (h *Handler) GetRun(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRun")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	runID := c.Param("runId")
	run, err := h.svc.GetRun(ctx, tenantID, runID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "run not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, run)
}

// Rollback handles POST /runs/:runId/rollback.
func (h *Handler) Rollback(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Rollback")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	runID := c.Param("runId")
	var body models.RollbackRunRequest
	c.ShouldBindJSON(&body)
	run, err := h.svc.RollbackRun(ctx, tenantID, runID, body.Reason)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, run)
}

// --- Running Experiments ---

// GetRunning handles GET /experiments-running.
func (h *Handler) GetRunning(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRunning")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.GetRunningExperiments(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"experiments": items, "total": len(items)})
}

// --- Fault Injection (Direct) ---

// CpuSpike handles POST /inject/cpu-spike.
func (h *Handler) CpuSpike(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CpuSpike")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var body models.InjectRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.ExecuteCPUSpike(ctx, tenantID, body.Target, body.Config)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

// MemoryLeak handles POST /inject/memory-leak.
func (h *Handler) MemoryLeak(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MemoryLeak")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var body models.InjectRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.ExecuteMemoryLeak(ctx, tenantID, body.Target, body.Config)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

// NetworkLatency handles POST /inject/network-latency.
func (h *Handler) NetworkLatency(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "NetworkLatency")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var body models.InjectRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.ExecuteNetworkLatency(ctx, tenantID, body.Target, body.Config)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

// ServiceDown handles POST /inject/service-down.
func (h *Handler) ServiceDown(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ServiceDown")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var body models.InjectRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.ExecuteServiceDown(ctx, tenantID, body.Target, body.Config)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

// --- Recovery ---

// Recover handles POST /recover/:experimentId.
func (h *Handler) Recover(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Recover")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	experimentID := c.Param("experimentId")
	result, err := h.svc.RecoverExperiment(ctx, tenantID, experimentID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// ValidateRecovery handles POST /validate-recovery/:experimentId.
func (h *Handler) ValidateRecovery(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ValidateRecovery")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	experimentID := c.Param("experimentId")
	val, err := h.svc.ValidateRecovery(ctx, tenantID, experimentID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, val)
}

// RecoveryReport handles GET /recovery-report/:experimentId.
func (h *Handler) RecoveryReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RecoveryReport")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	experimentID := c.Param("experimentId")
	report, err := h.svc.GenerateRecoveryReport(ctx, tenantID, experimentID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, report)
}

// --- Pre-release Verify ---

// PreReleaseVerify handles POST /pre-release-verify.
func (h *Handler) PreReleaseVerify(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PreReleaseVerify")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.PreReleaseVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.PreReleaseVerify(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}
