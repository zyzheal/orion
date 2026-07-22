package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/report-designer/models"
	"orion/platform-svc-go/internal/report-designer/service"

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

// RegisterRoutes registers all report designer endpoints under the given group.
// Mirrors /api/v1/reports routes from the TS source (16 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/reports")

	// --- Global datasources (must be before /:id) ---
	// GET /reports/datasources - List datasources
	f.GET("/datasources", auth.RequirePermission("report_designer", "read"), h.ListDatasources)
	// POST /reports/datasources - Create datasource
	f.POST("/datasources", auth.RequirePermission("report_designer", "write"), h.CreateDatasource)
	// PUT /reports/datasources/:id - Update datasource
	f.PUT("/datasources/:id", auth.RequirePermission("report_designer", "write"), h.UpdateDatasource)
	// DELETE /reports/datasources/:id - Delete datasource
	f.DELETE("/datasources/:id", auth.RequirePermission("report_designer", "delete"), h.DeleteDatasource)

	// --- Global schedules (must be before /:id) ---
	// PUT /reports/schedules/:id - Update schedule
	f.PUT("/schedules/:id", auth.RequirePermission("report_designer", "write"), h.UpdateSchedule)
	// DELETE /reports/schedules/:id - Delete schedule
	f.DELETE("/schedules/:id", auth.RequirePermission("report_designer", "delete"), h.DeleteSchedule)

	// --- Report CRUD ---
	// GET /reports - List reports
	f.GET("", auth.RequirePermission("report_designer", "read"), h.ListReports)
	// POST /reports - Create report
	f.POST("", auth.RequirePermission("report_designer", "write"), h.CreateReport)
	// GET /reports/:id - Get report
	f.GET("/:id", auth.RequirePermission("report_designer", "read"), h.GetReport)
	// PUT /reports/:id - Update report
	f.PUT("/:id", auth.RequirePermission("report_designer", "write"), h.UpdateReport)
	// DELETE /reports/:id - Delete report
	f.DELETE("/:id", auth.RequirePermission("report_designer", "delete"), h.DeleteReport)

	// --- Report actions ---
	// POST /reports/:id/preview - Preview report
	f.POST("/:id/preview", auth.RequirePermission("report_designer", "read"), h.PreviewReport)
	// POST /reports/:id/execute - Execute report
	f.POST("/:id/execute", auth.RequirePermission("report_designer", "write"), h.ExecuteReport)
	// GET /reports/:id/executions - Execution history
	f.GET("/:id/executions", auth.RequirePermission("report_designer", "read"), h.GetExecutionHistory)

	// --- Schedules per report ---
	// GET /reports/:id/schedules - List schedules for a report
	f.GET("/:id/schedules", auth.RequirePermission("report_designer", "read"), h.ListSchedules)
	// POST /reports/:id/schedules - Create schedule for a report
	f.POST("/:id/schedules", auth.RequirePermission("report_designer", "write"), h.CreateSchedule)
}

// --- Report CRUD handlers ---

func (h *Handler) CreateReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateReport")
	defer span.End()
	var req models.CreateReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	req.TenantID = &tenantID
	report, err := h.svc.CreateReport(ctx, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, report)
}

func (h *Handler) GetReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetReport")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	report, err := h.svc.GetReport(ctx, id, tenantID)
	if err != nil {
		if service.IsRepoNotFound(err) {
			middleware.RespondNotFound(c, "report not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, report)
}

func (h *Handler) UpdateReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateReport")
	defer span.End()
	id := c.Param("id")
	var req models.UpdateReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	report, err := h.svc.UpdateReport(ctx, id, tenantID, &req)
	if err != nil {
		if service.IsRepoNotFound(err) {
			middleware.RespondNotFound(c, "report not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, report)
}

func (h *Handler) DeleteReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteReport")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	deleted, err := h.svc.DeleteReport(ctx, id, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "report not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"deleted": true})
}

func (h *Handler) ListReports(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListReports")
	defer span.End()
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	keyword := ptrIf(c.Query("keyword"))
	category := ptrIf(c.Query("category"))
	limit := h.getQueryInt(c.Query("limit"), 20)
	offset := h.getQueryInt(c.Query("offset"), 0)
	enabled := parseBool(c.Query("enabled"))

	req := &models.ListReportsRequest{
		Category: category,
		Enabled:  enabled,
		Keyword:  keyword,
		Limit:    limit,
		Offset:   offset,
	}

	items, total, err := h.svc.ListReports(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:     items,
		Total:    total,
		Page:     offset/limit + 1,
		PageSize: limit,
	})
}

// --- Datasource handlers ---

func (h *Handler) CreateDatasource(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateDatasource")
	defer span.End()
	var req models.CreateDatasourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	req.TenantID = &tenantID
	ds, err := h.svc.CreateDatasource(ctx, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, ds)
}

func (h *Handler) UpdateDatasource(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateDatasource")
	defer span.End()
	id := c.Param("id")
	var req models.UpdateDatasourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	ds, err := h.svc.UpdateDatasource(ctx, id, tenantID, &req)
	if err != nil {
		if service.IsRepoNotFound(err) {
			middleware.RespondNotFound(c, "datasource not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, ds)
}

func (h *Handler) DeleteDatasource(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteDatasource")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	deleted, err := h.svc.DeleteDatasource(ctx, id, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "datasource not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"deleted": true})
}

func (h *Handler) ListDatasources(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListDatasources")
	defer span.End()
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	datasources, err := h.svc.ListDatasources(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, datasources)
}

// --- Schedule handlers ---

func (h *Handler) CreateSchedule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateSchedule")
	defer span.End()
	var req models.CreateScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	// Set reportId from URL param for convenience
	reportID := c.Param("id")
	if reportID != "" {
		req.ReportID = reportID
	}
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	req.TenantID = &tenantID
	schedule, err := h.svc.CreateSchedule(ctx, &req)
	if err != nil {
		if service.IsRepoNotFound(err) {
			middleware.RespondNotFound(c, "report not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, schedule)
}

func (h *Handler) UpdateSchedule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateSchedule")
	defer span.End()
	id := c.Param("id")
	var req models.UpdateScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	schedule, err := h.svc.UpdateSchedule(ctx, id, tenantID, &req)
	if err != nil {
		if service.IsRepoNotFound(err) {
			middleware.RespondNotFound(c, "schedule not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, schedule)
}

func (h *Handler) DeleteSchedule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteSchedule")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	deleted, err := h.svc.DeleteSchedule(ctx, id, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "schedule not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"deleted": true})
}

func (h *Handler) ListSchedules(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListSchedules")
	defer span.End()
	reportID := c.Param("id")
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	schedules, err := h.svc.ListSchedules(ctx, reportID, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, schedules)
}

// --- Execution / Preview handlers ---

func (h *Handler) PreviewReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PreviewReport")
	defer span.End()
	id := c.Param("id")
	var req models.PreviewReportRequest
	_ = c.ShouldBindJSON(&req)
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	result, err := h.svc.PreviewReport(ctx, id, tenantID, &req)
	if err != nil {
		if service.IsRepoNotFound(err) {
			middleware.RespondNotFound(c, "report not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) ExecuteReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExecuteReport")
	defer span.End()
	id := c.Param("id")
	var req models.ExecuteReportRequest
	_ = c.ShouldBindJSON(&req)
	user := c.GetString("user_id")
	if user == "" {
		user = c.GetString("userId")
	}
	if user == "" {
		req.User = ptrStr("anonymous")
	} else {
		req.User = &user
	}
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	execution, err := h.svc.ExecuteReport(ctx, id, tenantID, &req)
	if err != nil {
		if service.IsRepoNotFound(err) {
			middleware.RespondNotFound(c, "report not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, execution)
}

func (h *Handler) GetExecutionHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetExecutionHistory")
	defer span.End()
	id := c.Param("id")
	limit := h.getQueryInt(c.Query("limit"), 20)
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	executions, err := h.svc.GetExecutionHistory(ctx, id, tenantID, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, executions)
}

// --- Helpers ---

func (h *Handler) getDefaultTenantID(tenantID string) string {
	if tenantID == "" {
			return ""
	}
	return tenantID
}

func (h *Handler) getQueryInt(value string, defaultVal int) int {
	if value == "" {
		return defaultVal
	}
	i, err := strconv.Atoi(value)
	if err != nil {
		return defaultVal
	}
	return i
}

func ptrIf(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func ptrStr(s string) *string {
	return &s
}

func parseBool(s string) *bool {
	if s == "" {
		return nil
	}
	if s == "true" {
		return ptrBool(true)
	}
	if s == "false" {
		return ptrBool(false)
	}
	return nil
}

func ptrBool(v bool) *bool {
	return &v
}
