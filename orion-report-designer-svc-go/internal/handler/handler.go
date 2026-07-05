package handler

import (
	"net/http"
	"strconv"

	"orion/report-designer-svc-go/internal/models"
	"orion/report-designer-svc-go/internal/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// Response is the standard API response envelope.
type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// Handler provides HTTP handlers for report designer operations.
type Handler struct {
	svc *service.ReportDesignerService
}

// NewHandler creates a new Handler.
func NewHandler(svc *service.ReportDesignerService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers report designer routes on the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	reports := rg.Group("/reports")
	{
		reports.GET("", auth.RequirePermission("report-designer", "read"), h.ListReports)
		reports.POST("", auth.RequirePermission("report-designer", "write"), h.CreateReport)
		reports.GET("/:id", auth.RequirePermission("report-designer", "read"), h.GetReport)
		reports.PUT("/:id", auth.RequirePermission("report-designer", "write"), h.UpdateReport)
		reports.DELETE("/:id", auth.RequirePermission("report-designer", "delete"), h.DeleteReport)
		reports.POST("/:id/preview", auth.RequirePermission("report-designer", "read"), h.PreviewReport)
		reports.POST("/:id/execute", auth.RequirePermission("report-designer", "write"), h.ExecuteReport)
		reports.GET("/:id/executions", auth.RequirePermission("report-designer", "read"), h.GetExecutionHistory)
		reports.GET("/:id/schedules", auth.RequirePermission("report-designer", "read"), h.ListSchedules)
		reports.POST("/:id/schedules", auth.RequirePermission("report-designer", "write"), h.CreateSchedule)
	}

	// Datasource routes (must be registered before /:id to avoid route conflict)
	reports.GET("/datasources", auth.RequirePermission("report-designer", "read"), h.ListDatasources)
	reports.POST("/datasources", auth.RequirePermission("report-designer", "write"), h.CreateDatasource)
	reports.PUT("/datasources/:id", auth.RequirePermission("report-designer", "write"), h.UpdateDatasource)
	reports.DELETE("/datasources/:id", auth.RequirePermission("report-designer", "delete"), h.DeleteDatasource)

	// Schedule routes at /schedules/:id (no :reportId prefix in TS)
	reports.PUT("/schedules/:id", auth.RequirePermission("report-designer", "write"), h.UpdateSchedule)
	reports.DELETE("/schedules/:id", auth.RequirePermission("report-designer", "delete"), h.DeleteSchedule)
}

// ==================== Report Definition Handlers ====================

// ListReports handles GET /reports.
func (h *Handler) ListReports(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	category := c.Query("category")
	enabledStr := c.Query("enabled")
	keyword := c.Query("keyword")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}

	filters := models.ReportDefinitionFilters{
		Limit:  pageSize,
		Offset: (page - 1) * pageSize,
	}
	if category != "" {
		filters.Category = &category
	}
	if enabledStr != "" {
		enabled := enabledStr == "true"
		filters.Enabled = &enabled
	}
	if keyword != "" {
		filters.Keyword = &keyword
	}

	reports, total, err := h.svc.ListReports(c.Request.Context(), tenantID, filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{Code: 500, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{
		Code:    200,
		Message: "OK",
		Data: gin.H{
			"reports": reports,
			"total":   total,
		},
	})
}

// GetReport handles GET /reports/:id.
func (h *Handler) GetReport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	report, err := h.svc.GetReport(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, Response{Code: 404, Message: "report not found"})
		return
	}

	c.JSON(http.StatusOK, Response{Code: 200, Message: "OK", Data: report})
}

// CreateReport handles POST /reports.
func (h *Handler) CreateReport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")

	var input models.CreateReportInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, Response{Code: 400, Message: err.Error()})
		return
	}

	if input.Name == "" {
		c.JSON(http.StatusBadRequest, Response{Code: 400, Message: "name is required"})
		return
	}

	input.CreatedBy = &userID
	report, err := h.svc.CreateReport(c.Request.Context(), tenantID, &input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{Code: 500, Message: err.Error()})
		return
	}

	c.JSON(http.StatusCreated, Response{Code: 201, Message: "OK", Data: report})
}

// UpdateReport handles PUT /reports/:id.
func (h *Handler) UpdateReport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var input models.UpdateReportInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, Response{Code: 400, Message: err.Error()})
		return
	}

	report, err := h.svc.UpdateReport(c.Request.Context(), tenantID, id, &input)
	if err != nil {
		if err == service.ErrReportNotFound {
			c.JSON(http.StatusNotFound, Response{Code: 404, Message: "report not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, Response{Code: 500, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{Code: 200, Message: "OK", Data: report})
}

// DeleteReport handles DELETE /reports/:id.
func (h *Handler) DeleteReport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	err := h.svc.DeleteReport(c.Request.Context(), tenantID, id)
	if err != nil {
		if err == service.ErrReportNotFound {
			c.JSON(http.StatusNotFound, Response{Code: 404, Message: "report not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, Response{Code: 500, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{Code: 200, Message: "OK", Data: gin.H{"deleted": true}})
}

// PreviewReport handles POST /reports/:id/preview.
func (h *Handler) PreviewReport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var params map[string]interface{}
	_ = c.ShouldBindJSON(&params)
	if params == nil {
		params = map[string]interface{}{}
	}

	result, err := h.svc.PreviewReport(c.Request.Context(), tenantID, id, params)
	if err != nil {
		c.JSON(http.StatusNotFound, Response{Code: 404, Message: "report not found"})
		return
	}

	c.JSON(http.StatusOK, Response{Code: 200, Message: "OK", Data: result})
}

// ExecuteReport handles POST /reports/:id/execute.
func (h *Handler) ExecuteReport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	id := c.Param("id")

	var body map[string]interface{}
	_ = c.ShouldBindJSON(&body)
	exportFormat := "pdf"
	if ef, ok := body["exportFormat"].(string); ok && ef != "" {
		exportFormat = ef
	}

	triggeredBy := userID
	if t, ok := body["triggeredBy"].(string); ok && t != "" {
		triggeredBy = t
	}

	execution, err := h.svc.ExecuteReport(c.Request.Context(), tenantID, id, exportFormat, triggeredBy)
	if err != nil {
		c.JSON(http.StatusNotFound, Response{Code: 404, Message: "report not found"})
		return
	}

	c.JSON(http.StatusCreated, Response{Code: 201, Message: "OK", Data: execution})
}

// GetExecutionHistory handles GET /reports/:id/executions.
func (h *Handler) GetExecutionHistory(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	executions, err := h.svc.GetExecutionHistory(c.Request.Context(), tenantID, id, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{Code: 500, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{Code: 200, Message: "OK", Data: executions})
}

// ==================== Datasource Handlers ====================

// ListDatasources handles GET /reports/datasources.
func (h *Handler) ListDatasources(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	datasources, err := h.svc.ListDatasources(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{Code: 500, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{Code: 200, Message: "OK", Data: datasources})
}

// CreateDatasource handles POST /reports/datasources.
func (h *Handler) CreateDatasource(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var input models.CreateDatasourceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, Response{Code: 400, Message: err.Error()})
		return
	}

	if input.Name == "" || input.DatasourceType == "" || input.Config == nil {
		c.JSON(http.StatusBadRequest, Response{Code: 400, Message: "name, datasourceType, and config are required"})
		return
	}

	ds, err := h.svc.CreateDatasource(c.Request.Context(), tenantID, &input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{Code: 500, Message: err.Error()})
		return
	}

	c.JSON(http.StatusCreated, Response{Code: 201, Message: "OK", Data: ds})
}

// UpdateDatasource handles PUT /reports/datasources/:id.
func (h *Handler) UpdateDatasource(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var input models.UpdateDatasourceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, Response{Code: 400, Message: err.Error()})
		return
	}

	ds, err := h.svc.UpdateDatasource(c.Request.Context(), tenantID, id, &input)
	if err != nil {
		if err == service.ErrDatasourceNotFound {
			c.JSON(http.StatusNotFound, Response{Code: 404, Message: "datasource not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, Response{Code: 500, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{Code: 200, Message: "OK", Data: ds})
}

// DeleteDatasource handles DELETE /reports/datasources/:id.
func (h *Handler) DeleteDatasource(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	err := h.svc.DeleteDatasource(c.Request.Context(), tenantID, id)
	if err != nil {
		if err == service.ErrDatasourceNotFound {
			c.JSON(http.StatusNotFound, Response{Code: 404, Message: "datasource not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, Response{Code: 500, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{Code: 200, Message: "OK", Data: gin.H{"deleted": true}})
}

// ==================== Schedule Handlers ====================

// ListSchedules handles GET /reports/:id/schedules.
func (h *Handler) ListSchedules(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	reportID := c.Param("id")

	schedules, err := h.svc.ListSchedules(c.Request.Context(), tenantID, reportID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{Code: 500, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{Code: 200, Message: "OK", Data: schedules})
}

// CreateSchedule handles POST /reports/:id/schedules.
func (h *Handler) CreateSchedule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	reportID := c.Param("id")

	var input models.CreateScheduleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, Response{Code: 400, Message: err.Error()})
		return
	}

	input.ReportID = reportID

	schedule, err := h.svc.CreateSchedule(c.Request.Context(), tenantID, &input)
	if err != nil {
		if err == service.ErrReportNotFound {
			c.JSON(http.StatusNotFound, Response{Code: 404, Message: "report not found"})
			return
		}
		c.JSON(http.StatusBadRequest, Response{Code: 400, Message: err.Error()})
		return
	}

	c.JSON(http.StatusCreated, Response{Code: 201, Message: "OK", Data: schedule})
}

// UpdateSchedule handles PUT /reports/schedules/:id.
func (h *Handler) UpdateSchedule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var input models.UpdateScheduleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, Response{Code: 400, Message: err.Error()})
		return
	}

	schedule, err := h.svc.UpdateSchedule(c.Request.Context(), tenantID, id, &input)
	if err != nil {
		if err == service.ErrScheduleNotFound {
			c.JSON(http.StatusNotFound, Response{Code: 404, Message: "schedule not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, Response{Code: 500, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{Code: 200, Message: "OK", Data: schedule})
}

// DeleteSchedule handles DELETE /reports/schedules/:id.
func (h *Handler) DeleteSchedule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	err := h.svc.DeleteSchedule(c.Request.Context(), tenantID, id)
	if err != nil {
		if err == service.ErrScheduleNotFound {
			c.JSON(http.StatusNotFound, Response{Code: 404, Message: "schedule not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, Response{Code: 500, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{Code: 200, Message: "OK", Data: gin.H{"deleted": true}})
}
