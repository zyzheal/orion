package handler

import (
	"net/http"
	"strconv"

	"orion/compliance-svc-go/internal/models"
	"orion/compliance-svc-go/internal/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// Handler provides HTTP handlers for compliance operations.
type Handler struct {
	svc *service.ComplianceService
}

// NewHandler creates a new Handler with the given service.
func NewHandler(svc *service.ComplianceService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers compliance routes on the given router group.
// Routes are prefixed with /api/v1/compliance by the caller.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// Compliance Reports
	rg.POST("/reports", auth.RequirePermission("compliance", "write"), h.CreateReport)
	rg.GET("/reports", auth.RequirePermission("compliance", "read"), h.ListReports)
	rg.GET("/reports/:id", auth.RequirePermission("compliance", "read"), h.GetReport)
	rg.PUT("/reports/:id", auth.RequirePermission("compliance", "write"), h.UpdateReport)
	rg.DELETE("/reports/:id", auth.RequirePermission("compliance", "delete"), h.DeleteReport)

	// Compliance Schedules
	rg.POST("/schedules", auth.RequirePermission("compliance", "write"), h.CreateSchedule)
	rg.GET("/schedules", auth.RequirePermission("compliance", "read"), h.ListSchedules)
	rg.DELETE("/schedules/:id", auth.RequirePermission("compliance", "delete"), h.DeleteSchedule)

	// Compliance Policies
	rg.POST("/policies", auth.RequirePermission("compliance", "write"), h.CreatePolicy)
	rg.GET("/policies", auth.RequirePermission("compliance", "read"), h.ListPolicies)
	rg.GET("/policies/:id", auth.RequirePermission("compliance", "read"), h.GetPolicy)
	rg.PUT("/policies/:id", auth.RequirePermission("compliance", "write"), h.UpdatePolicy)
	rg.DELETE("/policies/:id", auth.RequirePermission("compliance", "delete"), h.DeletePolicy)
}

// ==================== Report Handlers ====================

// CreateReport handles POST /reports.
func (h *Handler) CreateReport(c *gin.Context) {
	var req struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
		Framework   string `json:"framework" binding:"required"`
		TriggeredBy string `json:"triggered_by"`
		ScheduleID  string `json:"schedule_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": http.StatusBadRequest, "message": err.Error()})
		return
	}

	tenantID := c.GetString("tenant_id")
	report, err := h.svc.CreateReport(c.Request.Context(), tenantID, req.Name, req.Description, req.Framework, req.TriggeredBy, req.ScheduleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": http.StatusInternalServerError, "message": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"code": http.StatusCreated, "message": "OK", "data": report})
}

// GetReport handles GET /reports/:id.
func (h *Handler) GetReport(c *gin.Context) {
	id := c.Param("id")

	report, err := h.svc.GetReport(c.Request.Context(), id)
	if err != nil {
		if err == service.ErrReportNotFound {
			c.JSON(http.StatusNotFound, gin.H{"code": http.StatusNotFound, "message": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": http.StatusInternalServerError, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": http.StatusOK, "message": "OK", "data": report})
}

// ListReports handles GET /reports.
func (h *Handler) ListReports(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
		framework := c.Query("framework")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	reports, err := h.svc.ListReports(c.Request.Context(), tenantID, framework, offset, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": http.StatusInternalServerError, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": http.StatusOK, "message": "OK", "data": reports})
}

// UpdateReport handles PUT /reports/:id.
func (h *Handler) UpdateReport(c *gin.Context) {
	id := c.Param("id")

	var input models.UpdateReportInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": http.StatusBadRequest, "message": err.Error()})
		return
	}

	report, err := h.svc.UpdateReport(c.Request.Context(), id, &input)
	if err != nil {
		if err == service.ErrReportNotFound {
			c.JSON(http.StatusNotFound, gin.H{"code": http.StatusNotFound, "message": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": http.StatusInternalServerError, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": http.StatusOK, "message": "OK", "data": report})
}

// DeleteReport handles DELETE /reports/:id.
func (h *Handler) DeleteReport(c *gin.Context) {
	id := c.Param("id")

	if err := h.svc.DeleteReport(c.Request.Context(), id); err != nil {
		if err == service.ErrReportNotFound {
			c.JSON(http.StatusNotFound, gin.H{"code": http.StatusNotFound, "message": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": http.StatusInternalServerError, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": http.StatusOK, "message": "OK", "data": gin.H{"deleted": true}})
}

// ==================== Schedule Handlers ====================

// CreateSchedule handles POST /schedules.
func (h *Handler) CreateSchedule(c *gin.Context) {
	var req struct {
		Name          string `json:"name" binding:"required"`
		Framework     string `json:"framework" binding:"required"`
		CronExpression string `json:"cron_expression" binding:"required"`
		Enabled       *bool  `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": http.StatusBadRequest, "message": err.Error()})
		return
	}

	tenantID := c.GetString("tenant_id")
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	schedule, err := h.svc.CreateSchedule(c.Request.Context(), tenantID, req.Name, req.Framework, req.CronExpression, enabled, "")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": http.StatusInternalServerError, "message": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"code": http.StatusCreated, "message": "OK", "data": schedule})
}

// ListSchedules handles GET /schedules.
func (h *Handler) ListSchedules(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	schedules, err := h.svc.ListSchedules(c.Request.Context(), tenantID, offset, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": http.StatusInternalServerError, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": http.StatusOK, "message": "OK", "data": schedules})
}

// DeleteSchedule handles DELETE /schedules/:id.
func (h *Handler) DeleteSchedule(c *gin.Context) {
	id := c.Param("id")

	if err := h.svc.DeleteSchedule(c.Request.Context(), id); err != nil {
		if err == service.ErrScheduleNotFound {
			c.JSON(http.StatusNotFound, gin.H{"code": http.StatusNotFound, "message": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": http.StatusInternalServerError, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": http.StatusOK, "message": "OK", "data": gin.H{"deleted": true}})
}

	// ==================== Policy Handlers ====================

	// CreatePolicy handles POST /policies.
	func (h *Handler) CreatePolicy(c *gin.Context) {
		var input models.CreatePolicyInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"code": http.StatusBadRequest, "message": err.Error()})
			return
		}
		tenantID := c.GetString("tenant_id")
		policy, err := h.svc.CreatePolicy(c.Request.Context(), tenantID, &input)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": http.StatusInternalServerError, "message": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"code": http.StatusCreated, "message": "OK", "data": policy})
	}

	// ListPolicies handles GET /policies.
	func (h *Handler) ListPolicies(c *gin.Context) {
		tenantID := c.GetString("tenant_id")
		framework := c.Query("framework")
		category := c.Query("category")
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
		if page <= 0 { page = 1 }
		if pageSize <= 0 || pageSize > 100 { pageSize = 20 }
		offset := (page - 1) * pageSize
		policies, err := h.svc.ListPolicies(c.Request.Context(), tenantID, framework, category, offset, pageSize)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": http.StatusInternalServerError, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"code": http.StatusOK, "message": "OK", "data": policies})
	}

	// GetPolicy handles GET /policies/:id.
	func (h *Handler) GetPolicy(c *gin.Context) {
		id := c.Param("id")
		policy, err := h.svc.GetPolicy(c.Request.Context(), id)
		if err != nil {
			if err == service.ErrPolicyNotFound {
				c.JSON(http.StatusNotFound, gin.H{"code": http.StatusNotFound, "message": err.Error()})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"code": http.StatusInternalServerError, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"code": http.StatusOK, "message": "OK", "data": policy})
	}

	// UpdatePolicy handles PUT /policies/:id.
	func (h *Handler) UpdatePolicy(c *gin.Context) {
		id := c.Param("id")
		var input models.UpdatePolicyInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"code": http.StatusBadRequest, "message": err.Error()})
			return
		}
		policy, err := h.svc.UpdatePolicy(c.Request.Context(), id, &input)
		if err != nil {
			if err == service.ErrPolicyNotFound {
				c.JSON(http.StatusNotFound, gin.H{"code": http.StatusNotFound, "message": err.Error()})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"code": http.StatusInternalServerError, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"code": http.StatusOK, "message": "OK", "data": policy})
	}

	// DeletePolicy handles DELETE /policies/:id.
	func (h *Handler) DeletePolicy(c *gin.Context) {
		id := c.Param("id")
		if err := h.svc.DeletePolicy(c.Request.Context(), id); err != nil {
			if err == service.ErrPolicyNotFound {
				c.JSON(http.StatusNotFound, gin.H{"code": http.StatusNotFound, "message": err.Error()})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"code": http.StatusInternalServerError, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"code": http.StatusOK, "message": "OK", "data": gin.H{"deleted": true}})
	}
