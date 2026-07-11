package handler

import (
	"net/http"
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	order, err := h.svc.CreateOrder(c.Request.Context(), &req, userID, tenantID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": order})
}

func (h *Handler) ListOrders(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	result, err := h.svc.ListOrders(c.Request.Context(), tenantID, status, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": result})
}

func (h *Handler) GetOrder(c *gin.Context) {
	order, err := h.svc.GetOrder(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": order})
}

func (h *Handler) ApproveOrder(c *gin.Context) {
	userID := c.GetString("user_id")
	order, err := h.svc.ApproveOrder(c.Request.Context(), c.Param("id"), userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": order})
}

func (h *Handler) RejectOrder(c *gin.Context) {
	order, err := h.svc.RejectOrder(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": order})
}

func (h *Handler) ExecuteOrder(c *gin.Context) {
	order, err := h.svc.ExecuteOrder(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": order})
}

// ─── Data Source Handlers ──────────────────────────────────────────────────────

func (h *Handler) CreateDataSource(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateDataSourceInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ds, err := h.svc.CreateDataSource(c.Request.Context(), &req, tenantID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": ds})
}

func (h *Handler) ListDataSources(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListDataSources(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": items})
}

func (h *Handler) GetDataSource(c *gin.Context) {
	ds, err := h.svc.GetDataSource(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": ds})
}

func (h *Handler) UpdateDataSource(c *gin.Context) {
	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ds, err := h.svc.UpdateDataSource(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": ds})
}

func (h *Handler) DeleteDataSource(c *gin.Context) {
	deleted, err := h.svc.DeleteDataSource(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	if !deleted {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "Data source deleted"})
}

func (h *Handler) TestConnection(c *gin.Context) {
	result, err := h.svc.TestConnection(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": result})
}

// ─── Audit Rule Handlers ───────────────────────────────────────────────────────

func (h *Handler) CreateAuditRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateAuditRuleInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	rule, err := h.svc.CreateAuditRule(c.Request.Context(), &req, tenantID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": rule})
}

func (h *Handler) ListAuditRules(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListAuditRules(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": items})
}

func (h *Handler) UpdateAuditRule(c *gin.Context) {
	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	rule, err := h.svc.UpdateAuditRule(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": rule})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.svc.ExecuteDirectQuery(c.Request.Context(), models.DirectQueryInput{
		DatabaseID: body.DataSourceID,
		Query:      body.SQL,
		Params:     nil,
	}, map[string]string{"userId": userID, "tenantId": tenantID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if !result.Success {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "QUERY_ERROR",
			"message": result.Error,
			"executionRecord": result.ExecutionRecord,
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": result.Data, "executionRecord": result.ExecutionRecord})
}

func (h *Handler) ListQueryLogs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	dataSourceID := c.Query("dataSourceId")
	status := c.Query("status")

	result, err := h.svc.ListQueryLogs(c.Request.Context(), tenantID, nil, page, limit, dataSourceID, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": result})
}