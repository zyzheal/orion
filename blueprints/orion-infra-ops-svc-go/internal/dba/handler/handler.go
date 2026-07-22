package handler

import (
	"strconv"

	"orion/infra-ops-svc-go/internal/dba/models"
	"orion/infra-ops-svc-go/internal/dba/service"

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
	dba := rg.Group("/dba")
	{
		// SQL Orders
		dba.GET("/orders", auth.RequirePermission("dba", "read"), h.ListOrders)
		dba.POST("/orders", auth.RequirePermission("dba", "write"), h.CreateOrder)
		dba.GET("/orders/:id", auth.RequirePermission("dba", "read"), h.GetOrder)
		dba.POST("/orders/:id/approve", auth.RequirePermission("dba", "approve"), h.ApproveOrder)
		dba.POST("/orders/:id/reject", auth.RequirePermission("dba", "approve"), h.RejectOrder)
		dba.POST("/orders/:id/execute", auth.RequirePermission("dba", "execute"), h.ExecuteOrder)

		// Data Sources
		dba.GET("/datasources", auth.RequirePermission("dba", "read"), h.ListDataSources)
		dba.POST("/datasources", auth.RequirePermission("dba", "write"), h.CreateDataSource)
		dba.GET("/datasources/:id", auth.RequirePermission("dba", "read"), h.GetDataSource)
		dba.PUT("/datasources/:id", auth.RequirePermission("dba", "write"), h.UpdateDataSource)
		dba.DELETE("/datasources/:id", auth.RequirePermission("dba", "write"), h.DeleteDataSource)
		dba.POST("/datasources/:id/test", auth.RequirePermission("dba", "write"), h.TestConnection)

		// Audit Rules
		dba.GET("/audit-rules", auth.RequirePermission("dba", "read"), h.ListAuditRules)
		dba.POST("/audit-rules", auth.RequirePermission("dba", "write"), h.CreateAuditRule)
		dba.PUT("/audit-rules/:id", auth.RequirePermission("dba", "write"), h.UpdateAuditRule)

		// Direct Query
		dba.POST("/query", auth.RequirePermission("dba", "execute"), h.ExecuteDirectQuery)
		dba.GET("/query-logs", auth.RequirePermission("dba", "read"), h.ListQueryLogs)
	}
}

// ─── Order Handlers ────────────────────────────────────────────────────────────

func (h *Handler) CreateOrder(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.CreateOrderInput
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	order, err := h.svc.CreateOrder(c.Request.Context(), &req, userID, tenantID)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, order)
}

func (h *Handler) ListOrders(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	result, err := h.svc.ListOrders(c.Request.Context(), tenantID, status, page, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) GetOrder(c *gin.Context) {
	order, err := h.svc.GetOrder(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, order)
}

func (h *Handler) ApproveOrder(c *gin.Context) {
	userID := c.GetString("user_id")
	order, err := h.svc.ApproveOrder(c.Request.Context(), c.Param("id"), userID)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, order)
}

func (h *Handler) RejectOrder(c *gin.Context) {
	order, err := h.svc.RejectOrder(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, order)
}

func (h *Handler) ExecuteOrder(c *gin.Context) {
	order, err := h.svc.ExecuteOrder(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, order)
}

// ─── Data Source Handlers ──────────────────────────────────────────────────────

func (h *Handler) CreateDataSource(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateDataSourceInput
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	ds, err := h.svc.CreateDataSource(c.Request.Context(), &req, tenantID)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, ds)
}

func (h *Handler) ListDataSources(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListDataSources(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetDataSource(c *gin.Context) {
	ds, err := h.svc.GetDataSource(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, ds)
}

func (h *Handler) UpdateDataSource(c *gin.Context) {
	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	ds, err := h.svc.UpdateDataSource(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, ds)
}

func (h *Handler) DeleteDataSource(c *gin.Context) {
	deleted, err := h.svc.DeleteDataSource(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	if !deleted {
		respondNotFound(c, "not found")
		return
	}
	respondSuccess(c, gin.H{"message": "Data source deleted"})
}

func (h *Handler) TestConnection(c *gin.Context) {
	result, err := h.svc.TestConnection(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// ─── Audit Rule Handlers ───────────────────────────────────────────────────────

func (h *Handler) CreateAuditRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateAuditRuleInput
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	rule, err := h.svc.CreateAuditRule(c.Request.Context(), &req, tenantID)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, rule)
}

func (h *Handler) ListAuditRules(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListAuditRules(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) UpdateAuditRule(c *gin.Context) {
	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	rule, err := h.svc.UpdateAuditRule(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, rule)
}

// ─── Direct Query Handlers ─────────────────────────────────────────────────────

func (h *Handler) ExecuteDirectQuery(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")

	var body struct {
		DataSourceID string `json:"dataSourceId"`
		SQL          string `json:"sql" binding:"required"`
		Database     string `json:"database"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	result, err := h.svc.ExecuteDirectQuery(c.Request.Context(), models.DirectQueryInput{
		DatabaseID: body.DataSourceID,
		Query:      body.SQL,
		Params:     nil,
	}, map[string]string{"userId": userID, "tenantId": tenantID})
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if !result.Success {
		respondBadRequest(c, result.Error)
		return
	}
	respondSuccess(c, gin.H{"data": result.Data, "executionRecord": result.ExecutionRecord})
}

func (h *Handler) ListQueryLogs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	dataSourceID := c.Query("dataSourceId")
	status := c.Query("status")

	result, err := h.svc.ListQueryLogs(c.Request.Context(), tenantID, nil, page, limit, dataSourceID, status)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}