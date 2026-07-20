package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/serverless/models"
	"orion/platform-svc-go/internal/serverless/service"

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

// RegisterRoutes registers all serverless endpoints under the given group.
// Mirrors /api/v1/serverless routes from the TS source (16 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	s := rg.Group("/serverless")

	// --- Functions CRUD ---
	// GET /serverless/functions - List functions
	s.GET("/functions", auth.RequirePermission("serverless", "read"), h.ListFunctions)
	// POST /serverless/functions - Create function
	s.POST("/functions", auth.RequirePermission("serverless", "write"), h.CreateFunction)
	// GET /serverless/functions/:id - Get function
	s.GET("/functions/:id", auth.RequirePermission("serverless", "read"), h.GetFunction)
	// PUT /serverless/functions/:id - Update function
	s.PUT("/functions/:id", auth.RequirePermission("serverless", "write"), h.UpdateFunction)
	// DELETE /serverless/functions/:id - Delete function
	s.DELETE("/functions/:id", auth.RequirePermission("serverless", "delete"), h.DeleteFunction)

	// --- Deployment ---
	// POST /serverless/functions/:id/deploy - Deploy function
	s.POST("/functions/:id/deploy", auth.RequirePermission("serverless", "write"), h.DeployFunction)
	// GET /serverless/functions/:id/deployments - List deployments
	s.GET("/functions/:id/deployments", auth.RequirePermission("serverless", "read"), h.ListDeployments)

	// --- Invocation ---
	// POST /serverless/functions/:id/invoke - Invoke function
	s.POST("/functions/:id/invoke", auth.RequirePermission("serverless", "write"), h.InvokeFunction)

	// --- Logs ---
	// GET /serverless/functions/:id/logs - Get function logs
	s.GET("/functions/:id/logs", auth.RequirePermission("serverless", "read"), h.GetFunctionLogs)

	// --- Metrics ---
	// GET /serverless/functions/:id/metrics - Get function metrics
	s.GET("/functions/:id/metrics", auth.RequirePermission("serverless", "read"), h.GetFunctionMetrics)
	// GET /serverless/metrics - Aggregate metrics
	s.GET("/metrics", auth.RequirePermission("serverless", "read"), h.GetAggregateMetrics)

	// --- Triggers ---
	// GET /serverless/triggers - List triggers
	s.GET("/triggers", auth.RequirePermission("serverless", "read"), h.ListTriggers)
	// POST /serverless/triggers - Create trigger
	s.POST("/triggers", auth.RequirePermission("serverless", "write"), h.CreateTrigger)
	// GET /serverless/triggers/:id - Get trigger
	s.GET("/triggers/:id", auth.RequirePermission("serverless", "read"), h.GetTrigger)
	// DELETE /serverless/triggers/:id - Delete trigger
	s.DELETE("/triggers/:id", auth.RequirePermission("serverless", "delete"), h.DeleteTrigger)

	// --- Auto-scaling ---
	// GET /serverless/autoscaling - Auto-scaling recommendations
	s.GET("/autoscaling", auth.RequirePermission("serverless", "read"), h.EvaluateAutoScaling)
}

// --- Functions handlers ---

func (h *Handler) CreateFunction(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateFunction")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateFunctionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	f, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, f)
}

func (h *Handler) GetFunction(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetFunction")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	f, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "function not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, f)
}

func (h *Handler) ListFunctions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListFunctions")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	q := models.ListFunctionsQuery{}
	if status := c.Query("status"); status != "" {
		s := models.FunctionStatus(status)
		q.Status = &s
	}
	if runtime := c.Query("runtime"); runtime != "" {
		r := models.FunctionRuntime(runtime)
		q.Runtime = &r
	}
	items, err := h.svc.List(ctx, tenantID, q, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) UpdateFunction(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateFunction")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateFunctionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if _, err := h.svc.Update(ctx, tenantID, id, req); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "function not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "function updated"})
}

func (h *Handler) DeleteFunction(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteFunction")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Delete(ctx, tenantID, id); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "function not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "function deleted"})
}

// --- Deployment handlers ---

func (h *Handler) DeployFunction(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeployFunction")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	d, err := h.svc.Deploy(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "function not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, d)
}

func (h *Handler) ListDeployments(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListDeployments")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	items, err := h.svc.ListDeployments(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

// --- Invocation handler ---

func (h *Handler) InvokeFunction(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InvokeFunction")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var payload gin.H
	c.ShouldBindJSON(&payload)
	result, err := h.svc.Invoke(ctx, tenantID, id, payload)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "function not found")
			return
		}
		if err.Error() == "function not deployed" {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// --- Logs handler ---

func (h *Handler) GetFunctionLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetFunctionLogs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	q := models.GetFunctionLogsQuery{}
	if level := c.Query("level"); level != "" {
		q.Level = &level
	}
	if limitStr := c.Query("limit"); limitStr != "" {
		limit, _ := strconv.Atoi(limitStr)
		if limit > 0 {
			q.Limit = &limit
		}
	}
	items, err := h.svc.GetLogs(ctx, tenantID, id, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

// --- Metrics handlers ---

func (h *Handler) GetFunctionMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetFunctionMetrics")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.GetMetrics(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) GetAggregateMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAggregateMetrics")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	agg, err := h.svc.GetAggregateMetrics(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, agg)
}

// --- Trigger handlers ---

func (h *Handler) CreateTrigger(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateTrigger")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateTriggerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	t, err := h.svc.CreateTrigger(ctx, tenantID, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "function not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, t)
}

func (h *Handler) GetTrigger(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTrigger")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	t, err := h.svc.GetTrigger(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "trigger not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, t)
}

func (h *Handler) ListTriggers(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListTriggers")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	q := models.ListTriggersQuery{}
	if fid := c.Query("functionId"); fid != "" {
		q.FunctionID = &fid
	}
	if typ := c.Query("type"); typ != "" {
		t := models.TriggerType(typ)
		q.Type = &t
	}
	items, err := h.svc.ListTriggers(ctx, tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) DeleteTrigger(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteTrigger")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteTrigger(ctx, tenantID, id); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "trigger not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "trigger deleted"})
}

// --- Auto-scaling handler ---

func (h *Handler) EvaluateAutoScaling(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EvaluateAutoScaling")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	recommendations, err := h.svc.EvaluateAutoScaling(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, recommendations)
}
