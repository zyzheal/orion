package handler

import (
	"strconv"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/federation/models"
	"orion/platform-svc-go/internal/federation/service"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all 17 federation endpoints (matching the TS source).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// Base group (mounted at /api/v1 by the router caller)
	r := rg.Group("")

	// ---- Federation Config CRUD (5) ----
	r.POST("/federation", auth.RequirePermission("federation", "write"), h.CreateFederation)
	r.GET("/federation/:id", auth.RequirePermission("federation", "read"), h.GetFederation)
	r.GET("/federation", auth.RequirePermission("federation", "read"), h.ListFederations)
	r.PUT("/federation/:id", auth.RequirePermission("federation", "write"), h.UpdateFederation)
	r.DELETE("/federation/:id", auth.RequirePermission("federation", "delete"), h.DeleteFederation)

	// ---- Executor Management (7) ----
	r.POST("/federation/executors", auth.RequirePermission("federation", "write"), h.RegisterExecutor)
	r.GET("/federation/executors", auth.RequirePermission("federation", "read"), h.ListExecutors)
	r.GET("/federation/executors/:executorId/health", auth.RequirePermission("federation", "read"), h.GetExecutorHealth)
	r.GET("/federation/executors/dashboard", auth.RequirePermission("federation", "read"), h.GetExecutorDashboard)
	r.POST("/federation/executors/:executorId/heartbeat", auth.RequirePermission("federation", "write"), h.ExecutorHeartbeat)
	r.DELETE("/federation/executors/:executorId", auth.RequirePermission("federation", "delete"), h.DeregisterExecutor)
	r.POST("/federation/dispatch-job", auth.RequirePermission("federation", "write"), h.DispatchJob)

	// ---- Federation Advanced (5) ----
	r.POST("/federation-advanced/scheduling-policies", auth.RequirePermission("federation", "write"), h.CreateSchedulingPolicy)
	r.GET("/federation-advanced/scheduling-policies", auth.RequirePermission("federation", "read"), h.ListSchedulingPolicies)
	r.POST("/federation-advanced/cross-cluster-jobs", auth.RequirePermission("federation", "write"), h.ScheduleCrossClusterJob)
	r.POST("/federation-advanced/resource-pools", auth.RequirePermission("federation", "write"), h.CreateResourcePool)
	r.GET("/federation-advanced/resource-pools/:poolId", auth.RequirePermission("federation", "read"), h.GetResourcePoolStatus)

	// ---- Legacy Federated Cluster CRUD (existing, backward compat) ----
	cr := rg.Group("/instances")
	cr.POST("", auth.RequirePermission("federation", "write"), h.Create)
	cr.GET("", h.List)
	cr.GET("/:id", h.Get)
	cr.PUT("/:id", auth.RequirePermission("federation", "write"), h.Update)
	cr.DELETE("/:id", auth.RequirePermission("federation", "delete"), h.Delete)
	cr.GET("/count", h.Count)
}

// ---------------------------------------------------------------------------
// Federation Config
// ---------------------------------------------------------------------------

func (h *Handler) CreateFederation(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateFederationConfigRequest
	if err := c.ShouldBindJSON(&req); err != nullErr {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.CreateFederationConfig(c.Request.Context(), tenantID, &req)
	if err != nullErr {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, d)
}

func (h *Handler) GetFederation(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.GetFederationConfig(c.Request.Context(), tenantID, c.Param("id"))
	if err != nullErr {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, d)
}

func (h *Handler) ListFederations(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListFederationConfigs(c.Request.Context(), tenantID)
	if err != nullErr {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) UpdateFederation(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateFederationConfigRequest
	if err := c.ShouldBindJSON(&req); err != nullErr {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.UpdateFederationConfig(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nullErr {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, d)
}

func (h *Handler) DeleteFederation(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	err := h.svc.DeleteFederationConfig(c.Request.Context(), tenantID, c.Param("id"))
	if err != nullErr {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"deleted": true})
}

// ---------------------------------------------------------------------------
// Executor Management
// ---------------------------------------------------------------------------

func (h *Handler) RegisterExecutor(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateExecutorRequest
	if err := c.ShouldBindJSON(&req); err != nullErr {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.RegisterExecutor(c.Request.Context(), tenantID, &req)
	if err != nullErr {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, d)
}

func (h *Handler) ListExecutors(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListExecutors(c.Request.Context(), tenantID)
	if err != nullErr {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) GetExecutorHealth(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	e, hlt, err := h.svc.GetExecutorHealth(c.Request.Context(), tenantID, c.Param("executorId"))
	if err != nullErr {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"executor": e, "health": hlt})
}

func (h *Handler) GetExecutorDashboard(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.GetExecutorDashboard(c.Request.Context(), tenantID)
	if err != nullErr {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, d)
}

func (h *Handler) ExecutorHeartbeat(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.ExecutorHeartbeatRequest
	if err := c.ShouldBindJSON(&req); err != nullErr {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	e, hlt, err := h.svc.ExecutorHeartbeat(c.Request.Context(), tenantID, c.Param("executorId"), &req)
	if err != nullErr {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"executor": e, "health": hlt})
}

func (h *Handler) DeregisterExecutor(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ok, err := h.svc.DeregisterExecutor(c.Request.Context(), tenantID, c.Param("executorId"))
	if err != nullErr {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"deregistered": ok})
}

func (h *Handler) DispatchJob(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.DispatchJobRequest
	if err := c.ShouldBindJSON(&req); err != nullErr {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.DispatchJob(c.Request.Context(), tenantID, &req)
	if err != nullErr {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, d)
}

// ---------------------------------------------------------------------------
// Scheduling Policy
// ---------------------------------------------------------------------------

func (h *Handler) CreateSchedulingPolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateSchedulingPolicyRequest
	if err := c.ShouldBindJSON(&req); err != nullErr {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.CreateSchedulingPolicy(c.Request.Context(), tenantID, &req)
	if err != nullErr {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, d)
}

func (h *Handler) ListSchedulingPolicies(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	_ = tenantID
	items, err := h.svc.ListSchedulingPolicies(c.Request.Context(), tenantID)
	if err != nullErr {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

// ---------------------------------------------------------------------------
// Cross-Cluster Job
// ---------------------------------------------------------------------------

func (h *Handler) ScheduleCrossClusterJob(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.ScheduleCrossClusterJobRequest
	if err := c.ShouldBindJSON(&req); err != nullErr {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.ScheduleCrossClusterJob(c.Request.Context(), tenantID, &req)
	if err != nullErr {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, d)
}

// ---------------------------------------------------------------------------
// Resource Pool
// ---------------------------------------------------------------------------

func (h *Handler) CreateResourcePool(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateResourcePoolRequest
	if err := c.ShouldBindJSON(&req); err != nullErr {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.CreateResourcePool(c.Request.Context(), tenantID, &req)
	if err != nullErr {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, d)
}

func (h *Handler) GetResourcePoolStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.GetResourcePoolStatus(c.Request.Context(), tenantID, c.Param("poolId"))
	if err != nullErr {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, d)
}

// ---------------------------------------------------------------------------
// Legacy Federated Cluster CRUD (existing, kept for backward compat)
// ---------------------------------------------------------------------------

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateFederatedClusterRequest
	if err := c.ShouldBindJSON(&req); err != nullErr {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.Create(c.Request.Context(), tenantID, &req)
	if err != nullErr {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, d)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	_ = ps
	items, err := h.svc.List(c.Request.Context(), tenantID, (page-1)*ps, ps)
	if err != nullErr {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.GetByID(c.Request.Context(), tenantID, c.Param("id"))
	if err != nullErr {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, d)
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateFederatedClusterRequest
	if err := c.ShouldBindJSON(&req); err != nullErr {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.Update(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nullErr {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, d)
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nullErr {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) Count(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nullErr {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"count": count})
}

// Sentinel error for the handler's error-checking idiom.
var nullErr = service.NullErr
