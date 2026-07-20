package handler

import (
	"context"
	"strconv"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/federation/models"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

// Service defines the interface used by Handler.
type Service interface {
	Create(ctx context.Context, tenantID string, req *models.CreateFederatedClusterRequest) (*models.FederatedCluster, error)
	List(ctx context.Context, tenantID string, offset, limit int) ([]models.FederatedCluster, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.FederatedCluster, error)
	Delete(ctx context.Context, tenantID, id string) error
	Update(ctx context.Context, tenantID, id string, req *models.UpdateFederatedClusterRequest) (*models.FederatedCluster, error)
	Count(ctx context.Context, tenantID string) (int, error)
	CreateFederationConfig(ctx context.Context, tenantID string, req *models.CreateFederationConfigRequest) (*models.FederationConfig, error)
	GetFederationConfig(ctx context.Context, tenantID, id string) (*models.FederationConfig, error)
	ListFederationConfigs(ctx context.Context, tenantID string) ([]models.FederationConfig, error)
	UpdateFederationConfig(ctx context.Context, tenantID, id string, req *models.UpdateFederationConfigRequest) (*models.FederationConfig, error)
	DeleteFederationConfig(ctx context.Context, tenantID, id string) error
	RegisterExecutor(ctx context.Context, tenantID string, req *models.CreateExecutorRequest) (*models.Executor, error)
	ListExecutors(ctx context.Context, tenantID string) ([]models.Executor, error)
	GetExecutorHealth(ctx context.Context, tenantID, executorID string) (*models.Executor, *models.ExecutorHealth, error)
	GetExecutorDashboard(ctx context.Context, tenantID string) (*models.ExecutorDashboard, error)
	ExecutorHeartbeat(ctx context.Context, tenantID, executorID string, req *models.ExecutorHeartbeatRequest) (*models.Executor, *models.ExecutorHealth, error)
	DeregisterExecutor(ctx context.Context, tenantID, executorID string) (bool, error)
	DispatchJob(ctx context.Context, tenantID string, req *models.DispatchJobRequest) (*models.DispatchJobResult, error)
	CreateSchedulingPolicy(ctx context.Context, tenantID string, req *models.CreateSchedulingPolicyRequest) (*models.SchedulingPolicy, error)
	ListSchedulingPolicies(ctx context.Context, tenantID string) ([]models.SchedulingPolicy, error)
	ScheduleCrossClusterJob(ctx context.Context, tenantID string, req *models.ScheduleCrossClusterJobRequest) (*models.CrossClusterJob, error)
	CreateResourcePool(ctx context.Context, tenantID string, req *models.CreateResourcePoolRequest) (*models.ResourcePool, error)
	GetResourcePoolStatus(ctx context.Context, tenantID, poolID string) (*models.ResourcePool, error)
}

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateFederation")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateFederationConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.CreateFederationConfig(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, d)
}

func (h *Handler) GetFederation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetFederation")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.GetFederationConfig(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, d)
}

func (h *Handler) ListFederations(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListFederations")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListFederationConfigs(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) UpdateFederation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateFederation")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.UpdateFederationConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.UpdateFederationConfig(ctx, tenantID, c.Param("id"), &req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, d)
}

func (h *Handler) DeleteFederation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteFederation")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	err := h.svc.DeleteFederationConfig(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"deleted": true})
}

// ---------------------------------------------------------------------------
// Executor Management
// ---------------------------------------------------------------------------

func (h *Handler) RegisterExecutor(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RegisterExecutor")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateExecutorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.RegisterExecutor(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, d)
}

func (h *Handler) ListExecutors(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListExecutors")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListExecutors(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) GetExecutorHealth(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetExecutorHealth")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	e, hlt, err := h.svc.GetExecutorHealth(ctx, tenantID, c.Param("executorId"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"executor": e, "health": hlt})
}

func (h *Handler) GetExecutorDashboard(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetExecutorDashboard")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.GetExecutorDashboard(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, d)
}

func (h *Handler) ExecutorHeartbeat(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExecutorHeartbeat")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.ExecutorHeartbeatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	e, hlt, err := h.svc.ExecutorHeartbeat(ctx, tenantID, c.Param("executorId"), &req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"executor": e, "health": hlt})
}

func (h *Handler) DeregisterExecutor(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeregisterExecutor")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ok, err := h.svc.DeregisterExecutor(ctx, tenantID, c.Param("executorId"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"deregistered": ok})
}

func (h *Handler) DispatchJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DispatchJob")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.DispatchJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.DispatchJob(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, d)
}

// ---------------------------------------------------------------------------
// Scheduling Policy
// ---------------------------------------------------------------------------

func (h *Handler) CreateSchedulingPolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateSchedulingPolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateSchedulingPolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.CreateSchedulingPolicy(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, d)
}

func (h *Handler) ListSchedulingPolicies(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListSchedulingPolicies")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	_ = tenantID
	items, err := h.svc.ListSchedulingPolicies(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

// ---------------------------------------------------------------------------
// Cross-Cluster Job
// ---------------------------------------------------------------------------

func (h *Handler) ScheduleCrossClusterJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ScheduleCrossClusterJob")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.ScheduleCrossClusterJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.ScheduleCrossClusterJob(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, d)
}

// ---------------------------------------------------------------------------
// Resource Pool
// ---------------------------------------------------------------------------

func (h *Handler) CreateResourcePool(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateResourcePool")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateResourcePoolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.CreateResourcePool(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, d)
}

func (h *Handler) GetResourcePoolStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetResourcePoolStatus")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.GetResourcePoolStatus(ctx, tenantID, c.Param("poolId"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, d)
}

// ---------------------------------------------------------------------------
// Legacy Federated Cluster CRUD (existing, kept for backward compat)
// ---------------------------------------------------------------------------

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateFederatedClusterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.Create(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, d)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	_ = ps
	items, err := h.svc.List(ctx, tenantID, (page-1)*ps, ps)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.GetByID(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, d)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.UpdateFederatedClusterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.Update(ctx, tenantID, c.Param("id"), &req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, d)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(ctx, tenantID, c.Param("id")); err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) Count(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Count")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"count": count})
}

// Sentinel error for the handler's error-checking idiom.
