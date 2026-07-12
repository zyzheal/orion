package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/dba/models"
	"orion/platform-svc-go/internal/dba/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all DBA endpoints under the given group.
// Mirrors /api/v1/dba routes from the TS source (17 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/dba")

	// --- SQL Orders ---
	// GET /dba/orders - list orders
	f.GET("/orders", auth.RequirePermission("dba", "read"), h.ListOrders)
	// GET /dba/orders/:id - get order
	f.GET("/orders/:id", auth.RequirePermission("dba", "read"), h.GetOrder)
	// POST /dba/orders - create order
	f.POST("/orders", auth.RequirePermission("dba", "write"), h.CreateOrder)
	// POST /dba/orders/:id/approve - approve order
	f.POST("/orders/:id/approve", auth.RequirePermission("dba", "approve"), h.ApproveOrder)
	// POST /dba/orders/:id/reject - reject order
	f.POST("/orders/:id/reject", auth.RequirePermission("dba", "approve"), h.RejectOrder)
	// POST /dba/orders/:id/execute - execute order
	f.POST("/orders/:id/execute", auth.RequirePermission("dba", "execute"), h.ExecuteOrder)

	// --- Data Sources ---
	// GET /dba/datasources - list data sources
	f.GET("/datasources", auth.RequirePermission("dba", "read"), h.ListDataSources)
	// GET /dba/datasources/:id - get data source
	f.GET("/datasources/:id", auth.RequirePermission("dba", "read"), h.GetDataSource)
	// POST /dba/datasources - create data source
	f.POST("/datasources", auth.RequirePermission("dba", "write"), h.CreateDataSource)
	// PUT /dba/datasources/:id - update data source
	f.PUT("/datasources/:id", auth.RequirePermission("dba", "write"), h.UpdateDataSource)
	// DELETE /dba/datasources/:id - delete data source
	f.DELETE("/datasources/:id", auth.RequirePermission("dba", "delete"), h.DeleteDataSource)
	// POST /dba/datasources/:id/test - test connection
	f.POST("/datasources/:id/test", auth.RequirePermission("dba", "write"), h.TestConnection)

	// --- Audit Rules ---
	// GET /dba/audit-rules - list audit rules
	f.GET("/audit-rules", auth.RequirePermission("dba", "read"), h.ListAuditRules)
	// POST /dba/audit-rules - create audit rule
	f.POST("/audit-rules", auth.RequirePermission("dba", "write"), h.CreateAuditRule)
	// PUT /dba/audit-rules/:id - update audit rule
	rg.PUT("/dba/audit-rules/:id", auth.RequirePermission("dba", "write"), h.UpdateAuditRule)

	// --- Direct Query ---
	// POST /dba/query - execute direct SQL query
	f.POST("/query", auth.RequirePermission("dba", "execute"), h.ExecuteDirectQuery)
	// GET /dba/query-logs - list query execution audit logs
	rg.GET("/dba/query-logs", auth.RequirePermission("dba", "read"), h.ListQueryLogs)
}

// ---- SQL Orders ----

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
	id := c.Param("id")
	order, err := h.svc.GetOrder(c.Request.Context(), id)
	if err != nil {
		respondNotFound(c, "order not found")
		return
	}
	respondSuccess(c, order)
}

func (h *Handler) CreateOrder(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	order, err := h.svc.CreateOrder(c.Request.Context(), tenantID, userID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, order)
}

func (h *Handler) ApproveOrder(c *gin.Context) {
	id := c.Param("id")
	approvedBy := c.GetString("user_id")
	order, err := h.svc.ApproveOrder(c.Request.Context(), id, approvedBy)
	if err != nil {
		respondNotFound(c, "order not found")
		return
	}
	respondSuccess(c, order)
}

func (h *Handler) RejectOrder(c *gin.Context) {
	id := c.Param("id")
	order, err := h.svc.RejectOrder(c.Request.Context(), id)
	if err != nil {
		respondNotFound(c, "order not found")
		return
	}
	respondSuccess(c, order)
}

func (h *Handler) ExecuteOrder(c *gin.Context) {
	id := c.Param("id")
	order, err := h.svc.ExecuteOrder(c.Request.Context(), id)
	if err != nil {
		respondNotFound(c, "order not found")
		return
	}
	respondSuccess(c, order)
}

// ---- Data Sources ----

func (h *Handler) ListDataSources(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	sources, err := h.svc.ListDataSources(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, sources)
}

func (h *Handler) GetDataSource(c *gin.Context) {
	id := c.Param("id")
	ds, err := h.svc.GetDataSource(c.Request.Context(), id)
	if err != nil {
		respondNotFound(c, "data source not found")
		return
	}
	respondSuccess(c, ds)
}

func (h *Handler) CreateDataSource(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateDataSourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	ds, err := h.svc.CreateDataSource(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, ds)
}

func (h *Handler) UpdateDataSource(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateDataSourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	ds, err := h.svc.UpdateDataSource(c.Request.Context(), id, req)
	if err != nil {
		respondNotFound(c, "data source not found")
		return
	}
	respondSuccess(c, ds)
}

func (h *Handler) DeleteDataSource(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.DeleteDataSource(c.Request.Context(), id); err != nil {
		respondNotFound(c, "data source not found")
		return
	}
	respondSuccess(c, gin.H{"message": "data source deleted"})
}

func (h *Handler) TestConnection(c *gin.Context) {
	id := c.Param("id")
	result, err := h.svc.TestConnection(c.Request.Context(), id)
	if err != nil {
		respondNotFound(c, "data source not found")
		return
	}
	respondSuccess(c, result)
}

// ---- Audit Rules ----

func (h *Handler) ListAuditRules(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	rules, err := h.svc.ListAuditRules(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, rules)
}

func (h *Handler) CreateAuditRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateAuditRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	rule, err := h.svc.CreateAuditRule(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, rule)
}

func (h *Handler) UpdateAuditRule(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateAuditRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	rule, err := h.svc.UpdateAuditRule(c.Request.Context(), id, req)
	if err != nil {
		respondNotFound(c, "audit rule not found")
		return
	}
	respondSuccess(c, rule)
}

// ---- Direct Query ----

func (h *Handler) ExecuteDirectQuery(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.DirectQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	resp, err := h.svc.ExecuteDirectQuery(c.Request.Context(), tenantID, userID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if !resp.Success {
		respondBadRequest(c, resp.Error)
		return
	}
	respondSuccess(c, gin.H{
		"data":             resp.Data,
		"execution_record": resp.ExecutionRecord,
	})
}

// ---- Query Logs ----

func (h *Handler) ListQueryLogs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	q := models.QueryLogQuery{
		DataSourceID: c.Query("data_source_id"),
		Status:       c.Query("status"),
		Page:         intDef(c.Query("page"), 1),
		Limit:        intDef(c.Query("limit"), 20),
	}
	result, err := h.svc.ListQueryLogs(c.Request.Context(), tenantID, q)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// ---- Helpers ----

func intDef(val string, def int) int {
	if val == "" {
		return def
	}
	v, err := strconv.Atoi(val)
	if err != nil {
		return def
	}
	return v
}
