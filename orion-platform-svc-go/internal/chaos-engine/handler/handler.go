package handler

import (
	"orion/go-common/pkg/auth"

	chaos_enhanced_handler "orion/platform-svc-go/internal/chaos-enhanced/handler"
	chaos_enhanced_svc "orion/platform-svc-go/internal/chaos-enhanced/service"
	chaos_gateway_handler "orion/platform-svc-go/internal/chaos-gateway/handler"
	chaos_gateway_svc "orion/platform-svc-go/internal/chaos-gateway/service"
	chaos_handler "orion/platform-svc-go/internal/chaos/handler"
	chaos_svc "orion/platform-svc-go/internal/chaos/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Handler merges chaos + chaos-enhanced + chaos-gateway into a single unified API.
//
// Unified route map (all under /api/v1/chaos/):
//   Experiment CRUD:        POST/GET/PUT/DELETE /experiments[/:id]
//   Lifecycle:              POST /experiments/:id/{activate,archive,run,start,stop,pause,resume}
//   Status:                 GET  /experiments/:id/{status,recovery,results,logs}
//   Runs:                   GET/POST /runs/:runId[/rollback]
//   Injection:              POST /experiments/:id/inject, POST /inject/{cpu-spike,memory-leak,network-latency,service-down}
//   Recovery:               POST /recover/:id, POST /validate-recovery/:id, GET /recovery-report/:id
//   Library:                GET /scenarios, GET /faults, POST /faults/:type/config-template
//   Other:                  GET /experiments-running, POST /pre-release-verify, POST /schedule

type Handler struct {
	chaosH    *chaos_handler.Handler
	enhancedH *chaos_enhanced_handler.Handler
	gatewayH  *chaos_gateway_handler.Handler
}

// NewHandler creates the unified chaos-engine handler. Pass nil for unavailable services.
func NewHandler(
	chaosSvc chaos_svc.ServiceInterface,
	enhancedSvc chaos_enhanced_svc.ServiceInterface,
	gatewaySvc chaos_gateway_svc.ServiceInterface,
) *Handler {
	h := &Handler{}
	if chaosSvc != nil {
		h.chaosH = chaos_handler.NewHandler(chaosSvc)
	}
	if enhancedSvc != nil {
		h.enhancedH = chaos_enhanced_handler.NewHandler(enhancedSvc)
	}
	if gatewaySvc != nil {
		h.gatewayH = chaos_gateway_handler.NewHandler(gatewaySvc)
	}
	return h
}

// RegisterRoutes mounts all unified chaos-engine endpoints under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	ch := rg.Group("/chaos")

	// --- Experiment CRUD ---
	if h.chaosH != nil {
		ch.POST("/experiments", auth.RequirePermission("chaos", "write"), h.chaosH.Create)
		ch.GET("/experiments", auth.RequirePermission("chaos", "read"), h.chaosH.List)
		ch.GET("/experiments/:id", auth.RequirePermission("chaos", "read"), h.chaosH.Get)
		ch.PUT("/experiments/:id", auth.RequirePermission("chaos", "write"), h.chaosH.Update)
	}
	if h.gatewayH != nil {
		ch.DELETE("/experiments/:id", auth.RequirePermission("chaos", "delete"), h.deleteExperiment)
	}

	// --- Experiment lifecycle ---
	if h.chaosH != nil {
		ch.POST("/experiments/:id/activate", auth.RequirePermission("chaos", "write"), h.chaosH.Activate)
		ch.POST("/experiments/:id/archive", auth.RequirePermission("chaos", "delete"), h.chaosH.Archive)
		ch.POST("/experiments/:id/run", auth.RequirePermission("chaos", "write"), h.chaosH.Run)
	}
	if h.enhancedH != nil {
		ch.POST("/experiments/:id/start", auth.RequirePermission("chaos", "execute"), h.enhancedH.StartExperiment)
		ch.POST("/experiments/:id/stop", auth.RequirePermission("chaos", "execute"), h.enhancedH.StopExperiment)
		ch.GET("/experiments/:id/status", auth.RequirePermission("chaos", "read"), h.enhancedH.GetExperimentStatus)
		ch.GET("/experiments/:id/recovery", auth.RequirePermission("chaos", "read"), h.enhancedH.GetExperimentRecovery)
		ch.POST("/experiments/:id/inject", auth.RequirePermission("chaos", "execute"), h.enhancedH.InjectFault)
	}
	if h.gatewayH != nil {
		ch.POST("/experiments/:id/pause", auth.RequirePermission("chaos", "write"), h.pauseExperiment)
		ch.POST("/experiments/:id/resume", auth.RequirePermission("chaos", "write"), h.resumeExperiment)
		ch.GET("/experiments/:id/results", auth.RequirePermission("chaos", "read"), h.getResults)
		ch.GET("/experiments/:id/logs", auth.RequirePermission("chaos", "read"), h.getLogs)
	}

	// --- Experiment runs ---
	if h.chaosH != nil {
		ch.GET("/runs/:runId", auth.RequirePermission("chaos", "read"), h.chaosH.GetRun)
		ch.POST("/runs/:runId/rollback", auth.RequirePermission("chaos", "write"), h.chaosH.Rollback)
	}

	// --- Direct fault injection ---
	if h.chaosH != nil {
		ch.POST("/inject/cpu-spike", auth.RequirePermission("chaos", "write"), h.chaosH.CpuSpike)
		ch.POST("/inject/memory-leak", auth.RequirePermission("chaos", "write"), h.chaosH.MemoryLeak)
		ch.POST("/inject/network-latency", auth.RequirePermission("chaos", "write"), h.chaosH.NetworkLatency)
		ch.POST("/inject/service-down", auth.RequirePermission("chaos", "write"), h.chaosH.ServiceDown)
	}

	// --- Recovery ---
	if h.chaosH != nil {
		ch.POST("/recover/:experimentId", auth.RequirePermission("chaos", "write"), h.chaosH.Recover)
		ch.POST("/validate-recovery/:experimentId", auth.RequirePermission("chaos", "read"), h.chaosH.ValidateRecovery)
		ch.GET("/recovery-report/:experimentId", auth.RequirePermission("chaos", "read"), h.chaosH.RecoveryReport)
	}

	// --- Scenarios & fault library ---
	if h.gatewayH != nil {
		ch.GET("/scenarios", auth.RequirePermission("chaos", "read"), h.gatewayH.GetScenarios)
	}
	if h.enhancedH != nil {
		ch.GET("/faults", auth.RequirePermission("chaos", "read"), h.enhancedH.ListFaults)
		ch.POST("/faults/:type/config-template", auth.RequirePermission("chaos", "read"), h.enhancedH.GetConfigTemplate)
	}

	// --- Other ---
	if h.chaosH != nil {
		ch.GET("/experiments-running", auth.RequirePermission("chaos", "read"), h.chaosH.GetRunning)
		ch.POST("/pre-release-verify", auth.RequirePermission("chaos", "write"), h.chaosH.PreReleaseVerify)
	}
	if h.gatewayH != nil {
		ch.POST("/schedule", auth.RequirePermission("chaos", "write"), h.scheduleExperiment)
	}
}

// --- Adapters: gateway handlers expect /:id param; our routes use /experiments/:id ---

func (h *Handler) deleteExperiment(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ChaosEngDeleteExperiment")
	defer span.End()
	h.gatewayH.DeleteExperiment(c)
}

func (h *Handler) pauseExperiment(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ChaosEngPauseExperiment")
	defer span.End()
	h.gatewayH.PauseExperiment(c)
}

func (h *Handler) resumeExperiment(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ChaosEngResumeExperiment")
	defer span.End()
	h.gatewayH.ResumeExperiment(c)
}

func (h *Handler) getResults(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ChaosEngGetResults")
	defer span.End()
	h.gatewayH.GetResults(c)
}

func (h *Handler) getLogs(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ChaosEngGetLogs")
	defer span.End()
	h.gatewayH.GetLogs(c)
}

func (h *Handler) scheduleExperiment(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ChaosEngScheduleExperiment")
	defer span.End()
	h.gatewayH.ScheduleExperiment(c)
}
