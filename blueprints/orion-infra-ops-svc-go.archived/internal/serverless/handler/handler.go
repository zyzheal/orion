package handler

import (
	"strconv"

	"orion/infra-ops-svc-go/internal/serverless/models"
	"orion/infra-ops-svc-go/internal/serverless/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	serverless := rg.Group("/serverless")
	{
		// Functions CRUD
		serverless.POST("/functions", auth.RequirePermission("serverless", "write"), h.CreateFunction)
		serverless.GET("/functions", auth.RequirePermission("serverless", "read"), h.ListFunctions)
		serverless.GET("/functions/:id", auth.RequirePermission("serverless", "read"), h.GetFunction)
		serverless.PUT("/functions/:id", auth.RequirePermission("serverless", "write"), h.UpdateFunction)
		serverless.DELETE("/functions/:id", auth.RequirePermission("serverless", "write"), h.DeleteFunction)

		// Deployment
		serverless.POST("/functions/:id/deploy", auth.RequirePermission("serverless", "write"), h.DeployFunction)
		serverless.GET("/functions/:id/deployments", auth.RequirePermission("serverless", "read"), h.ListDeployments)

		// Invocation
		serverless.POST("/functions/:id/invoke", auth.RequirePermission("serverless", "write"), h.InvokeFunction)

		// Logs & Metrics
		serverless.GET("/functions/:id/logs", auth.RequirePermission("serverless", "read"), h.GetFunctionLogs)
		serverless.GET("/functions/:id/metrics", auth.RequirePermission("serverless", "read"), h.GetFunctionMetrics)
		serverless.GET("/metrics", auth.RequirePermission("serverless", "read"), h.GetAggregateMetrics)

		// Triggers
		serverless.POST("/triggers", auth.RequirePermission("serverless", "write"), h.CreateTrigger)
		serverless.GET("/triggers", auth.RequirePermission("serverless", "read"), h.ListTriggers)
		serverless.GET("/triggers/:id", auth.RequirePermission("serverless", "read"), h.GetTrigger)
		serverless.DELETE("/triggers/:id", auth.RequirePermission("serverless", "write"), h.DeleteTrigger)

		// Auto-scaling
		serverless.GET("/autoscaling", auth.RequirePermission("serverless", "read"), h.EvaluateAutoScaling)
	}
}

// ─── Function Handlers ─────────────────────────────────────────────────────────

func (h *Handler) CreateFunction(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateFunctionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	fn, err := h.svc.CreateFunction(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, fn)
}

func (h *Handler) ListFunctions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	offset := (page - 1) * ps
	if offset < 0 {
		offset = 0
	}

	items, err := h.svc.ListFunctions(c.Request.Context(), tenantID, offset, ps)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetFunction(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	fn, err := h.svc.GetFunction(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, fn)
}

func (h *Handler) UpdateFunction(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateFunctionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	fn, err := h.svc.UpdateFunction(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, fn)
}

func (h *Handler) DeleteFunction(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteFunction(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "Function deleted"})
}

// ─── Deployment Handlers ───────────────────────────────────────────────────────

func (h *Handler) DeployFunction(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.DeployFunction(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) ListDeployments(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListDeployments(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

// ─── Invocation Handler ────────────────────────────────────────────────────────

func (h *Handler) InvokeFunction(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var payload map[string]interface{}
	_ = c.ShouldBindJSON(&payload)

	result, err := h.svc.InvokeFunction(c.Request.Context(), tenantID, c.Param("id"), payload)
	if err != nil {
		if err.Error() == "FUNCTION_NOT_DEPLOYED" {
			respondBadRequest(c, "FUNCTION_NOT_DEPLOYED")
			return
		}
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// ─── Logs & Metrics Handlers ───────────────────────────────────────────────────

func (h *Handler) GetFunctionLogs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	level := c.Query("level")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	logs, err := h.svc.GetFunctionLogs(c.Request.Context(), tenantID, c.Param("id"), level, limit)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, logs)
}

func (h *Handler) GetFunctionMetrics(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	metrics, err := h.svc.GetFunctionMetrics(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, metrics)
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

// ─── Trigger Handlers ──────────────────────────────────────────────────────────

func (h *Handler) CreateTrigger(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateTriggerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	t, err := h.svc.CreateTrigger(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, t)
}

func (h *Handler) ListTriggers(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var functionID *string
	if fid := c.Query("functionId"); fid != "" {
		functionID = &fid
	}
	items, err := h.svc.ListTriggers(c.Request.Context(), tenantID, functionID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetTrigger(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	t, err := h.svc.GetTrigger(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, t)
}

func (h *Handler) DeleteTrigger(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteTrigger(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "Trigger deleted"})
}

// ─── Auto-scaling Handler ──────────────────────────────────────────────────────

func (h *Handler) EvaluateAutoScaling(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	recs, err := h.svc.EvaluateAutoScaling(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, recs)
}