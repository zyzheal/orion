package handler

import (
	"strconv"
	"time"

	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/worker-dispatcher/models"
	"orion/platform-svc-go/internal/worker-dispatcher/service"

	"github.com/gin-gonic/gin"
	"orion/go-common/pkg/auth"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.WorkerDispatcher
}

func NewHandler(svc *service.WorkerDispatcher) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all worker-dispatcher endpoints under /api/v1/worker.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/worker")

	// --- Policies ---
	f.POST("/policies", auth.RequirePermission("worker", "write"), h.CreatePolicy)
	f.GET("/policies", auth.RequirePermission("worker", "read"), h.ListPolicies)
	f.GET("/policies/:id", auth.RequirePermission("worker", "read"), h.GetPolicy)
	f.PUT("/policies/:id", auth.RequirePermission("worker", "write"), h.UpdatePolicy)
	f.DELETE("/policies/:id", auth.RequirePermission("worker", "write"), h.DeletePolicy)

	// --- Capabilities ---
	f.POST("/capabilities", auth.RequirePermission("worker", "write"), h.CreateCapability)
	f.GET("/capabilities", auth.RequirePermission("worker", "read"), h.ListCapabilities)
	f.GET("/capabilities/:workerId", auth.RequirePermission("worker", "read"), h.GetCapabilitiesByWorker)
	f.DELETE("/capabilities/:workerId", auth.RequirePermission("worker", "write"), h.DeleteCapability)

	// --- Dispatch ---
	f.POST("/dispatch", auth.RequirePermission("worker", "write"), h.Dispatch)

	// --- Assignments ---
	f.GET("/assignments/:targetId", auth.RequirePermission("worker", "read"), h.GetAssignment)
	f.POST("/assignments/:id/complete", auth.RequirePermission("worker", "write"), h.CompleteAssignment)

	// --- Load ---
	f.GET("/load/:workerId", auth.RequirePermission("worker", "read"), h.GetWorkerLoad)
}

// --- Policies ---

func (h *Handler) CreatePolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "worker-dispatcher.CreatePolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.CreatePolicy(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, m)
}

func (h *Handler) ListPolicies(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "worker-dispatcher.ListPolicies")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	policyType := c.Query("type")
	enabled := c.Query("enabled")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.ListPolicies(ctx, tenantID, policyType, enabled, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) GetPolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "worker-dispatcher.GetPolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.GetPolicy(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "policy not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) UpdatePolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "worker-dispatcher.UpdatePolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.UpdatePolicy(ctx, tenantID, id, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) DeletePolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "worker-dispatcher.DeletePolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if _, err := h.svc.GetPolicy(ctx, tenantID, id); err != nil {
		middleware.RespondNotFound(c, "policy not found")
		return
	}
	// NOTE: DeletePolicy not exposed via service; stub for handler.
	middleware.RespondSuccess(c, gin.H{"message": "policy deletion supported via direct repo call"})
}

// --- Capabilities ---

func (h *Handler) CreateCapability(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "worker-dispatcher.CreateCapability")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateCapabilityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.CreateCapability(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, m)
}

func (h *Handler) ListCapabilities(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "worker-dispatcher.ListCapabilities")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.GetCapabilities(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) GetCapabilitiesByWorker(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "worker-dispatcher.GetCapabilitiesByWorker")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	workerID := c.Param("workerId")
	items, err := h.svc.GetCapabilitiesByWorker(ctx, tenantID, workerID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) DeleteCapability(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "worker-dispatcher.DeleteCapability")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	workerID := c.Param("workerId")
	skill := c.Query("skill")
	if skill == "" {
		middleware.RespondBadRequest(c, "skill query parameter required")
		return
	}
	if err := h.svc.DeleteCapability(ctx, tenantID, workerID, skill); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "capability deleted", "worker_id": workerID, "skill": skill})
}

// --- Dispatch ---

func (h *Handler) Dispatch(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "worker-dispatcher.Dispatch")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.DispatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	assignment, err := h.svc.Dispatch(ctx, tenantID, req.TargetType, req.TargetID, req.PolicyType, req.Context)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, assignment)
}

// --- Assignments ---

func (h *Handler) GetAssignment(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "worker-dispatcher.GetAssignment")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	targetID := c.Param("targetId")
	m, err := h.svc.GetAssignment(ctx, tenantID, targetID)
	if err != nil {
		middleware.RespondNotFound(c, "assignment not found")
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) CompleteAssignment(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "worker-dispatcher.CompleteAssignment")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	completedAt := time.Now().UTC()
	if err := h.svc.UpdateAssignmentStatus(ctx, tenantID, id, "completed", &completedAt); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "assignment completed"})
}

// --- Load ---

func (h *Handler) GetWorkerLoad(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "worker-dispatcher.GetWorkerLoad")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	workerID := c.Param("workerId")
	load := h.svc.GetWorkerLoad(ctx, tenantID, workerID)
	middleware.RespondSuccess(c, gin.H{"worker_id": workerID, "current_load": load})
}
