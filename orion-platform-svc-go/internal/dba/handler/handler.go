package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/dba/models"
	"orion/platform-svc-go/internal/dba/service"

	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListOrders")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	result, err := h.svc.ListOrders(ctx, tenantID, status, page, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) GetOrder(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetOrder")
	defer span.End()
	id := c.Param("id")
	order, err := h.svc.GetOrder(ctx, id)
	if err != nil {
		middleware.RespondNotFound(c, "order not found")
		return
	}
	middleware.RespondSuccess(c, order)
}

func (h *Handler) CreateOrder(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateOrder")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	order, err := h.svc.CreateOrder(ctx, tenantID, userID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, order)
}

func (h *Handler) ApproveOrder(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ApproveOrder")
	defer span.End()
	id := c.Param("id")
	approvedBy := c.GetString("user_id")
	order, err := h.svc.ApproveOrder(ctx, id, approvedBy)
	if err != nil {
		middleware.RespondNotFound(c, "order not found")
		return
	}
	middleware.RespondSuccess(c, order)
}

func (h *Handler) RejectOrder(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RejectOrder")
	defer span.End()
	id := c.Param("id")
	order, err := h.svc.RejectOrder(ctx, id)
	if err != nil {
		middleware.RespondNotFound(c, "order not found")
		return
	}
	middleware.RespondSuccess(c, order)
}

func (h *Handler) ExecuteOrder(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExecuteOrder")
	defer span.End()
	id := c.Param("id")
	order, err := h.svc.ExecuteOrder(ctx, id)
	if err != nil {
		middleware.RespondNotFound(c, "order not found")
		return
	}
	middleware.RespondSuccess(c, order)
}

// ---- Data Sources ----

func (h *Handler) ListDataSources(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListDataSources")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	sources, err := h.svc.ListDataSources(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, sources)
}

func (h *Handler) GetDataSource(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDataSource")
	defer span.End()
	id := c.Param("id")
	ds, err := h.svc.GetDataSource(ctx, id)
	if err != nil {
		middleware.RespondNotFound(c, "data source not found")
		return
	}
	middleware.RespondSuccess(c, ds)
}

func (h *Handler) CreateDataSource(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateDataSource")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateDataSourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	ds, err := h.svc.CreateDataSource(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, ds)
}

func (h *Handler) UpdateDataSource(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateDataSource")
	defer span.End()
	id := c.Param("id")
	var req models.UpdateDataSourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	ds, err := h.svc.UpdateDataSource(ctx, id, req)
	if err != nil {
		middleware.RespondNotFound(c, "data source not found")
		return
	}
	middleware.RespondSuccess(c, ds)
}

func (h *Handler) DeleteDataSource(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteDataSource")
	defer span.End()
	id := c.Param("id")
	if err := h.svc.DeleteDataSource(ctx, id); err != nil {
		middleware.RespondNotFound(c, "data source not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "data source deleted"})
}

func (h *Handler) TestConnection(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TestConnection")
	defer span.End()
	id := c.Param("id")
	result, err := h.svc.TestConnection(ctx, id)
	if err != nil {
		middleware.RespondNotFound(c, "data source not found")
		return
	}
	middleware.RespondSuccess(c, result)
}

// ---- Audit Rules ----

func (h *Handler) ListAuditRules(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAuditRules")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	rules, err := h.svc.ListAuditRules(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, rules)
}

func (h *Handler) CreateAuditRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateAuditRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateAuditRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	rule, err := h.svc.CreateAuditRule(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, rule)
}

func (h *Handler) UpdateAuditRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateAuditRule")
	defer span.End()
	id := c.Param("id")
	var req models.UpdateAuditRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	rule, err := h.svc.UpdateAuditRule(ctx, id, req)
	if err != nil {
		middleware.RespondNotFound(c, "audit rule not found")
		return
	}
	middleware.RespondSuccess(c, rule)
}

// ---- Direct Query ----

func (h *Handler) ExecuteDirectQuery(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExecuteDirectQuery")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.DirectQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	resp, err := h.svc.ExecuteDirectQuery(ctx, tenantID, userID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !resp.Success {
		middleware.RespondBadRequest(c, resp.Error)
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"data":             resp.Data,
		"execution_record": resp.ExecutionRecord,
	})
}

// ---- Query Logs ----

func (h *Handler) ListQueryLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListQueryLogs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	q := models.QueryLogQuery{
		DataSourceID: c.Query("data_source_id"),
		Status:       c.Query("status"),
		Page:         intDef(c.Query("page"), 1),
		Limit:        intDef(c.Query("limit"), 20),
	}
	result, err := h.svc.ListQueryLogs(ctx, tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
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
