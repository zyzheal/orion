package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/chaos-enhanced/models"
	"orion/platform-svc-go/internal/chaos-enhanced/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all chaos-enhanced endpoints under the given group.
// Mirrors /api/v1/chaos routes from the TS source (10 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/chaos")

	// --- Experiment Management ---
	// GET /chaos/experiments - List experiments
	f.GET("/experiments", auth.RequirePermission("chaos_enhanced", "read"), h.ListExperiments)
	// POST /chaos/experiments - Create experiment
	f.POST("/experiments", auth.RequirePermission("chaos_enhanced", "write"), h.CreateExperiment)
	// GET /chaos/experiments/:id - Get experiment detail
	f.GET("/experiments/:id", auth.RequirePermission("chaos_enhanced", "read"), h.GetExperiment)
	// POST /chaos/experiments/:id/start - Start experiment
	// Mirrors /experiments/:id/run in TS (start = run)
	f.POST("/experiments/:id/start", auth.RequirePermission("chaos_enhanced", "execute"), h.StartExperiment)
	// POST /chaos/experiments/:id/inject - Inject fault
	f.POST("/experiments/:id/inject", auth.RequirePermission("chaos_enhanced", "execute"), h.InjectFault)
	// POST /chaos/experiments/:id/stop - Stop experiment
	f.POST("/experiments/:id/stop", auth.RequirePermission("chaos_enhanced", "execute"), h.StopExperiment)
	// GET /chaos/experiments/:id/status - Get experiment status
	f.GET("/experiments/:id/status", auth.RequirePermission("chaos_enhanced", "read"), h.GetExperimentStatus)
	// GET /chaos/experiments/:id/recovery - Get recovery status
	f.GET("/experiments/:id/recovery", auth.RequirePermission("chaos_enhanced", "read"), h.GetExperimentRecovery)

	// --- Fault Library ---
	// GET /chaos/faults - List fault types
	f.GET("/faults", auth.RequirePermission("chaos_enhanced", "read"), h.ListFaults)
	// POST /chaos/faults/:type/config-template - Get fault config template
	f.POST("/faults/:type/config-template", auth.RequirePermission("chaos_enhanced", "read"), h.GetConfigTemplate)
}

// getTenantID extracts tenant_id from Gin context, falling back to a zero UUID.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return ""
	}
	return tenantID
}

// --- Experiment handlers ---

func (h *Handler) ListExperiments(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListExperiments")
	defer span.End()
	tenantID := h.getTenantID(c)
	status := c.Query("status")
	environmentID := c.Query("environmentId")
	statusPtr := &status
	if status == "" {
		statusPtr = nil
	}
	envPtr := &environmentID
	if environmentID == "" {
		envPtr = nil
	}
	experiments, total, err := h.svc.ListExperiments(ctx, tenantID, statusPtr, envPtr)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:     experiments,
		Total:    total,
		Page:     1,
		PageSize: total,
	})
}

func (h *Handler) CreateExperiment(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateExperiment")
	defer span.End()
	var req models.CreateExperimentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	e, err := h.svc.CreateExperiment(ctx, &req, tenantID)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, e)
}

func (h *Handler) GetExperiment(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetExperiment")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	e, err := h.svc.GetExperiment(ctx, id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "experiment not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, e)
}

func (h *Handler) StartExperiment(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StartExperiment")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	e, err := h.svc.StartExperiment(ctx, id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "experiment not found")
			return
		}
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, e)
}

func (h *Handler) InjectFault(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InjectFault")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	var req struct {
		FaultType   string `json:"fault_type"`
		FaultConfig string `json:"fault_config"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	fi, err := h.svc.InjectFault(ctx, id, tenantID, req.FaultType, req.FaultConfig)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, fi)
}

func (h *Handler) StopExperiment(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StopExperiment")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	_, err := h.svc.StopExperiment(ctx, id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "experiment not found")
			return
		}
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"experimentId": id, "stopped": true})
}

func (h *Handler) GetExperimentStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetExperimentStatus")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	status, err := h.svc.GetExperimentStatus(ctx, id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "experiment not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, status)
}

func (h *Handler) GetExperimentRecovery(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetExperimentRecovery")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	recovery, err := h.svc.GetExperimentRecovery(ctx, id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "experiment not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, recovery)
}

// --- Fault Library handlers ---

func (h *Handler) ListFaults(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListFaults")
	defer span.End()
	faults := h.svc.AvailableFaultTypes()
	middleware.RespondSuccess(c, faults)
}

func (h *Handler) GetConfigTemplate(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetConfigTemplate")
	defer span.End()
	faultType := c.Param("type")
	template := h.svc.FaultConfigTemplate(faultType)
	middleware.RespondSuccess(c, template)
}
