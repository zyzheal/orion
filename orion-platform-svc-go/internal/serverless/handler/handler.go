package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/serverless/models"
	"orion/platform-svc-go/internal/serverless/service"

	"github.com/gin-gonic/gin"
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
	tenantID := c.GetString("tenant_id")
	var req models.CreateFunctionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	f, err := h.svc.Create(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, f)
}

func (h *Handler) GetFunction(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	f, err := h.svc.Get(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "function not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, f)
}

func (h *Handler) ListFunctions(c *gin.Context) {
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
	items, err := h.svc.List(c.Request.Context(), tenantID, q, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) UpdateFunction(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateFunctionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if _, err := h.svc.Update(c.Request.Context(), tenantID, id, req); err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "function not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "function updated"})
}

func (h *Handler) DeleteFunction(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, id); err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "function not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "function deleted"})
}

// --- Deployment handlers ---

func (h *Handler) DeployFunction(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	d, err := h.svc.Deploy(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "function not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

func (h *Handler) ListDeployments(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	items, err := h.svc.ListDeployments(c.Request.Context(), tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

// --- Invocation handler ---

func (h *Handler) InvokeFunction(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var payload gin.H
	c.ShouldBindJSON(&payload)
	result, err := h.svc.Invoke(c.Request.Context(), tenantID, id, payload)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "function not found")
			return
		}
		if err.Error() == "function not deployed" {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// --- Logs handler ---

func (h *Handler) GetFunctionLogs(c *gin.Context) {
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
	items, err := h.svc.GetLogs(c.Request.Context(), tenantID, id, q)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

// --- Metrics handlers ---

func (h *Handler) GetFunctionMetrics(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.GetMetrics(c.Request.Context(), tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) GetAggregateMetrics(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	agg, err := h.svc.GetAggregateMetrics(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, agg)
}

// --- Trigger handlers ---

func (h *Handler) CreateTrigger(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateTriggerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	t, err := h.svc.CreateTrigger(c.Request.Context(), tenantID, req)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "function not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, t)
}

func (h *Handler) GetTrigger(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	t, err := h.svc.GetTrigger(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "trigger not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, t)
}

func (h *Handler) ListTriggers(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	q := models.ListTriggersQuery{}
	if fid := c.Query("functionId"); fid != "" {
		q.FunctionID = &fid
	}
	if typ := c.Query("type"); typ != "" {
		t := models.TriggerType(typ)
		q.Type = &t
	}
	items, err := h.svc.ListTriggers(c.Request.Context(), tenantID, q)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) DeleteTrigger(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteTrigger(c.Request.Context(), tenantID, id); err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "trigger not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "trigger deleted"})
}

// --- Auto-scaling handler ---

func (h *Handler) EvaluateAutoScaling(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	recommendations, err := h.svc.EvaluateAutoScaling(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, recommendations)
}
